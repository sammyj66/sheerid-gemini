import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAdmin, getClientIp } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";

type Context = {
  params: Promise<{ code: string }>;
};

export async function DELETE(request: Request, context: Context) {
  const admin = await requireAdmin(request.headers);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true" || searchParams.get("force") === "1";

  const { code } = await context.params;
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const cardKey = await prisma.cardKey.findUnique({ where: { code } });
  if (!cardKey) {
    return NextResponse.json({ error: "卡密不存在" }, { status: 404 });
  }

  const jobCount = await prisma.verificationJob.count({
    where: { cardKeyCode: code },
  });

  if (jobCount > 0 && !force) {
    return NextResponse.json(
      {
        error: "该卡密已有验证记录，确认后可强制删除",
        jobCount,
        usedCount: cardKey.usedCount,
        remainingUses: cardKey.maxUses - cardKey.usedCount,
      },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    if (jobCount > 0) {
      await tx.verificationJob.deleteMany({ where: { cardKeyCode: code } });
    }
    await tx.cardKey.delete({ where: { code } });
  });

  await logAdminAction({
    action: "delete_cardkey",
    detail: `code=${code}`,
    ip: getClientIp(request.headers),
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request, context: Context) {
  const admin = await requireAdmin(request.headers);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await context.params;
  let payload: { action?: string; maxUses?: number; newCode?: string; expiresAt?: string | null } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    payload.action !== "revoke" &&
    payload.action !== "restore" &&
    payload.action !== "set_uses" &&
    payload.action !== "set_expires" &&
    payload.action !== "set_code"
  ) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  if (payload.action === "revoke") {
    try {
      await prisma.cardKey.update({
        where: { code },
        data: { status: "REVOKED" },
      });
    } catch {
      return NextResponse.json({ error: "卡密不存在" }, { status: 404 });
    }

    await logAdminAction({
      action: "revoke_cardkey",
      detail: `code=${code}`,
      ip: getClientIp(request.headers),
    });
  }

  if (payload.action === "restore") {
    const restored = await prisma.cardKey.updateMany({
      where: { code, status: "REVOKED" },
      data: {
        status: "UNUSED",
        consumedAt: null,
        consumedBy: null,
        usedCount: 0,
        lockedAt: null,
        lockJobId: null,
      },
    });
    if (restored.count === 0) {
      return NextResponse.json(
        { error: "仅支持恢复已作废的卡密" },
        { status: 409 }
      );
    }
    await logAdminAction({
      action: "restore_cardkey",
      detail: `code=${code}`,
      ip: getClientIp(request.headers),
    });
  }

  if (payload.action === "set_uses") {
    const maxUses = Number(payload.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) {
      return NextResponse.json(
        { error: "maxUses 必须为 1-1000 的整数" },
        { status: 400 }
      );
    }

    const cardKey = await prisma.cardKey.findUnique({ where: { code } });
    if (!cardKey) {
      return NextResponse.json({ error: "卡密不存在" }, { status: 404 });
    }
    if (cardKey.status === "LOCKED") {
      return NextResponse.json({ error: "卡密正在使用中" }, { status: 409 });
    }

    const nextUsedCount = Math.min(cardKey.usedCount, maxUses);
    let nextStatus = cardKey.status;
    let consumedAt = cardKey.consumedAt;

    if (cardKey.status === "UNUSED" || cardKey.status === "CONSUMED") {
      if (nextUsedCount >= maxUses) {
        nextStatus = "CONSUMED";
        consumedAt = consumedAt ?? new Date();
      } else {
        nextStatus = "UNUSED";
        consumedAt = null;
      }
    }

    const updated = await prisma.cardKey.update({
      where: { code },
      data: {
        maxUses,
        usedCount: nextUsedCount,
        status: nextStatus,
        consumedAt,
      },
    });

    await logAdminAction({
      action: "update_cardkey_uses",
      detail: `code=${code} maxUses=${maxUses} usedCount=${nextUsedCount}`,
      ip: getClientIp(request.headers),
    });

    return NextResponse.json({ success: true, cardKey: updated });
  }

  if (payload.action === "set_expires") {
    let expiresAt: Date | null = null;
    if (payload.expiresAt) {
      const parsed = new Date(payload.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "expiresAt 格式错误" }, { status: 400 });
      }
      expiresAt = parsed;
    }

    const updated = await prisma.cardKey.update({
      where: { code },
      data: { expiresAt },
    });

    await logAdminAction({
      action: "update_cardkey_expires",
      detail: `code=${code} expiresAt=${expiresAt ? expiresAt.toISOString() : ""}`,
      ip: getClientIp(request.headers),
    });

    return NextResponse.json({ success: true, cardKey: updated });
  }

  if (payload.action === "set_code") {
    const newCode = String(payload.newCode || "").trim();
    if (!newCode) {
      return NextResponse.json({ error: "卡密不能为空" }, { status: 400 });
    }
    if (newCode === code) {
      return NextResponse.json({ success: true });
    }

    const cardKey = await prisma.cardKey.findUnique({ where: { code } });
    if (!cardKey) {
      return NextResponse.json({ error: "卡密不存在" }, { status: 404 });
    }
    if (cardKey.status === "LOCKED") {
      return NextResponse.json({ error: "卡密正在使用中" }, { status: 409 });
    }

    const existing = await prisma.cardKey.findUnique({ where: { code: newCode } });
    if (existing) {
      return NextResponse.json({ error: "卡密已存在" }, { status: 409 });
    }

    const jobCount = await prisma.verificationJob.count({
      where: { cardKeyCode: code },
    });
    if (jobCount > 0) {
      return NextResponse.json(
        { error: "该卡密已有验证记录，无法修改" },
        { status: 409 }
      );
    }

    const updated = await prisma.cardKey.update({
      where: { code },
      data: { code: newCode },
    });

    await logAdminAction({
      action: "update_cardkey_code",
      detail: `code=${code} newCode=${newCode}`,
      ip: getClientIp(request.headers),
    });

    return NextResponse.json({ success: true, cardKey: updated });
  }

  return NextResponse.json({ success: true });
}
