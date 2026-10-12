export const GROUP_COUNT = 26;
export const groupNumbers = Array.from({ length: GROUP_COUNT }, (_, index) => index + 1);

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

// Case-insensitive identity so "gary" and "Gary " reopen the same design.
export function nameKey(name: string) {
  return normalizeName(name).toLowerCase();
}

export interface JoinInput { accessCode: string; name: string; groupNumber: number; email: string | null; }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseJoin(body: unknown): { ok: true; value: JoinInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Enter the workshop code, your name, and a group number." };
  const { accessCode, name, groupNumber, email } = body as Record<string, unknown>;
  if (typeof accessCode !== "string" || !accessCode.trim()) return { ok: false, error: "Enter the workshop access code." };
  if (typeof name !== "string" || normalizeName(name).length < 2 || normalizeName(name).length > 60) return { ok: false, error: "Enter your name (2-60 characters)." };
  const group = typeof groupNumber === "number" ? groupNumber : Number(groupNumber);
  if (!Number.isInteger(group) || group < 1 || group > GROUP_COUNT) return { ok: false, error: `Choose a group number from 1 to ${GROUP_COUNT}.` };
  let cleanEmail: string | null = null;
  if (typeof email === "string" && email.trim()) {
    cleanEmail = email.trim();
    if (cleanEmail.length > 120 || !emailPattern.test(cleanEmail)) return { ok: false, error: "That email address doesn't look right." };
  }
  return { ok: true, value: { accessCode: accessCode.trim(), name: normalizeName(name), groupNumber: group, email: cleanEmail } };
}
