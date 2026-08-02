"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Copy,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { SyncButton } from "@/components/layout/sync-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/misc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IMPORT_TEMPLATE_HEADERS } from "@/lib/constants";
import { useApi } from "@/lib/hooks";
import type { ImportSummary } from "@/lib/types";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

interface HistoryRow {
  id: string;
  fileName: string;
  totalRows: number;
  successful: number;
  updated: number;
  duplicates: number;
  invalid: number;
  createdAt: string;
}

export function ImportView() {
  const [file, setFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: history, mutate: refreshHistory } =
    useApi<{ rows: HistoryRow[] }>("/api/import");

  function pick(next: File | null) {
    if (!next) return;
    const name = next.name.toLowerCase();
    if (![".xlsx", ".xls", ".csv"].some((ext) => name.endsWith(ext))) {
      toast.error("Choose an .xlsx, .xls or .csv file.");
      return;
    }
    setFile(next);
    setResult(null);
    setError(null);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setError(null);

    const body = new FormData();
    body.append("file", file);
    body.append("updateExisting", String(updateExisting));

    try {
      const response = await fetch("/api/import", { method: "POST", body });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "The import failed.");
      }

      setResult(payload as ImportSummary);
      refreshHistory();

      const added = payload.created + payload.updated;
      if (added > 0) {
        toast.success(
          `${formatNumber(payload.created)} added, ${formatNumber(payload.updated)} updated.`,
        );
      } else {
        toast.warning("No records were added. Check the issues listed below.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "The import failed.";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="animate-in-up">
      <PageHeader
        title="Bulk Import"
        description="Upload one spreadsheet to register every student and staff member. They never need to log in."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/import/template" download>
              <Download />
              Download template
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Uploader ─────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Upload spreadsheet</CardTitle>
              <CardDescription>
                Accepts .xlsx, .xls and .csv up to 8 MB. Column headings are
                matched loosely, so &ldquo;Reg No&rdquo; and &ldquo;Register
                Number&rdquo; both work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  pick(event.dataTransfer.files?.[0] ?? null);
                }}
                className={cn(
                  "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-border bg-secondary/30",
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => pick(event.target.files?.[0] ?? null)}
                  className="hidden"
                  id="import-file"
                />

                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="size-10 text-primary" />
                    <div>
                      <p className="font-semibold">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                      >
                        Choose a different file
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={reset}
                        disabled={uploading}
                      >
                        <X />
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <CloudUpload className="size-10 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">
                        Drop your spreadsheet here
                      </p>
                      <p className="text-sm text-muted-foreground">
                        or choose a file from your computer
                      </p>
                    </div>
                    <Button
                      variant="navy"
                      size="sm"
                      onClick={() => inputRef.current?.click()}
                    >
                      Select file
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id="updateExisting"
                    checked={updateExisting}
                    onCheckedChange={setUpdateExisting}
                  />
                  <div>
                    <Label htmlFor="updateExisting">
                      Update existing records
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When a register number already exists, overwrite it instead
                      of counting it as a duplicate.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={upload}
                disabled={!file || uploading}
                className="w-full"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <CloudUpload />
                    Import users
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {error ? (
            <Card className="border-destructive/30 bg-destructive/5 text-foreground">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">
                    Import Failed
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {error}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {result ? <ImportResult result={result} /> : null}
        </div>

        {/* ── Guidance + history ───────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expected columns</CardTitle>
              <CardDescription>
                Only the first four are required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {IMPORT_TEMPLATE_HEADERS.map((header, index) => (
                <div
                  key={header}
                  className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-1.5 text-sm"
                >
                  <span className="font-medium">{header}</span>
                  {index < 3 || header === "LeetCode Username" ? (
                    <Badge variant="destructive">required</Badge>
                  ) : (
                    <Badge variant="muted">optional</Badge>
                  )}
                </div>
              ))}
              <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
                Set <strong>Role</strong> to <em>Student</em> or{" "}
                <em>Staff</em>. For staff, leave Year and Section blank or use a
                dash. The LeetCode username is the handle from{" "}
                <code className="rounded bg-secondary px-1">
                  leetcode.com/u/&lt;username&gt;
                </code>{" "}
                — a full profile URL is accepted too.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" />
                Recent imports
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(history?.rows.length ?? 0) === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">
                  No imports yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {history!.rows.map((row) => (
                    <li key={row.id} className="px-5 py-3">
                      <p className="truncate text-sm font-medium">
                        {row.fileName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Badge variant="success">
                          {formatNumber(row.successful)} added
                        </Badge>
                        {row.updated > 0 ? (
                          <Badge variant="navy">
                            {formatNumber(row.updated)} updated
                          </Badge>
                        ) : null}
                        {row.duplicates > 0 ? (
                          <Badge variant="warning">
                            {formatNumber(row.duplicates)} duplicate
                          </Badge>
                        ) : null}
                        {row.invalid > 0 ? (
                          <Badge variant="destructive">
                            {formatNumber(row.invalid)} invalid
                          </Badge>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ImportResult({ result }: { result: ImportSummary }) {
  const succeeded = result.created + result.updated;

  function copyIssues() {
    const text = result.issues
      .map(
        (issue) =>
          `Row ${issue.rowNumber}\t${issue.registerNo}\t${issue.leetcodeUsername}\t${issue.reason}`,
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Issue list copied to the clipboard.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {succeeded > 0 ? (
            <CheckCircle2 className="size-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="size-5 text-amber-600" />
          )}
          Import completed
        </CardTitle>
        <CardDescription>{result.fileName}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tally label="Rows read" value={result.totalRows} tone="muted" />
          <Tally label="Added" value={result.created} tone="success" />
          <Tally label="Updated" value={result.updated} tone="navy" />
          <Tally label="Duplicate" value={result.duplicates} tone="warning" />
          <Tally label="Invalid" value={result.invalid} tone="destructive" />
        </div>

        {succeeded > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span className="flex-1">
              {formatNumber(succeeded)} record
              {succeeded === 1 ? " is" : "s are"} now tracked. Run a sync to pull
              their LeetCode statistics.
            </span>
            <SyncButton label="Sync now" variant="default" />
            <Button asChild variant="outline" size="sm">
              <Link href="/users">View users</Link>
            </Button>
          </div>
        ) : null}

        {result.issues.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">
                {formatNumber(result.issues.length)} row
                {result.issues.length === 1 ? "" : "s"} skipped
              </p>
              <Button variant="ghost" size="sm" onClick={copyIssues}>
                <Copy />
                Copy list
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0">
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Register No</TableHead>
                    <TableHead>LeetCode ID</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.issues.map((issue, index) => (
                    <TableRow key={`${issue.rowNumber}-${index}`}>
                      <TableCell className="tabular text-muted-foreground">
                        {issue.rowNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        {issue.registerNo || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {issue.leetcodeUsername || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Badge
                            variant={
                              issue.kind === "duplicate"
                                ? "warning"
                                : "destructive"
                            }
                          >
                            {issue.kind}
                          </Badge>
                          <span className="text-sm">{issue.reason}</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Every row imported cleanly"
            description="No duplicates and no invalid usernames were found."
            className="py-8"
          />
        )}
      </CardContent>
    </Card>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "success" | "navy" | "warning" | "destructive";
}) {
  const tones: Record<string, string> = {
    muted: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    navy: "text-navy dark:text-sky-300",
    warning: "text-amber-600 dark:text-amber-400",
    destructive: "text-destructive",
  };

  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className={cn("tabular text-2xl font-bold", tones[tone])}>
        {formatNumber(value)}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
