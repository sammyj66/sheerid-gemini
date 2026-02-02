import prisma from "@/lib/db";

export type CardKeyStatus =
  | "UNUSED"
  | "LOCKED"
  | "CONSUMED"
  | "REVOKED"
  | "EXPIRED";

export type CardKeyQuery = {
  status?: string | null;
  query?: string | null;
};

export function buildCardKeyWhere({ status, query }: CardKeyQuery) {
  const where: Record<string, unknown> = {};
  const normalizedStatus = status ? status.toUpperCase() : null;
  if (normalizedStatus && normalizedStatus !== "ALL") {
    where.status = normalizedStatus;
  }
  if (query) {
    where.OR = [
      { code: { contains: query, mode: "insensitive" } },
      { batchNo: { contains: query, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function getCardKeyStats(where: Record<string, unknown>) {
  const [total, unused, locked, consumed, revoked, expired] = await Promise.all([
    prisma.cardKey.count({ where }),
    prisma.cardKey.count({ where: { ...where, status: "UNUSED" } }),
    prisma.cardKey.count({ where: { ...where, status: "LOCKED" } }),
    prisma.cardKey.count({ where: { ...where, status: "CONSUMED" } }),
    prisma.cardKey.count({ where: { ...where, status: "REVOKED" } }),
    prisma.cardKey.count({ where: { ...where, status: "EXPIRED" } }),
  ]);
  return { total, unused, locked, consumed, revoked, expired };
}
