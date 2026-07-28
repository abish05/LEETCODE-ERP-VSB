import { handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const unread = await prisma.notification.count({ where: { read: false } });
    return ok({ unread });
  } catch (error) {
    return handleError(error);
  }
}
