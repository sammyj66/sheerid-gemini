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

  const { code } = await context.params;
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const jobCount = await prisma.verificationJob.count({
    where: { cardKeyCode: code },
  });
  if (jobCount > 0) {
    return NextResponse.json(
      { error: "该卡密已有验证记录，无法删除" },
      { status: 409 }
    );
  }

  try {
    await prisma.cardKey.delete({ where: { code } });
  } catch {
    return NextResponse.json({ error: "卡密不存在" }, { status: 404 });
  }

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
  let payload: { action?: string } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.action !== "revoke" && payload.action !== "restore") {
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

  return NextResponse.json({ success: true });
}
