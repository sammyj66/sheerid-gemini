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

export async function POST(request: Request) {
  let payload: VerifyRequest;
  const safeErrors = new Set([
    "卡密不存在",
    "卡密已过期",
    "卡密不可用或已被锁定",
    "卡密已消耗",
  ]);

  try {
    payload = (await request.json()) as VerifyRequest;
  } catch {
    return Response.json({ error: "无效的 JSON 请求体" }, { status: 400 });
  }

  const { links, cardKeys } = payload;
  if (!Array.isArray(links) || !Array.isArray(cardKeys)) {
    return Response.json({ error: "links 与 cardKeys 必须为数组" }, { status: 400 });
  }
  if (links.length === 0 || links.length !== cardKeys.length) {
    return Response.json(
      { error: "links 与 cardKeys 数量不一致或为空" },
      { status: 400 }
    );
  }
  if (
    links.some((link) => typeof link !== "string" || !link.trim()) ||
    cardKeys.some((key) => typeof key !== "string" || !key.trim())
  ) {
    return Response.json(
      { error: "links 与 cardKeys 必须为非空字符串" },
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
        const link = String(links[i]).trim();
        const cardKey = String(cardKeys[i]).trim();
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
          if (error instanceof Error && !safeErrors.has(error.message)) {
            console.error("verify error", error);
          }
          send("error", {
            index: i,
            message:
              error instanceof Error && safeErrors.has(error.message)
                ? error.message
                : "创建任务失败",
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
