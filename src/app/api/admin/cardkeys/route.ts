import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAdmin, getClientIp } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { generateKeys } from "@/lib/cardkey";
import { buildCardKeyWhere, getCardKeyStats } from "@/lib/admin/cardkeys";

const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const admin = await requireAdmin(request.headers);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query = searchParams.get("q");
  const includeStats = searchParams.get("includeStats") === "1";
  const fetchAll = searchParams.get("all") === "1";
  const fields = searchParams.get("fields");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit") || 20))
  );
  const skip = fetchAll ? 0 : (page - 1) * limit;

  const where = buildCardKeyWhere({ status, query });

  try {
    const select =
      fields === "code"
        ? { code: true }
        : undefined;

    const [keys, total, stats] = await Promise.all([
      prisma.cardKey.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: fetchAll ? undefined : limit,
        ...(select ? { select } : {}),
      }),
      prisma.cardKey.count({ where }),
      includeStats ? getCardKeyStats(where) : Promise.resolve(null),
    ]);

    await logAdminAction({
      action: "list_cardkeys",
      detail: `status=${status || "ALL"} q=${query || ""} page=${page}`,
      ip: getClientIp(request.headers),
    });

    return NextResponse.json({
      keys,
      total,
      page,
      limit,
      stats,
    });
  } catch (error) {
    console.error("admin cardkeys list failed", error);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request.headers);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    count?: number;
    expiresAt?: string;
    note?: string;
    batchNo?: string;
    maxUses?: number;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const count = Number(payload.count || 0);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return NextResponse.json(
      { error: "count 必须为 1-100 的整数" },
      { status: 400 }
    );
  }

  const maxUses = Number(payload.maxUses ?? 1);
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) {
    return NextResponse.json(
      { error: "maxUses 必须为 1-1000 的整数" },
      { status: 400 }
    );
  }

  let expiresAt: Date | undefined;
  if (payload.expiresAt) {
    const parsed = new Date(payload.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "expiresAt 格式错误" }, { status: 400 });
    }
    expiresAt = parsed;
  }

  try {
    const keys = await generateKeys(count, {
      expiresAt,
      note: payload.note,
      batchNo: payload.batchNo,
      maxUses,
    });

    await logAdminAction({
      action: "create_cardkeys",
      detail: `count=${count} batch=${payload.batchNo || ""}`,
      ip: getClientIp(request.headers),
    });

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("admin cardkeys create failed", error);
    return NextResponse.json({ error: "生成失败" }, { status: 500 });
  }
}
