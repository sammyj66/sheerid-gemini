import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAdmin, getClientIp } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { buildCardKeyWhere } from "@/lib/admin/cardkeys";

function toCsvValue(value: string | null | undefined) {
  let safe = value ?? "";
  if (/^[=+\-@]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(",") || safe.includes("\"") || safe.includes("\n")) {
    return `"${safe.replace(/"/g, "\"\"")}"`;
  }
  return safe;
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request.headers);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query = searchParams.get("q");
  const format = (searchParams.get("format") || "csv").toLowerCase();

  const where = buildCardKeyWhere({ status, query });
  const keys = await prisma.cardKey.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  await logAdminAction({
    action: "export_cardkeys",
    detail: `format=${format} status=${status || "ALL"} q=${query || ""}`,
    ip: getClientIp(request.headers),
  });

  if (format === "json") {
    return NextResponse.json({ keys });
  }

  const header = [
    "code",
    "status",
    "maxUses",
    "usedCount",
    "remaining",
    "batchNo",
    "note",
    "createdAt",
    "expiresAt",
    "consumedAt",
  ];
  const rows = keys.map((key) =>
    [
      key.code,
      key.status,
      String(key.maxUses ?? 1),
      String(key.usedCount ?? 0),
      String((key.maxUses ?? 1) - (key.usedCount ?? 0)),
      key.batchNo,
      key.note,
      key.createdAt.toISOString(),
      key.expiresAt?.toISOString() || "",
      key.consumedAt?.toISOString() || "",
    ].map((value) => toCsvValue(value)).join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");
  const filename = `cardkeys-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
