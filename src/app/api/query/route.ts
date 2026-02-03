import prisma from "@/lib/db";

type QueryRequest = {
  cardKey?: string;
  verificationId?: string;
};

export async function POST(request: Request) {
  let payload: QueryRequest;

  try {
    payload = (await request.json()) as QueryRequest;
  } catch {
    return Response.json({ error: "无效的 JSON 请求体" }, { status: 400 });
  }

  const { cardKey, verificationId } = payload;
  if (!cardKey && !verificationId) {
    return Response.json(
      { error: "cardKey 或 verificationId 至少提供一个" },
      { status: 400 }
    );
  }

  let cardKeyData = cardKey
    ? await prisma.cardKey.findUnique({ where: { code: cardKey } })
    : null;

  const job = verificationId
    ? await prisma.verificationJob.findFirst({
        where: {
          ...(cardKey ? { cardKeyCode: cardKey } : {}),
          ...(verificationId ? { verificationId } : {}),
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (!job && !cardKeyData) {
    return Response.json({ found: false });
  }

  if (job && !cardKeyData) {
    cardKeyData = await prisma.cardKey.findUnique({
      where: { code: job.cardKeyCode },
    });
  }

  return Response.json({
    found: true,
    status: job?.status ?? cardKeyData?.status,
    resultUrl: job?.resultUrl ?? null,
    verifiedAt: job?.finishedAt ?? null,
    cardKeyCode: job?.cardKeyCode ?? cardKeyData?.code ?? null,
    maxUses: cardKeyData?.maxUses,
    usedCount: cardKeyData?.usedCount,
    remainingUses:
      cardKeyData ? cardKeyData.maxUses - cardKeyData.usedCount : undefined,
  });
}
