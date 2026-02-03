const UPSTREAM_BASE = process.env.UPSTREAM_BASE || "https://neigui.1key.me";
const UPSTREAM_TIMEOUT_MS = 60_000;

type TimeoutSignal = { signal: AbortSignal; cleanup: () => void };

function createTimeoutSignal(ms: number): TimeoutSignal {
  const timeoutFn = (
    AbortSignal as typeof AbortSignal & {
      timeout?: (ms: number) => AbortSignal;
    }
  ).timeout;
  if (typeof timeoutFn === "function") {
    return { signal: timeoutFn(ms), cleanup: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = UPSTREAM_TIMEOUT_MS
) {
  const { signal, cleanup } = createTimeoutSignal(timeoutMs);
  try {
    return await fetch(url, { ...options, signal });
  } finally {
    cleanup();
  }
}

function extractCsrfTokenFromHtml(html: string): string | null {
  const metaMatch =
    html.match(/name=["']csrf-token["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+name=["']csrf-token["']/i);
  if (metaMatch) return metaMatch[1];
  const inlineMatch =
    html.match(/CSRF_TOKEN\s*=?\s*["']([^"']+)["']/i) ||
    html.match(/csrfToken["']?\s*[:=]\s*["']([^"']+)["']/i) ||
    html.match(/csrf[-_]?token["']?\s*[:=]\s*["']([^"']+)["']/i) ||
    html.match(/XSRF[-_]?TOKEN["']?\s*[:=]\s*["']([^"']+)["']/i);
  if (inlineMatch) return inlineMatch[1];
  return null;
}

function getSetCookieValues(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const header = res.headers.get("set-cookie");
  if (!header) return [];
  return header.split(/,(?=[^;]+?=)/);
}

function extractTokenFromCookies(cookieHeader: string | undefined | null) {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";").map((part) => part.trim());
  for (const pair of pairs) {
    const [name, ...rest] = pair.split("=");
    if (!name) continue;
    const value = rest.join("=");
    const key = name.toLowerCase();
    if (
      key === "csrf-token" ||
      key === "csrftoken" ||
      key === "xsrf-token" ||
      key === "xsrf_token" ||
      key === "next-auth.csrf-token" ||
      key === "__host-next-auth.csrf-token" ||
      key === "__secure-next-auth.csrf-token"
    ) {
      const decoded = decodeURIComponent(value);
      return decoded.split("|")[0];
    }
    if (key.includes("csrf")) {
      const decoded = decodeURIComponent(value);
      return decoded.split("|")[0];
    }
  }
  return null;
}

function extractTokenFromSetCookie(setCookies: string[]) {
  if (setCookies.length === 0) return null;
  for (const part of setCookies) {
    const [cookiePair] = part.split(";");
    const token = extractTokenFromCookies(cookiePair);
    if (token) return token;
  }
  return null;
}

function normalizeCookiePairs(cookies: string[]) {
  return cookies
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean);
}

function mergeCookieHeader(existing: string | undefined, setCookies: string[]) {
  if (setCookies.length === 0) return existing;
  const map = new Map<string, string>();
  const consumePair = (pair: string) => {
    const index = pair.indexOf("=");
    if (index <= 0) return;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1);
    if (name) map.set(name, value);
  };

  if (existing) {
    existing
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(consumePair);
  }

  normalizeCookiePairs(setCookies).forEach(consumePair);

  if (map.size === 0) return existing;
  return Array.from(map.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function updateCookieFromResponse(
  res: Response,
  currentCookie: string | undefined
) {
  const setCookies = getSetCookieValues(res);
  return mergeCookieHeader(currentCookie, setCookies);
}

export type CsrfSession = {
  token: string;
  cookie?: string;
};

export async function getCsrfToken(): Promise<CsrfSession> {
  const defaultHeaders = {
    accept: "text/html,application/json,*/*",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    referer: `${UPSTREAM_BASE}/`,
  };

  const pageRes = await fetchWithTimeout(UPSTREAM_BASE, {
    method: "GET",
    headers: defaultHeaders,
    cache: "no-store",
  });
  let cookie = updateCookieFromResponse(pageRes, undefined);
  const pageHeaderToken = pageRes.headers.get("x-csrf-token");
  if (pageHeaderToken) {
    return { token: pageHeaderToken, cookie };
  }
  const pageSetCookieToken = extractTokenFromSetCookie(getSetCookieValues(pageRes));
  if (pageSetCookieToken) {
    return { token: pageSetCookieToken, cookie };
  }

  const pageHtml = await pageRes.text();
  const pageToken = extractCsrfTokenFromHtml(pageHtml);
  if (pageToken) return { token: pageToken, cookie };

  const statusRes = await fetchWithTimeout(`${UPSTREAM_BASE}/api/status`, {
    method: "GET",
    headers: {
      ...defaultHeaders,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    cache: "no-store",
  });

  cookie = updateCookieFromResponse(statusRes, cookie);
  const statusHeaderToken = statusRes.headers.get("x-csrf-token");
  if (statusHeaderToken) return { token: statusHeaderToken, cookie };

  const statusBody = await statusRes.text();
  try {
    const json = JSON.parse(statusBody);
    if (typeof json?.csrfToken === "string") return { token: json.csrfToken, cookie };
    if (typeof json?.token === "string") return { token: json.token, cookie };
  } catch {
    // continue
  }
  const statusToken = extractCsrfTokenFromHtml(statusBody);
  if (statusToken) return { token: statusToken, cookie };

  const res = await fetchWithTimeout(`${UPSTREAM_BASE}/api/csrf`, {
    method: "GET",
    headers: {
      ...defaultHeaders,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    cache: "no-store",
  });

  cookie = updateCookieFromResponse(res, cookie);
  const apiSetCookieToken = extractTokenFromSetCookie(getSetCookieValues(res));
  if (apiSetCookieToken) return { token: apiSetCookieToken, cookie };

  const body = await res.text();
  const headerToken = res.headers.get("x-csrf-token");

  if (headerToken) return { token: headerToken, cookie };

  try {
    const json = JSON.parse(body);
    if (typeof json?.csrfToken === "string") return { token: json.csrfToken, cookie };
    if (typeof json?.token === "string") return { token: json.token, cookie };
  } catch {
    // fall through to HTML parse
  }

  const htmlToken = extractCsrfTokenFromHtml(body);
  if (htmlToken) return { token: htmlToken, cookie };
  const cookieToken = extractTokenFromCookies(cookie);
  if (cookieToken) return { token: cookieToken, cookie };

  throw new Error("无法获取上游 CSRF Token");
}

export async function submitBatchVerification(ids: string[], cdk: string) {
  if (!cdk) throw new Error("UPSTREAM_CDK 未配置");

  const { token, cookie } = await getCsrfToken();
  const res = await fetchWithTimeout(`${UPSTREAM_BASE}/api/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-CSRF-Token": token,
      Origin: UPSTREAM_BASE,
      Referer: `${UPSTREAM_BASE}/`,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({
      verificationIds: ids,
      hCaptchaToken: cdk,
      programId: "google-student",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`上游请求失败: ${res.status} ${text}`);
  }
  if (!res.body) {
    throw new Error("上游未返回事件流");
  }
  return res.body;
}

export async function checkPendingStatus(checkToken: string) {
  const { token, cookie } = await getCsrfToken();
  const res = await fetchWithTimeout(`${UPSTREAM_BASE}/api/check-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CSRF-Token": token,
      Origin: UPSTREAM_BASE,
      Referer: `${UPSTREAM_BASE}/`,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ checkToken }),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: "error", message: text };
  }
}

export type SSEEvent = {
  event: string;
  data: string;
};

export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataBuffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex).trimEnd();
      buffer = buffer.slice(newlineIndex + 1);

      if (line === "") {
        if (dataBuffer) {
          yield { event: eventName, data: dataBuffer.trimEnd() };
        }
        eventName = "message";
        dataBuffer = "";
        continue;
      }

      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
        continue;
      }

      if (line.startsWith("data:")) {
        dataBuffer += line.slice(5).trimStart() + "\n";
      }
    }
  }

  if (dataBuffer) {
    yield { event: eventName, data: dataBuffer.trimEnd() };
  }
}
