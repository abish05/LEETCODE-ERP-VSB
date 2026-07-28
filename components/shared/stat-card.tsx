import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { cn, formatNumber } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  accent = "navy",
  loading = false,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  /** Percentage change; positive is rendered green, negative red. */
  trend?: number | null;
  accent?: "navy" | "red" | "gold" | "easy" | "medium" | "hard" | "success";
  loading?: boolean;
  className?: string;
}) {
  const accents: Record<string, string> = {
    navy: "bg-navy/10 text-navy dark:bg-navy-light/50 dark:text-sky-200",
    red: "bg-primary/10 text-primary",
    gold: "bg-accent/15 text-amber-600 dark:text-amber-300",
    easy: "bg-[color-mix(in_srgb,var(--easy)_14%,transparent)] text-[var(--easy)]",
    medium:
      "bg-[color-mix(in_srgb,var(--medium)_18%,transparent)] text-amber-600 dark:text-[var(--medium)]",
    hard: "bg-[color-mix(in_srgb,var(--hard)_14%,transparent)] text-[var(--hard)]",
    success: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  };

  return (
    <Card className={cn("p-4 transition-shadow hover:shadow-md", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              accents[accent],
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="tabular mt-2 text-2xl font-bold tracking-tight">
          {typeof value === "number" ? formatNumber(value) : value}
        </p>
      )}

      <div className="mt-1.5 flex min-h-5 items-center gap-2 text-xs">
        {typeof trend === "number" && Number.isFinite(trend) ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              trend >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive",
            )}
          >
            {trend >= 0 ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {trend >= 0 ? "+" : ""}
            {trend.toFixed(1)}%
          </span>
        ) : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </Card>
  );
}
