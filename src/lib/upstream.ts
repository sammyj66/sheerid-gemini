const UPSTREAM_BASE = "https://neigui.1key.me";
const UPSTREAM_TIMEOUT_MS = 60_000;

let csrfCookie: string | undefined;

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
    html.match(/csrf-token["']?\s*[:=]\s*["']([^"']+)["']/i);
  if (inlineMatch) return inlineMatch[1];
  return null;
}

function updateCookieFromResponse(res: Response) {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return;
  csrfCookie = setCookie
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

export async function getCsrfToken(): Promise<string> {
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

  updateCookieFromResponse(pageRes);

  const pageHtml = await pageRes.text();
  const pageToken = extractCsrfTokenFromHtml(pageHtml);
  if (pageToken) return pageToken;

  const res = await fetchWithTimeout(`${UPSTREAM_BASE}/api/csrf`, {
    method: "GET",
    headers: defaultHeaders,
    cache: "no-store",
  });

  updateCookieFromResponse(res);

  const body = await res.text();
  const headerToken = res.headers.get("x-csrf-token");

  if (headerToken) return headerToken;

  try {
    const json = JSON.parse(body);
    if (typeof json?.csrfToken === "string") return json.csrfToken;
    if (typeof json?.token === "string") return json.token;
  } catch {
    // fall through to HTML parse
  }

  const htmlToken = extractCsrfTokenFromHtml(body);
  if (htmlToken) return htmlToken;

  throw new Error("无法获取上游 CSRF Token");
}

export async function submitBatchVerification(ids: string[], cdk: string) {
  if (!cdk) throw new Error("UPSTREAM_CDK 未配置");

  const csrfToken = await getCsrfToken();
  const res = await fetchWithTimeout(`${UPSTREAM_BASE}/api/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-CSRF-Token": csrfToken,
      Origin: UPSTREAM_BASE,
      Referer: `${UPSTREAM_BASE}/`,
      ...(csrfCookie ? { Cookie: csrfCookie } : {}),
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
  const csrfToken = await getCsrfToken();
  const res = await fetchWithTimeout(`${UPSTREAM_BASE}/api/check-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CSRF-Token": csrfToken,
      Origin: UPSTREAM_BASE,
      Referer: `${UPSTREAM_BASE}/`,
      ...(csrfCookie ? { Cookie: csrfCookie } : {}),
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
