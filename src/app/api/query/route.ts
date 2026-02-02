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

  const job = await prisma.verificationJob.findFirst({
    where: {
      ...(cardKey ? { cardKeyCode: cardKey } : {}),
      ...(verificationId ? { verificationId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  if (!job) {
    return Response.json({ found: false });
  }

  return Response.json({
    found: true,
    status: job.status,
    resultUrl: job.resultUrl,
    verifiedAt: job.finishedAt,
    cardKeyCode: job.cardKeyCode,
  });
}
