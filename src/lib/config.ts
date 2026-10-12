const isProduction = process.env.NODE_ENV === "production";
const warned = new Set<string>();

// Dev-only fallbacks let the app run locally; production refuses to start without real values.
function setting(name: string, developmentFallback: string) {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) throw new Error(`${name} is not configured`);
  if (!warned.has(name)) { warned.add(name); console.warn(`[config] ${name} is not set; using an insecure development default.`); }
  return developmentFallback;
}

export const workshopAccessCode = () => setting("WORKSHOP_ACCESS_CODE", "workshop-dev");
export const adminAccessCode = () => setting("ADMIN_ACCESS_CODE", "admin-dev");
export const sessionSecret = () => setting("SESSION_SECRET", "development-session-secret-change-me");
export const secureCookies = isProduction;
