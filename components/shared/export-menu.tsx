"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Table2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportCSV, exportExcel, exportPDF, type ExportRow } from "@/lib/export";

export function ExportMenu({
  /** Resolves the full row set — usually a fetch with `pageSize=all`. */
  getRows,
  baseName,
  title,
  subtitle,
  disabled,
}: {
  getRows: () => Promise<ExportRow[]> | ExportRow[];
  baseName: string;
  title: string;
  subtitle?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function run(format: "xlsx" | "csv" | "pdf") {
    setBusy(true);
    const toastId = toast.loading(`Preparing ${format.toUpperCase()} export…`);
    try {
      const rows = await getRows();

      if (rows.length === 0) {
        toast.error("There is nothing to export with the current filters.", {
          id: toastId,
        });
        return;
      }

      if (format === "csv") exportCSV(rows, baseName);
      else if (format === "xlsx") await exportExcel(rows, baseName, title);
      else await exportPDF(rows, baseName, title, subtitle);

      toast.success(
        `Exported ${rows.length.toLocaleString("en-IN")} row${rows.length === 1 ? "" : "s"}.`,
        { id: toastId },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The export failed.",
        { id: toastId },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Download />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Download this report</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => run("xlsx")}>
          <FileSpreadsheet />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("csv")}>
          <Table2 />
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("pdf")}>
          <FileText />
          PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
