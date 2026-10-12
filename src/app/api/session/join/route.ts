import { workshopAccessCode } from "@/lib/config";
import { clientKey, isSameOrigin, jsonError } from "@/lib/http";
import { createFailureLimiter } from "@/lib/rateLimit";
import { upsertParticipant } from "@/lib/repository";
import { startParticipantSession } from "@/lib/session";
import { codesMatch } from "@/lib/tokens";
import { parseJoin } from "@/lib/workshop";

export const runtime = "nodejs";

const failures = createFailureLimiter(20, 10 * 60 * 1000);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);
  const key = clientKey(request);
  if (failures.isBlocked(key)) return jsonError("Too many wrong codes. Wait a few minutes and try again.", 429);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Enter the workshop code, your name, and a group number.", 400); }
  const parsed = parseJoin(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  if (!codesMatch(parsed.value.accessCode, workshopAccessCode())) {
    failures.recordFailure(key);
    return jsonError("That access code isn't right. Check the code you were sent.", 401);
  }

  try {
    const participant = await upsertParticipant(parsed.value);
    await startParticipantSession(participant.id);
    return Response.json({ participant: { name: participant.name, groupNumber: participant.groupNumber } });
  } catch (error) {
    console.error("Could not join the workshop", error);
    return jsonError("Something went wrong on our side. Please try again.", 500);
  }
}
