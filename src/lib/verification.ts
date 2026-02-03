import prisma from "./db";
import { extractVerificationId, validateVerificationId } from "./validation";
import {
  checkPendingStatus,
  parseSSEStream,
  submitBatchVerification,
} from "./upstream";
import { consumeKey, unlockKey } from "./cardkey";

export type VerificationResultStatus = "SUCCESS" | "FAIL" | "ERROR" | "TIMEOUT";

export type VerificationResult = {
  status: VerificationResultStatus;
  resultUrl?: string;
  message?: string;
  errorCode?: string;
  verificationId?: string;
  upstreamReqId?: string;
  skipConsume?: boolean;
};

const VERIFY_TIMEOUT_MS = 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStep(payload: Record<string, unknown>) {
  return String(
    payload.currentStep ??
      payload.current_step ??
      payload.status ??
      payload.state ??
      payload.result ??
      ""
  ).toLowerCase();
}

function isAlreadyCompleted(payload: Record<string, unknown>) {
  const step = getStep(payload);
  if (step === "precheck_success" || step === "completed") {
    return true;
  }
  const message = String(payload.message ?? "");
  return /verification already completed/i.test(message);
}

function isReviewPending(payload: Record<string, unknown>) {
  if (isAlreadyCompleted(payload)) return false;
  const step = getStep(payload);
  if (["pending", "processing", "queued", "review"].includes(step)) {
    return true;
  }
  const message = String(payload.message ?? "");
  return /document uploaded|waiting for review|awaiting review/i.test(message);
}

function normalizeResult(payload: Record<string, unknown>): VerificationResult {
  const statusRaw = String(
    payload.status ?? payload.state ?? payload.result ?? payload.currentStep ?? ""
  ).toUpperCase();
  const message = String(payload.message ?? "");
  const alreadyCompleted = isAlreadyCompleted(payload);
  const isSuccess =
    payload.success === true ||
    statusRaw === "SUCCESS" ||
    statusRaw === "PRECHECK_SUCCESS" ||
    /verification already completed/i.test(message) ||
    Boolean(payload.resultUrl || payload.url);

  let status: VerificationResultStatus = "FAIL";
  if (isSuccess) status = "SUCCESS";
  else if (statusRaw === "ERROR") status = "ERROR";
  else if (statusRaw === "TIMEOUT") status = "TIMEOUT";

  return {
    status,
    resultUrl: (payload.resultUrl || payload.url) as string | undefined,
    message: payload.message as string | undefined,
    errorCode: payload.errorCode as string | undefined,
    verificationId: payload.verificationId as string | undefined,
    upstreamReqId: payload.upstreamReqId as string | undefined,
    skipConsume: alreadyCompleted,
  };
}

function toDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function updateDailyStats(status: VerificationResultStatus) {
  const date = toDateKey();
  const isSuccess = status === "SUCCESS";
  const isFail = status !== "SUCCESS";

  await prisma.dailyStats.upsert({
    where: { date },
    create: {
      date,
      successCount: isSuccess ? 1 : 0,
      failCount: isFail ? 1 : 0,
      totalCount: 1,
    },
    update: {
      successCount: { increment: isSuccess ? 1 : 0 },
      failCount: { increment: isFail ? 1 : 0 },
      totalCount: { increment: 1 },
    },
  });
}

export async function checkDuplicateVerification(verificationId: string) {
  if (!verificationId) return null;
  return prisma.verificationJob.findFirst({
    where: {
      verificationId,
      status: { in: ["QUEUED", "PROCESSING", "PENDING", "SUCCESS"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createVerificationJob(
  sheeridUrl: string,
  cardKeyCode: string
) {
  const verificationId = extractVerificationId(sheeridUrl);

  return prisma.$transaction(async (tx) => {
    const cardKey = await tx.cardKey.findUnique({ where: { code: cardKeyCode } });
    if (!cardKey) {
      throw new Error("卡密不存在");
    }
    if (cardKey.status !== "UNUSED") {
      throw new Error("卡密不可用或已被锁定");
    }
    if (cardKey.usedCount >= cardKey.maxUses) {
      throw new Error("卡密已消耗");
    }

    const locked = await tx.cardKey.updateMany({
      where: {
        code: cardKeyCode,
        status: "UNUSED",
        usedCount: cardKey.usedCount,
        maxUses: cardKey.maxUses,
      },
      data: {
        status: "LOCKED",
        lockedAt: new Date(),
      },
    });

    if (locked.count === 0) {
      throw new Error("卡密不可用或已被锁定");
    }

    const job = await tx.verificationJob.create({
      data: {
        sheeridUrl,
        cardKeyCode,
        verificationId,
        status: "QUEUED",
      },
    });

    await tx.cardKey.update({
      where: { code: cardKeyCode },
      data: { lockJobId: job.id },
    });

    return job;
  });
}

export async function handleVerificationResult(
  jobId: string,
  result: VerificationResult
) {
  const finishedAt = new Date();
  const job = await prisma.verificationJob.findUnique({ where: { id: jobId } });
  const durationMs = job?.startedAt
    ? finishedAt.getTime() - job.startedAt.getTime()
    : null;

  await prisma.verificationJob.update({
    where: { id: jobId },
    data: {
      status: result.status,
      resultMessage: result.message ?? null,
      resultUrl: result.resultUrl ?? null,
      errorCode: result.errorCode ?? null,
      finishedAt,
      durationMs,
    },
  });

  if (result.status === "SUCCESS") {
    if (result.skipConsume) {
      await unlockKey(job!.cardKeyCode);
    } else {
      await consumeKey(job!.cardKeyCode);
    }
  } else {
    await unlockKey(job!.cardKeyCode);
  }

  if (!result.skipConsume) {
    await updateDailyStats(result.status);
  }
  return result;
}

export async function processVerification(jobId: string) {
  const job = await prisma.verificationJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("任务不存在");

  const startedAt = new Date();
  let verificationId = job.verificationId ?? extractVerificationId(job.sheeridUrl);

  if (!verificationId) {
    return handleVerificationResult(jobId, {
      status: "ERROR",
      message: "无法解析 verificationId",
    });
  }

  const validationError = validateVerificationId(verificationId);
  if (validationError) {
    return handleVerificationResult(jobId, {
      status: "ERROR",
      message: validationError,
    });
  }

  await prisma.verificationJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      startedAt,
      verificationId,
    },
  });

  const cdk = process.env.UPSTREAM_CDK || "";
  if (!cdk) {
    return handleVerificationResult(jobId, {
      status: "ERROR",
      message: "UPSTREAM_CDK 未配置",
    });
  }

  const deadline = Date.now() + VERIFY_TIMEOUT_MS;
  let checkToken: string | undefined;
  let upstreamReqId: string | undefined;
  let pendingDetected = false;

  try {
    const stream = await submitBatchVerification([verificationId], cdk);

    for await (const event of parseSSEStream(stream)) {
      const payload = (() => {
        try {
          return JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          return { message: event.data };
        }
      })();

      if (payload.upstreamReqId && !upstreamReqId) {
        upstreamReqId = payload.upstreamReqId as string;
        await prisma.verificationJob.update({
          where: { id: jobId },
          data: { upstreamReqId },
        });
      }

      if (event.event === "processing") {
        await prisma.verificationJob.update({
          where: { id: jobId },
          data: { status: "PROCESSING" },
        });
      }

      if (event.event === "pending") {
        checkToken = (payload.checkToken || payload.token) as
          | string
          | undefined;
        await prisma.verificationJob.update({
          where: { id: jobId },
          data: { status: "PENDING" },
        });
      }

      if (event.event === "result") {
        if (isReviewPending(payload)) {
          pendingDetected = true;
          checkToken ||= (payload.checkToken || payload.token) as
            | string
            | undefined;
          await prisma.verificationJob.update({
            where: { id: jobId },
            data: {
              status: "PENDING",
              resultMessage: (payload.message as string | undefined) ?? null,
            },
          });
          break;
        }

        const result = normalizeResult(payload);
        result.verificationId ||= verificationId;
        result.upstreamReqId ||= upstreamReqId;
        return handleVerificationResult(jobId, result);
      }
    }
  } catch (error) {
    return handleVerificationResult(jobId, {
      status: "ERROR",
      message: error instanceof Error ? error.message : "上游请求失败",
    });
  }

  if (checkToken) {
    while (Date.now() < deadline) {
      const pending = await checkPendingStatus(checkToken);
      const step = getStep(
        typeof pending === "object" && pending ? pending : {}
      );
      if (["pending", "processing", "queued"].includes(step)) {
        await sleep(2000);
        continue;
      }

      const result = normalizeResult(
        typeof pending === "object" && pending ? pending : {}
      );
      result.verificationId ||= verificationId;
      result.upstreamReqId ||= upstreamReqId;
      return handleVerificationResult(jobId, result);
    }
  }

  if (pendingDetected) {
    return handleVerificationResult(jobId, {
      status: "TIMEOUT",
      message: "等待审核中，未获取最终状态",
    });
  }

  return handleVerificationResult(jobId, {
    status: "TIMEOUT",
    message: "60 秒内未获得结果",
  });
}
