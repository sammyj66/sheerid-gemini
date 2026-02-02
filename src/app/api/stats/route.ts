import prisma from "@/lib/db";

function toDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const today = toDateKey();
  const stats = await prisma.dailyStats.findUnique({ where: { date: today } });

  return Response.json({
    todaySuccess: stats?.successCount ?? 0,
    todayFail: stats?.failCount ?? 0,
    todayTotal: stats?.totalCount ?? 0,
  });
}
