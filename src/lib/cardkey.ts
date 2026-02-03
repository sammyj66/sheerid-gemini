import { nanoid } from "nanoid";
import prisma from "./db";

type GenerateKeyOptions = {
  expiresAt?: Date;
  note?: string;
  batchNo?: string;
  maxUses?: number;
};

export async function generateKeys(count: number, options: GenerateKeyOptions = {}) {
  if (!Number.isInteger(count) || count <= 0) return [];
  const data = Array.from({ length: count }, () => ({
    code: nanoid(16),
    expiresAt: options.expiresAt,
    note: options.note,
    batchNo: options.batchNo,
    maxUses: options.maxUses ?? 1,
  }));

  await prisma.cardKey.createMany({ data });
  return data.map((item) => item.code);
}

export async function lockKey(code: string, jobId: string) {
  const cardKey = await prisma.cardKey.findUnique({ where: { code } });
  if (!cardKey) {
    throw new Error("卡密不存在");
  }
  if (cardKey.expiresAt && cardKey.expiresAt.getTime() < Date.now()) {
    await prisma.cardKey.update({
      where: { code },
      data: { status: "EXPIRED" },
    });
    throw new Error("卡密已过期");
  }
  if (cardKey.status !== "UNUSED") {
    throw new Error("卡密不可用或已被锁定");
  }
  if (cardKey.usedCount >= cardKey.maxUses) {
    throw new Error("卡密已消耗");
  }

  const result = await prisma.cardKey.updateMany({
    where: {
      code,
      status: "UNUSED",
      usedCount: cardKey.usedCount,
      maxUses: cardKey.maxUses,
    },
    data: {
      status: "LOCKED",
      lockedAt: new Date(),
      lockJobId: jobId,
    },
  });

  if (result.count === 0) {
    throw new Error("卡密不可用或已被锁定");
  }
}

export async function consumeKey(code: string) {
  const cardKey = await prisma.cardKey.findUnique({ where: { code } });
  if (!cardKey || cardKey.status !== "LOCKED") {
    throw new Error("卡密未锁定，无法消耗");
  }

  const nextUsedCount = cardKey.usedCount + 1;
  const fullyConsumed = nextUsedCount >= cardKey.maxUses;

  const result = await prisma.cardKey.updateMany({
    where: { code, status: "LOCKED" },
    data: {
      usedCount: nextUsedCount,
      status: fullyConsumed ? "CONSUMED" : "UNUSED",
      consumedAt: fullyConsumed ? new Date() : null,
      lockedAt: null,
      lockJobId: null,
    },
  });

  if (result.count === 0) {
    throw new Error("卡密未锁定，无法消耗");
  }
}

export async function unlockKey(code: string) {
  const result = await prisma.cardKey.updateMany({
    where: { code, status: "LOCKED" },
    data: {
      status: "UNUSED",
      lockedAt: null,
      lockJobId: null,
    },
  });

  if (result.count === 0) {
    throw new Error("卡密未锁定，无法释放");
  }
}

export async function revokeKey(code: string) {
  await prisma.cardKey.update({
    where: { code },
    data: {
      status: "REVOKED",
    },
  });
}

export async function getKeyByCode(code: string) {
  return prisma.cardKey.findUnique({ where: { code } });
}
