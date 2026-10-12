import { isSameOrigin, jsonError } from "@/lib/http";
import { endParticipantSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);
  await endParticipantSession();
  return Response.json({ ok: true });
}
