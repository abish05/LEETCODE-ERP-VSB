"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";

import { ExportMenu } from "@/components/shared/export-menu";
import {
  EMPTY_FILTERS,
  FilterBar,
  type FilterState,
} from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/states";
import {
  LeetCodeLink,
  StreakBadge,
  TodayCell,
  UserCell,
} from "@/components/shared/user-cells";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetcher, useApi } from "@/lib/hooks";
import type { TrackedUserDTO } from "@/lib/types";
import { buildQuery, cn, formatNumber } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly" | "overall";

interface LeaderboardRow extends TrackedUserDTO {
  rank: number;
  periodSolved: number;
}

const PERIOD_LABEL: Record<Period, string> = {
  daily: "Today",
  weekly: "Last 7 days",
  monthly: "Last 30 days",
  overall: "All time",
};

export function LeaderboardView() {
  const [period, setPeriod] = useState<Period>("overall");
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });

  const query = useMemo(
    () => buildQuery({ ...filters, period, limit: 200 }),
    [filters, period],
  );

  const { data, error, isLoading, mutate } = useApi<{
    period: Period;
    rows: LeaderboardRow[];
  }>(`/api/reports/leaderboard${query}`);

  const rows = data?.rows ?? [];

  async function exportRows() {
    const all = await fetcher<{ rows: LeaderboardRow[] }>(
      `/api/reports/leaderboard${buildQuery({ ...filters, period, pageSize: "all" })}`,
    );
    return all.rows.map((row) => ({
      Rank: row.rank,
      "LeetCode ID": row.leetcodeUsername,
      Name: row.name,
      "Register No": row.registerNo,
      Department: row.department,
      Year: row.year ?? "—",
      [`Solved (${PERIOD_LABEL[period]})`]: row.periodSolved,
      "Total Solved": row.totalSolved,
      Today: row.todaySolved,
      "Current Streak": row.currentStreak,
      "Hard Solved": row.hardSolved,
    }));
  }

  return (
    <div className="animate-in-up">
      <PageHeader
        title="Leaderboard"
        description="Ranked by problems solved. Weekly and monthly figures are summed from daily snapshots."
        actions={
          <ExportMenu
            getRows={exportRows}
            baseName={`leettrack-leaderboard-${period}`}
            title={`Leaderboard — ${PERIOD_LABEL[period]}`}
            disabled={isLoading}
          />
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={period}
          onValueChange={(next) => setPeriod(next as Period)}
        >
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="overall">Overall</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="mb-4 p-3">
        <FilterBar
          value={filters}
          onChange={setFilters}
          fields={["search", "department", "role", "year", "section"]}
        />
      </Card>

      {/* Podium */}
      {rows.length >= 3 ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {[rows[1], rows[0], rows[2]].map((row, index) => (
            <PodiumCard
              key={row.id}
              row={row}
              place={[2, 1, 3][index]}
              periodLabel={PERIOD_LABEL[period]}
            />
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : isLoading && rows.length === 0 ? (
          <LoadingRows cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No one on the board yet"
            description={
              period === "daily"
                ? "Nobody has solved a problem today."
                : "No user matches these filters for the selected period."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>LeetCode ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">
                  {PERIOD_LABEL[period]}
                </TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Today</TableHead>
                <TableHead className="text-right">Streak</TableHead>
                <TableHead className="text-right">Hard</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-center">
                    <RankPill rank={row.rank} />
                  </TableCell>
                  <TableCell className="min-w-[190px]">
                    <UserCell user={row} showDepartment={false} />
                  </TableCell>
                  <TableCell>
                    <LeetCodeLink username={row.leetcodeUsername} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {row.department}
                    {row.year ? ` · Y${row.year}` : ""}
                  </TableCell>
                  <TableCell className="tabular text-right font-bold text-primary">
                    {formatNumber(row.periodSolved)}
                  </TableCell>
                  <TableCell className="tabular text-right font-semibold">
                    {formatNumber(row.totalSolved)}
                  </TableCell>
                  <TableCell className="text-right">
                    <TodayCell value={row.todaySolved} />
                  </TableCell>
                  <TableCell className="text-right">
                    <StreakBadge days={row.currentStreak} />
                  </TableCell>
                  <TableCell className="tabular text-right text-[var(--hard)]">
                    {formatNumber(row.hardSolved)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function RankPill({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "bg-[var(--gold)] text-amber-950"
      : rank === 2
        ? "bg-slate-300 text-slate-800"
        : rank === 3
          ? "bg-amber-700 text-amber-50"
          : "";

  if (!medal) {
    return <span className="tabular text-sm text-muted-foreground">{rank}</span>;
  }

  return (
    <span
      className={cn(
        "tabular inline-grid size-7 place-items-center rounded-full text-xs font-bold",
        medal,
      )}
    >
      {rank}
    </span>
  );
}

function PodiumCard({
  row,
  place,
  periodLabel,
}: {
  row: LeaderboardRow;
  place: number;
  periodLabel: string;
}) {
  const accents: Record<number, string> = {
    1: "border-[var(--gold)]/50 bg-[color-mix(in_srgb,var(--gold)_8%,transparent)]",
    2: "border-slate-300/60",
    3: "border-amber-700/40",
  };

  return (
    <Card
      className={cn(
        "flex items-center gap-3 p-4",
        accents[place],
        place === 1 && "sm:-mt-2 sm:shadow-md",
      )}
    >
      <RankPill rank={place} />
      <div className="min-w-0 flex-1">
        <UserCell user={row} />
      </div>
      <div className="shrink-0 text-right">
        <p className="tabular text-xl font-bold">
          {formatNumber(row.periodSolved)}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {periodLabel}
        </p>
      </div>
    </Card>
  );
}
