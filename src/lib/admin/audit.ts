import prisma from "@/lib/db";

type AuditPayload = {
  action: string;
  detail?: string;
  ip?: string;
};

export async function logAdminAction({ action, detail, ip }: AuditPayload) {
  try {
    await prisma.adminLog.create({
      data: {
        action,
        detail,
        ip,
      },
    });
  } catch {
    // Avoid blocking admin operations when logging fails.
  }
}
