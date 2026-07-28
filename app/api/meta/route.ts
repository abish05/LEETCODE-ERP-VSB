import { handleError, ok, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Distinct filter values, derived from the data that is actually imported. */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const [departments, years, sections] = await Promise.all([
      prisma.user.findMany({
        distinct: ["department"],
        select: { department: true },
        orderBy: { department: "asc" },
      }),
      prisma.user.findMany({
        distinct: ["year"],
        select: { year: true },
        where: { year: { not: null } },
        orderBy: { year: "asc" },
      }),
      prisma.user.findMany({
        distinct: ["section"],
        select: { section: true },
        where: { section: { not: null } },
        orderBy: { section: "asc" },
      }),
    ]);

    return ok({
      departments: departments.map((row) => row.department),
      years: years.map((row) => row.year).filter(Boolean) as string[],
      sections: sections.map((row) => row.section).filter(Boolean) as string[],
    });
  } catch (error) {
    return handleError(error);
  }
}
