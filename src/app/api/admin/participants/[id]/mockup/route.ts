import { jsonError } from "@/lib/http";
import { getMockup } from "@/lib/repository";
import { isAdmin } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return jsonError("Admin access required.", 401);
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return jsonError("Not found.", 404);
  const mockup = await getMockup(id);
  if (!mockup) return jsonError("No preview saved yet.", 404);
  return new Response(new Uint8Array(mockup), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=60" } });
}
