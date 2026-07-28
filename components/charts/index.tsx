"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS, DIFFICULTY_COLORS } from "@/lib/constants";
import { cn, formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/misc";

/**
 * Recharts measures the DOM to size itself, so it renders nothing useful on the
 * server. Mounting the chart only on the client removes a whole class of
 * hydration warnings and zero-width first paints.
 */
function ChartFrame({
  height = 260,
  className,
  children,
}: {
  height?: number;
  className?: string;
  children: React.ReactElement;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Skeleton className={cn("w-full", className)} style={{ height }} />;
  }

  return (
    <div className={className} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    boxShadow: "0 8px 24px rgb(15 23 42 / 0.12)",
    color: "var(--popover-foreground)",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600, marginBottom: 4 },
  cursor: { fill: "var(--secondary)", opacity: 0.55 },
} as const;

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/* ── Daily activity trend ───────────────────────────────────────────── */

export function TrendChart({
  data,
  height = 280,
}: {
  data: Array<{ date: string; solved: number; activeUsers: number }>;
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="solvedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-red)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--brand-red)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="activeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--navy-light)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--navy-light)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} minTickGap={24} />
        <YAxis allowDecimals={false} width={44} {...axisProps} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(label) =>
            new Date(String(label)).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          }
          formatter={(value, name) => [
            formatNumber(Number(value)),
            name === "solved" ? "Problems solved" : "Active users",
          ]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) =>
            value === "solved" ? "Problems solved" : "Active users"
          }
        />
        <Area
          type="monotone"
          dataKey="solved"
          stroke="var(--brand-red)"
          strokeWidth={2}
          fill="url(#solvedFill)"
        />
        <Area
          type="monotone"
          dataKey="activeUsers"
          stroke="var(--navy-light)"
          strokeWidth={2}
          fill="url(#activeFill)"
        />
      </AreaChart>
    </ChartFrame>
  );
}

/* ── Difficulty split ───────────────────────────────────────────────── */

export function DifficultyDonut({
  easy,
  medium,
  hard,
  height = 240,
}: {
  easy: number;
  medium: number;
  hard: number;
  height?: number;
}) {
  const data = [
    { name: "Easy", value: easy, color: DIFFICULTY_COLORS.easy },
    { name: "Medium", value: medium, color: DIFFICULTY_COLORS.medium },
    { name: "Hard", value: hard, color: DIFFICULTY_COLORS.hard },
  ].filter((slice) => slice.value > 0);

  if (data.length === 0) {
    return (
      <p
        className="grid place-items-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No problems solved yet.
      </p>
    );
  }

  return (
    <ChartFrame height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((slice) => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(value, name) => [formatNumber(Number(value)), String(name)]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
        />
      </PieChart>
    </ChartFrame>
  );
}

/* ── Horizontal category bars (departments, buckets) ────────────────── */

export function CategoryBarChart({
  data,
  xKey,
  yKey,
  label,
  height = 300,
  colorful = false,
  vertical = false,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  label: string;
  height?: number;
  colorful?: boolean;
  vertical?: boolean;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        layout={vertical ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 16, left: vertical ? 8 : -18, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={vertical}
          horizontal={!vertical}
        />
        {vertical ? (
          <>
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis
              type="category"
              dataKey={xKey}
              width={92}
              {...axisProps}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axisProps} interval={0} />
            <YAxis allowDecimals={false} width={44} {...axisProps} />
          </>
        )}
        <Tooltip
          {...tooltipStyle}
          formatter={(value) => [formatNumber(Number(value)), label]}
        />
        <Bar dataKey={yKey} radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={46}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={
                colorful
                  ? CHART_COLORS[index % CHART_COLORS.length]
                  : "var(--navy-light)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/* ── Cumulative / streak progression ────────────────────────────────── */

export function ProgressLineChart({
  data,
  series,
  height = 280,
}: {
  data: Array<Record<string, string | number | null>>;
  series: Array<{ key: string; label: string; color: string }>;
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} minTickGap={24} />
        <YAxis allowDecimals={false} width={46} {...axisProps} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(label) =>
            new Date(String(label)).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          }
          formatter={(value, name) => {
            const match = series.find((item) => item.key === name);
            return [formatNumber(Number(value)), match?.label ?? String(name)];
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) =>
            series.find((item) => item.key === value)?.label ?? String(value)
          }
        />
        {series.map((item) => (
          <Line
            key={item.key}
            type="monotone"
            dataKey={item.key}
            stroke={item.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

/* ── Stacked difficulty per department ──────────────────────────────── */

export function StackedDifficultyChart({
  data,
  height = 300,
}: {
  data: Array<{ department: string; easy: number; medium: number; hard: number }>;
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="department" {...axisProps} interval={0} />
        <YAxis allowDecimals={false} width={50} {...axisProps} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value, name) => [
            formatNumber(Number(value)),
            String(name).charAt(0).toUpperCase() + String(name).slice(1),
          ]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) =>
            String(value).charAt(0).toUpperCase() + String(value).slice(1)
          }
        />
        <Bar dataKey="easy" stackId="d" fill={DIFFICULTY_COLORS.easy} maxBarSize={46} />
        <Bar dataKey="medium" stackId="d" fill={DIFFICULTY_COLORS.medium} maxBarSize={46} />
        <Bar
          dataKey="hard"
          stackId="d"
          fill={DIFFICULTY_COLORS.hard}
          radius={[6, 6, 0, 0]}
          maxBarSize={46}
        />
      </BarChart>
    </ChartFrame>
  );
}
