import { ADMIN_SESSION_TTL_MS, verifyAdminToken } from "./token";

const SESSION_COOKIE = "admin_session";

export function getClientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") || "unknown";
}

export function parseCookies(cookieHeader: string | null) {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...valueParts] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(valueParts.join("="));
    return acc;
  }, {});
}

export function getAuthToken(headers: Headers) {
  const auth = headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(headers.get("cookie"));
  return cookies[SESSION_COOKIE] || null;
}

export async function requireAdmin(headers: Headers) {
  const token = getAuthToken(headers);
  return verifyAdminToken(token);
}

export function buildAuthCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  const maxAge = Math.floor(ADMIN_SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${encodeURIComponent(
    token
  )}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge};${secure}`;
}
