import Image from "next/image";

import { cn } from "@/lib/utils";
import { APP_NAME, APP_TAGLINE, COLLEGE_SHORT } from "@/lib/constants";

/**
 * The college crest.
 *
 * To use the official artwork instead of the bundled vector rendition, drop the
 * file in as `public/logo.svg` (or `public/logo.png` and change `src` below) —
 * nothing else needs to change.
 */
export function CollegeLogo({
  size = 40,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.jpg"
      alt={`${COLLEGE_SHORT} crest`}
      width={size}
      height={size}
      priority={priority}
      className={cn("object-contain", className)}
      style={{ width: size, height: "auto" }}
    />
  );
}

export function BrandLockup({
  className,
  logoSize = 42,
  tone = "light",
}: {
  className?: string;
  logoSize?: number;
  tone?: "light" | "dark";
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5">
        <CollegeLogo size={logoSize} priority />
      </span>
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block truncate text-[15px] font-bold tracking-tight",
            tone === "light" ? "text-white" : "text-foreground",
          )}
        >
          {APP_NAME}
        </span>
        <span
          className={cn(
            "block truncate text-[11px]",
            tone === "light" ? "text-white/60" : "text-muted-foreground",
          )}
        >
          {APP_TAGLINE}
        </span>
      </span>
    </div>
  );
}
