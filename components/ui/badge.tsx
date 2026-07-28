import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        navy: "border-transparent bg-navy/10 text-navy dark:bg-navy-light/40 dark:text-sky-200",
        gold: "border-transparent bg-accent/15 text-amber-700 dark:text-amber-300",
        success:
          "border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        warning:
          "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
        destructive:
          "border-transparent bg-destructive/12 text-destructive",
        outline: "border-border text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        easy: "border-transparent bg-[color-mix(in_srgb,var(--easy)_15%,transparent)] text-[var(--easy)]",
        medium:
          "border-transparent bg-[color-mix(in_srgb,var(--medium)_18%,transparent)] text-amber-700 dark:text-[var(--medium)]",
        hard: "border-transparent bg-[color-mix(in_srgb,var(--hard)_14%,transparent)] text-[var(--hard)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
