import { isSameOrigin, jsonError } from "@/lib/http";
import { endAdminSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);
  await endAdminSession();
  return Response.json({ ok: true });
}
