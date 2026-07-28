"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Target, Flame, BarChart3, Users } from "lucide-react";

import { DepartmentAnalyticsView } from "../analytics-view";
import { ExportMenu } from "@/components/shared/export-menu";
import {
  EMPTY_FILTERS,
  FilterBar,
  type FilterState,
} from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/pagination";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import {
  LeetCodeLink,
  StatusBadge,
  StreakBadge,
  TodayCell,
  UserCell,
} from "@/components/shared/user-cells";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetcher, useApi } from "@/lib/hooks";
import type { Paginated, TrackedUserDTO } from "@/lib/types";
import { average, buildQuery, formatDecimal, formatNumber, timeAgo } from "@/lib/utils";

export function StaffAnalyticsView() {
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const query = useMemo(
    () =>
      buildQuery({
        ...filters,
        role: "STAFF", // hard-scoped: this page is staff only
        page,
        pageSize,
        sort: "totalSolved",
        dir: "desc",
      }),
    [filters, page, pageSize],
  );

  const { data, error, isLoading, mutate } =
    useApi<Paginated<TrackedUserDTO>>(`/api/users${query}`);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  // Summary tiles reflect the current page's cohort; the full totals live in
  // the department analytics section below.
  const summary = useMemo(() => {
    if (rows.length === 0) {
      return { avgSolved: 0, solvedToday: 0, topStreak: 0, totalSolved: 0 };
    }
    return {
      avgSolved: average(rows.map((row) => row.totalSolved)),
      solvedToday: rows.reduce((sum, row) => sum + row.todaySolved, 0),
      topStreak: Math.max(...rows.map((row) => row.currentStreak)),
      totalSolved: rows.reduce((sum, row) => sum + row.totalSolved, 0),
    };
  }, [rows]);

  async function exportRows() {
    const all = await fetcher<Paginated<TrackedUserDTO>>(
      `/api/users${buildQuery({ ...filters, role: "STAFF", pageSize: "all" })}`,
    );
    return all.rows.map((row) => ({
      "Staff ID": row.registerNo,
      Name: row.name,
      Department: row.department,
      "LeetCode ID": row.leetcodeUsername,
      Total: row.totalSolved,
      Today: row.todaySolved,
      Easy: row.easySolved,
      Medium: row.mediumSolved,
      Hard: row.hardSolved,
      Streak: row.currentStreak,
      "Max Streak": row.maxStreak,
      Ranking: row.ranking ?? "—",
      Status: row.status,
    }));
  }

  return (
    <div className="animate-in-up space-y-6">
      <div>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Staff Analytics
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A dedicated view of every tracked staff member, separate from the
              student cohort.
            </p>
          </div>
          <ExportMenu
            getRows={exportRows}
            baseName="leettrack-staff"
            title="Staff Report"
            subtitle={`${formatNumber(data?.total ?? 0)} staff members`}
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Staff Tracked"
            value={data?.total ?? 0}
            icon={Users}
            accent="navy"
            loading={isLoading}
          />
          <StatCard
            label="Avg. Problems"
            value={formatDecimal(summary.avgSolved)}
            hint="on this page"
            icon={BarChart3}
            accent="navy"
            loading={isLoading}
          />
          <StatCard
            label="Solved Today"
            value={summary.solvedToday}
            hint="on this page"
            icon={Target}
            accent="red"
            loading={isLoading}
          />
          <StatCard
            label="Highest Streak"
            value={summary.topStreak}
            hint="days"
            icon={Flame}
            accent="gold"
            loading={isLoading}
          />
        </div>

        <Card className="my-4 p-3">
          <FilterBar
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
            fields={["search", "department", "status", "minSolved"]}
          />
        </Card>

        <Card className="overflow-hidden">
          {error ? (
            <ErrorState message={error.message} onRetry={() => mutate()} />
          ) : isLoading && rows.length === 0 ? (
            <LoadingRows cols={7} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No staff records"
              description="Import rows with the Role column set to “Staff” to see them here."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>LeetCode ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Today</TableHead>
                    <TableHead className="text-right">Easy</TableHead>
                    <TableHead className="text-right">Medium</TableHead>
                    <TableHead className="text-right">Hard</TableHead>
                    <TableHead className="text-right">Streak</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Synced</TableHead>
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
                      <TableCell>
                        <StatusBadge
                          status={row.status}
                          syncError={row.syncError}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {timeAgo(row.lastSyncedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
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

      {/* Department roll-up, scoped to staff. */}
      <DepartmentAnalyticsView
        staffOnly
        heading={{
          title: "Staff by department",
          description:
            "The same departmental metrics, counting staff members only.",
        }}
      />
    </div>
  );
}
