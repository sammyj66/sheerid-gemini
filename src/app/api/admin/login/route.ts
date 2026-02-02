import { NextResponse } from "next/server";
import { buildAuthCookie, getClientIp } from "@/lib/admin/auth";
import { createAdminToken } from "@/lib/admin/token";
import { logAdminAction } from "@/lib/admin/audit";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

type AttemptRecord = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as unknown as {
  adminLoginAttempts?: Map<string, AttemptRecord>;
};

const attempts = globalForRateLimit.adminLoginAttempts ?? new Map();
globalForRateLimit.adminLoginAttempts = attempts;

function checkRateLimit(ip: string) {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  record.count += 1;
  attempts.set(ip, record);
  return { allowed: true, retryAfter: 0 };
}

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    await logAdminAction({
      action: "login_rate_limited",
      detail: `rate_limited retry_after=${rate.retryAfter}s`,
      ip,
    });
    return NextResponse.json(
      { success: false, error: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  let payload: { password?: string } = {};
  try {
    payload = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (!adminPassword) {
    return NextResponse.json(
      { success: false, error: "ADMIN_PASSWORD not configured" },
      { status: 500 }
    );
  }

  if (payload.password !== adminPassword) {
    await logAdminAction({ action: "login_failed", detail: "wrong_password", ip });
    return NextResponse.json({ success: false, error: "密码错误" }, { status: 401 });
  }

  const token = await createAdminToken();
  const response = NextResponse.json({ success: true, token });
  response.headers.append("Set-Cookie", buildAuthCookie(token));

  await logAdminAction({ action: "login_success", ip });
  return response;
}
