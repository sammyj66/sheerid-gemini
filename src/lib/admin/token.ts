export type AdminTokenPayload = {
  sub: "admin";
  iat: number;
  exp: number;
};

const TOKEN_TTL_MS = 1000 * 60 * 60 * 2;
const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.ADMIN_PASSWORD || "";
  if (!secret) {
    throw new Error("ADMIN_PASSWORD is not configured");
  }
  return secret;
}

function base64Encode(bytes: Uint8Array) {
  if (typeof btoa === "function") {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

function base64Decode(base64: string) {
  if (typeof atob === "function") {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function base64UrlEncode(bytes: Uint8Array) {
  return base64Encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  return base64Decode(base64 + "=".repeat(padLength));
}

async function getKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(input: string, secret: string) {
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verify(input: string, signature: string, secret: string) {
  const key = await getKey(secret);
  const data = encoder.encode(input);
  const sigBytes = base64UrlDecode(signature);
  return crypto.subtle.verify("HMAC", key, sigBytes, data);
}

export async function createAdminToken(ttlMs = TOKEN_TTL_MS) {
  const now = Date.now();
  const payload: AdminTokenPayload = {
    sub: "admin",
    iat: now,
    exp: now + ttlMs,
  };
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const secret = getSecret();
  const signature = await sign(body, secret);
  return `${body}.${signature}`;
}

export async function verifyAdminToken(token: string | null) {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const secret = getSecret();
  const ok = await verify(body, signature, secret);
  if (!ok) return null;
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(body))
    ) as AdminTokenPayload;
    if (payload.sub !== "admin") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const ADMIN_SESSION_TTL_MS = TOKEN_TTL_MS;
