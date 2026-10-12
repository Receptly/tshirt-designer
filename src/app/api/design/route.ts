import { MAX_DESIGN_BYTES, MAX_MOCKUP_BYTES, parseMockup, parseSavedDesign } from "@/lib/designPayload";
import { isSameOrigin, jsonError } from "@/lib/http";
import { getDesign, getParticipant, saveDesign } from "@/lib/repository";
import { getParticipantId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const participantId = await getParticipantId();
  if (!participantId) return jsonError("Sign in to open your design.", 401);
  try {
    return Response.json({ design: await getDesign(participantId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load a design", error);
    return jsonError("Your design couldn't be loaded. Please try again.", 500);
  }
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Request blocked.", 403);
  const participantId = await getParticipantId();
  if (!participantId) return jsonError("Your session expired. Sign in again to save.", 401);

  const text = await request.text();
  if (text.length > MAX_DESIGN_BYTES + Math.ceil(MAX_MOCKUP_BYTES * 1.4)) return jsonError("This design is too large to save. Try smaller images.", 413);
  let body: { payload?: unknown; mockup?: unknown };
  try { body = JSON.parse(text); } catch { return jsonError("That design couldn't be read.", 400); }

  const design = parseSavedDesign(body.payload);
  if (!design.ok) return jsonError(design.error, 400);
  const mockup = parseMockup(body.mockup);
  if (mockup === undefined) return jsonError("The preview image couldn't be saved.", 400);

  try {
    if (!(await getParticipant(participantId))) return jsonError("Your session expired. Sign in again to save.", 401);
    return Response.json({ savedAt: await saveDesign(participantId, design.value, mockup) });
  } catch (error) {
    console.error("Could not save a design", error);
    return jsonError("Your design couldn't be saved. Please try again.", 500);
  }
}
