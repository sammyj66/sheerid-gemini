import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAdmin, getClientIp } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";

const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const admin = await requireAdmin(request.headers);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit") || 20))
  );
  const skip = (page - 1) * limit;

  try {
    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.adminLog.count(),
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request.headers);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.adminLog.deleteMany();
    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
