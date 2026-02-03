import { extractVerificationId, validateVerificationId } from "@/lib/validation";
import {
  checkDuplicateVerification,
  createVerificationJob,
  processVerification,
} from "@/lib/verification";

type VerifyRequest = {
  links: string[];
  cardKeys: string[];
};

const MAX_LINKS = 20;
const MAX_REQUESTS = 10;
const WINDOW_MS = 60_000;

type RateRecord = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as unknown as {
  verifyRateLimit?: Map<string, RateRecord>;
};

const rateStore = globalForRateLimit.verifyRateLimit ?? new Map<string, RateRecord>();
globalForRateLimit.verifyRateLimit = rateStore;

function getClientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const record = rateStore.get(ip);
  if (!record || now > record.resetAt) {
    rateStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (record.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  record.count += 1;
  rateStore.set(ip, record);
  return { allowed: true, retryAfter: 0 };
}

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return Response.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  let payload: VerifyRequest;

  try {
    payload = (await request.json()) as VerifyRequest;
  } catch {
    return Response.json({ error: "无效的 JSON 请求体" }, { status: 400 });
  }

  const { links, cardKeys } = payload;
  if (!Array.isArray(links) || !Array.isArray(cardKeys)) {
    return Response.json({ error: "links 与 cardKeys 必须为数组" }, { status: 400 });
  }
  if (links.length > MAX_LINKS) {
    return Response.json(
      { error: `最多支持 ${MAX_LINKS} 条链接` },
      { status: 400 }
    );
  }
  if (links.length === 0 || links.length !== cardKeys.length) {
    return Response.json(
      { error: "links 与 cardKeys 数量不一致或为空" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      for (let i = 0; i < links.length; i += 1) {
        const link = links[i];
        const cardKey = cardKeys[i];
        const verificationId = extractVerificationId(link);

        if (!verificationId) {
          send("error", { index: i, message: "无法解析 verificationId" });
          continue;
        }

        const validationError = validateVerificationId(verificationId);
        if (validationError) {
          send("error", { index: i, message: validationError });
          continue;
        }

        const duplicate = await checkDuplicateVerification(verificationId);
        if (duplicate) {
          const skipConsume =
            /verification already completed/i.test(duplicate.resultMessage || "") ||
            /precheck_success/i.test(duplicate.resultMessage || "");
          send("duplicate", {
            index: i,
            jobId: duplicate.id,
            status: duplicate.status,
            resultUrl: duplicate.resultUrl,
            verificationId,
            message: duplicate.resultMessage,
            skipConsume,
          });
          continue;
        }

        try {
          const job = await createVerificationJob(link, cardKey);
          send("queued", { index: i, jobId: job.id, verificationId });

          const result = await processVerification(job.id);
          send("result", { index: i, jobId: job.id, ...result });
        } catch (error) {
          send("error", {
            index: i,
            message: error instanceof Error ? error.message : "创建任务失败",
          });
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
