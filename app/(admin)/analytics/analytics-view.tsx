"use client";

import { useState } from "react";
import { Building2, Flame, TrendingUp, TrendingDown, Trophy } from "lucide-react";

import { CategoryBarChart, StackedDifficultyChart } from "@/components/charts";
import { ExportMenu } from "@/components/shared/export-menu";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetcher, useApi } from "@/lib/hooks";
import type { DepartmentAnalyticsDTO } from "@/lib/types";
import { formatDecimal, formatNumber } from "@/lib/utils";

interface AnalyticsResponse {
  rows: DepartmentAnalyticsDTO[];
  inactiveDays: number;
}

export function DepartmentAnalyticsView({
  staffOnly = false,
  heading,
}: {
  staffOnly?: boolean;
  /** Overrides the page title when this view is embedded inside another page. */
  heading?: { title: string; description: string };
}) {
  const [role, setRole] = useState(staffOnly ? "STAFF" : "all");
  const scope = staffOnly ? "STAFF" : role;

  const { data, error, isLoading, mutate } = useApi<AnalyticsResponse>(
    `/api/analytics/departments${scope === "all" ? "" : `?role=${scope}`}`,
  );

  const rows = data?.rows ?? [];

  async function exportRows() {
    const all = await fetcher<AnalyticsResponse>(
      `/api/analytics/departments${scope === "all" ? "" : `?role=${scope}`}`,
    );
    return all.rows.map((row) => ({
      Department: row.department,
      Users: row.users,
      Students: row.students,
      Staff: row.staff,
      "Total Solved": row.totalSolved,
      "Avg. Solved": row.averageSolved,
      "Avg. Streak": row.averageStreak,
      Easy: row.easy,
      Medium: row.medium,
      Hard: row.hard,
      "Active Today": row.activeToday,
      Inactive: row.inactive,
      "Solved This Week": row.solvedThisWeek,
      "Top Performer": row.topPerformer
        ? `${row.topPerformer.name} (${row.topPerformer.totalSolved})`
        : "—",
      "Most Active Today": row.mostActive
        ? `${row.mostActive.name} (+${row.mostActive.todaySolved})`
        : "—",
      "Least Active": row.leastActive
        ? `${row.leastActive.name} (${row.leastActive.totalSolved})`
        : "—",
    }));
  }

  return (
    <div className="animate-in-up">
      <PageHeader
        title={
          heading?.title ??
          (staffOnly ? "Staff Analytics" : "Department Analytics")
        }
        description={
          heading?.description ??
          (staffOnly
            ? "Performance of tracked staff members, grouped by department."
            : "Comparative performance across every department in the college.")
        }
        actions={
          <>
            {staffOnly ? null : (
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-[9.5rem]" aria-label="Scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Students &amp; staff</SelectItem>
                  <SelectItem value="STUDENT">Students only</SelectItem>
                  <SelectItem value="STAFF">Staff only</SelectItem>
                </SelectContent>
              </Select>
            )}
            <ExportMenu
              getRows={exportRows}
              baseName={
                staffOnly ? "leettrack-staff-analytics" : "leettrack-departments"
              }
              title={staffOnly ? "Staff Analytics" : "Department Analytics"}
              disabled={isLoading}
            />
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={() => mutate()} />
        </Card>
      ) : isLoading && rows.length === 0 ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full" />
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title={staffOnly ? "No staff are tracked yet" : "No departments yet"}
            description={
              staffOnly
                ? "Import staff records with Role set to “Staff” to populate this page."
                : "Departments appear here once users are imported."
            }
          />
        </Card>
      ) : (
        <>
          {/* ── Department cards ─────────────────────────────────── */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <DepartmentCard
                key={row.department}
                row={row}
                inactiveDays={data?.inactiveDays ?? 7}
              />
            ))}
          </div>

          {/* ── Charts ───────────────────────────────────────────── */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Average problems per user</CardTitle>
                <CardDescription>
                  Normalises for department size, so a large branch cannot
                  dominate on volume alone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBarChart
                  data={rows.map((row) => ({
                    department: row.department,
                    average: row.averageSolved,
                  }))}
                  xKey="department"
                  yKey="average"
                  label="Avg. solved"
                  colorful
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Difficulty mix by department</CardTitle>
                <CardDescription>
                  Total problems solved, stacked by difficulty.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StackedDifficultyChart
                  data={rows.map((row) => ({
                    department: row.department,
                    easy: row.easy,
                    medium: row.medium,
                    hard: row.hard,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Comparison table ─────────────────────────────────── */}
          <Card className="mt-4 overflow-hidden">
            <CardHeader>
              <CardTitle>Full comparison</CardTitle>
              <CardDescription>
                Every metric side by side. Inactive counts use a{" "}
                {data?.inactiveDays ?? 7}-day window.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Avg.</TableHead>
                    <TableHead className="text-right">Avg. streak</TableHead>
                    <TableHead className="text-right">Easy</TableHead>
                    <TableHead className="text-right">Medium</TableHead>
                    <TableHead className="text-right">Hard</TableHead>
                    <TableHead className="text-right">Active today</TableHead>
                    <TableHead className="text-right">This week</TableHead>
                    <TableHead className="text-right">Inactive</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.department}>
                      <TableCell className="font-medium">
                        {row.department}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatNumber(row.users)}
                      </TableCell>
                      <TableCell className="tabular text-right font-semibold">
                        {formatNumber(row.totalSolved)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatDecimal(row.averageSolved)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatDecimal(row.averageStreak)}
                      </TableCell>
                      <TableCell className="tabular text-right text-[var(--easy)]">
                        {formatNumber(row.easy)}
                      </TableCell>
                      <TableCell className="tabular text-right text-amber-600 dark:text-[var(--medium)]">
                        {formatNumber(row.medium)}
                      </TableCell>
                      <TableCell className="tabular text-right text-[var(--hard)]">
                        {formatNumber(row.hard)}
                      </TableCell>
                      <TableCell className="tabular text-right text-emerald-600 dark:text-emerald-400">
                        {formatNumber(row.activeToday)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatNumber(row.solvedThisWeek)}
                      </TableCell>
                      <TableCell className="tabular text-right text-destructive">
                        {formatNumber(row.inactive)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DepartmentCard({
  row,
  inactiveDays,
}: {
  row: DepartmentAnalyticsDTO;
  inactiveDays: number;
}) {
  const activeShare = row.users > 0 ? (row.activeToday / row.users) * 100 : 0;

  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight">{row.department}</h3>
          <p className="text-xs text-muted-foreground">
            {formatNumber(row.users)} tracked ·{" "}
            {formatNumber(row.students)} student{row.students === 1 ? "" : "s"} ·{" "}
            {formatNumber(row.staff)} staff
          </p>
        </div>
        <Badge variant="navy">{formatDecimal(row.averageSolved)} avg</Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-secondary/60 py-2">
          <p className="tabular text-base font-bold">
            {formatNumber(row.totalSolved)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total
          </p>
        </div>
        <div className="rounded-lg bg-secondary/60 py-2">
          <p className="tabular text-base font-bold text-emerald-600 dark:text-emerald-400">
            {formatNumber(row.solvedThisWeek)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            This week
          </p>
        </div>
        <div className="rounded-lg bg-secondary/60 py-2">
          <p className="tabular flex items-center justify-center gap-1 text-base font-bold text-[var(--gold)]">
            <Flame className="size-3.5" />
            {formatDecimal(row.averageStreak)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Avg. streak
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Active today</span>
          <span className="tabular font-medium">
            {formatNumber(row.activeToday)} / {formatNumber(row.users)} ·{" "}
            {activeShare.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${activeShare}%` }}
          />
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
        <Highlight
          icon={Trophy}
          label="Top performer"
          value={
            row.topPerformer
              ? `${row.topPerformer.name} · ${formatNumber(row.topPerformer.totalSolved)}`
              : "—"
          }
        />
        <Highlight
          icon={TrendingUp}
          label="Most active today"
          value={
            row.mostActive
              ? `${row.mostActive.name} · +${row.mostActive.todaySolved}`
              : "Nobody solved today"
          }
        />
        <Highlight
          icon={TrendingDown}
          label={`Inactive (${inactiveDays}d)`}
          value={`${formatNumber(row.inactive)} user${row.inactive === 1 ? "" : "s"}`}
        />
      </dl>
    </Card>
  );
}

function Highlight({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 flex-1 truncate text-right font-medium">{value}</dd>
    </div>
  );
}
