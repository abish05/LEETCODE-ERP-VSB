"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Info, Printer } from "lucide-react";

import { ExportMenu } from "@/components/shared/export-menu";
import {
  EMPTY_FILTERS,
  FilterBar,
  type FilterState,
} from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import {
  LeetCodeLink,
  RoleBadge,
  StreakBadge,
  TodayCell,
  UserCell,
} from "@/components/shared/user-cells";
import { SyncButton } from "@/components/layout/sync-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetcher, useApi } from "@/lib/hooks";
import type { TrackedUserDTO } from "@/lib/types";
import { buildQuery, formatDate, formatNumber, toISODate } from "@/lib/utils";

interface DailyResponse {
  date: string;
  source: "live" | "snapshot";
  synced: boolean;
  rows: TrackedUserDTO[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function DailyReportView() {
  const today = toISODate();
  const [date, setDate] = useState(today);
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const query = useMemo(
    () => buildQuery({ ...filters, date, page, pageSize }),
    [filters, date, page, pageSize],
  );

  const { data, error, isLoading, mutate } = useApi<DailyResponse>(
    `/api/reports/daily${query}`,
  );

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const pageTotals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          total: acc.total + row.totalSolved,
          today: acc.today + row.todaySolved,
          easy: acc.easy + row.easySolved,
          medium: acc.medium + row.mediumSolved,
          hard: acc.hard + row.hardSolved,
        }),
        { total: 0, today: 0, easy: 0, medium: 0, hard: 0 },
      ),
    [rows],
  );

  async function exportRows() {
    const all = await fetcher<DailyResponse>(
      `/api/reports/daily${buildQuery({ ...filters, date, pageSize: "all" })}`,
    );
    return all.rows.map((row) => ({
      Name: row.name,
      "Register No": row.registerNo,
      "LeetCode ID": row.leetcodeUsername,
      Department: row.department,
      Year: row.year ?? "—",
      Section: row.section ?? "—",
      Role: row.role === "STAFF" ? "Staff" : "Student",
      Total: row.totalSolved,
      Today: row.todaySolved,
      Easy: row.easySolved,
      Medium: row.mediumSolved,
      Hard: row.hardSolved,
      Streak: row.currentStreak,
      Ranking: row.ranking ?? "—",
    }));
  }

  return (
    <div className="animate-in-up">
      <PageHeader
        title="Daily Report"
        description="A dated snapshot of every tracked profile. Pick a past date to reproduce that day exactly."
        actions={
          <>
            <Input
              type="date"
              value={date}
              max={today}
              onChange={(event) => {
                setDate(event.target.value || today);
                setPage(1);
              }}
              aria-label="Report date"
              className="w-[10.5rem]"
            />
            <ExportMenu
              getRows={exportRows}
              baseName={`leettrack-daily-${date}`}
              title="Daily Report"
              subtitle={`${formatDate(date)} · ${formatNumber(data?.total ?? 0)} users`}
              disabled={isLoading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="hidden sm:inline-flex"
            >
              <Printer />
              Print
            </Button>
            <SyncButton />
          </>
        }
      />

      {data && !data.synced ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-2.5 text-sm no-print">
          <Info className="size-4 shrink-0 text-amber-600" />
          <span className="text-amber-800 dark:text-amber-200">
            No sync has been recorded for {formatDate(date)} yet — showing the
            most recent live figures instead.
          </span>
        </div>
      ) : null}

      <Card className="mb-4 p-3 no-print">
        <FilterBar
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
          fields={[
            "search",
            "department",
            "role",
            "year",
            "section",
            "minSolved",
            "minStreak",
          ]}
        />
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{formatDate(date)}</span>
            {data ? (
              <Badge variant={data.synced ? "success" : "warning"}>
                {data.synced ? "Synced snapshot" : "Live figures"}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatNumber(data?.total ?? 0)} users in this report
          </p>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : isLoading && rows.length === 0 ? (
          <LoadingRows cols={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing to report"
            description="No user matches the current filters for this date."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>LeetCode ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Today</TableHead>
                  <TableHead className="text-right">Easy</TableHead>
                  <TableHead className="text-right">Medium</TableHead>
                  <TableHead className="text-right">Hard</TableHead>
                  <TableHead className="text-right">Streak</TableHead>
                  <TableHead className="text-right">Ranking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-[190px]">
                      <UserCell user={row} showDepartment={false} />
                    </TableCell>
                    <TableCell>
                      <LeetCodeLink username={row.leetcodeUsername} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {row.department}
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={row.role} />
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {formatNumber(row.totalSolved)}
                    </TableCell>
                    <TableCell className="text-right">
                      <TodayCell value={row.todaySolved} />
                    </TableCell>
                    <TableCell className="tabular text-right text-[var(--easy)]">
                      {formatNumber(row.easySolved)}
                    </TableCell>
                    <TableCell className="tabular text-right text-amber-600 dark:text-[var(--medium)]">
                      {formatNumber(row.mediumSolved)}
                    </TableCell>
                    <TableCell className="tabular text-right text-[var(--hard)]">
                      {formatNumber(row.hardSolved)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StreakBadge days={row.currentStreak} />
                    </TableCell>
                    <TableCell className="tabular text-right text-sm text-muted-foreground">
                      {row.ranking ? formatNumber(row.ranking) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="text-xs uppercase tracking-wide">
                    Page total ({rows.length} rows)
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatNumber(pageTotals.total)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatNumber(pageTotals.today)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatNumber(pageTotals.easy)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatNumber(pageTotals.medium)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatNumber(pageTotals.hard)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>

            <Pagination
              page={data?.page ?? 1}
              pageSize={data?.pageSize ?? pageSize}
              total={data?.total ?? 0}
              pageCount={data?.pageCount ?? 1}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
