import { cookies } from "next/headers";
import { secureCookies, sessionSecret } from "@/lib/config";
import { signToken, verifyToken } from "@/lib/tokens";

const PARTICIPANT_COOKIE = "garment_participant";
const ADMIN_COOKIE = "garment_admin";
const PARTICIPANT_TTL = 60 * 60 * 24 * 14;
const ADMIN_TTL = 60 * 60 * 12;

const cookieOptions = (maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: secureCookies, path: "/", maxAge });

export async function getParticipantId() {
  const token = (await cookies()).get(PARTICIPANT_COOKIE)?.value;
  const session = verifyToken<{ role: string; id: number }>(token, sessionSecret());
  return session?.role === "participant" && Number.isInteger(session.id) ? session.id : null;
}

export async function startParticipantSession(participantId: number) {
  (await cookies()).set(PARTICIPANT_COOKIE, signToken({ role: "participant", id: participantId }, sessionSecret(), PARTICIPANT_TTL), cookieOptions(PARTICIPANT_TTL));
}

export async function endParticipantSession() {
  (await cookies()).delete(PARTICIPANT_COOKIE);
}

export async function isAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifyToken<{ role: string }>(token, sessionSecret())?.role === "admin";
}

export async function startAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, signToken({ role: "admin" }, sessionSecret(), ADMIN_TTL), cookieOptions(ADMIN_TTL));
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}
