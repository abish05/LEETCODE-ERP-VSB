import { handleError, requireAdmin } from "@/lib/api";
import { buildTemplateWorkbook } from "@/lib/import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const buffer = buildTemplateWorkbook();

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="leettrack-import-template.xlsx"',
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
