import { adminAccessCode } from "@/lib/config";
import { clientKey, isSameOrigin, jsonError } from "@/lib/http";
import { createFailureLimiter } from "@/lib/rateLimit";
import { startAdminSession } from "@/lib/session";
import { codesMatch } from "@/lib/tokens";

const failures = createFailureLimiter(8, 15 * 60 * 1000);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);
  const key = clientKey(request);
  if (failures.isBlocked(key)) return jsonError("Too many wrong codes. Wait 15 minutes and try again.", 429);

  let code: unknown;
  try { code = (await request.json() as { code?: unknown }).code; } catch { return jsonError("Enter the admin code.", 400); }
  if (typeof code !== "string" || !code.trim()) return jsonError("Enter the admin code.", 400);

  if (!codesMatch(code.trim(), adminAccessCode())) {
    failures.recordFailure(key);
    return jsonError("That admin code isn't right.", 401);
  }
  failures.reset(key);
  await startAdminSession();
  return Response.json({ ok: true });
}
