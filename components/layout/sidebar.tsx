"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COLLEGE_LOCATION, COLLEGE_NAME } from "@/lib/constants";

import { NAV_SECTIONS } from "./nav-items";

function isActive(pathname: string, href: string, deep?: boolean) {
  if (pathname === href) return true;
  // "/users" should stay lit on "/users/abc", but "/analytics" must not on
  // "/analytics/staff" — only `deep` items opt into prefix matching.
  return deep ? pathname.startsWith(`${href}/`) : false;
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto scrollbar-thin px-3 py-5">
      {NAV_SECTIONS.map((section) => (
        <div key={section.heading}>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
            {section.heading}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href, item.deep);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-white/12 text-white"
                        : "text-white/65 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--gold)]" />
                    ) : null}
                    <item.icon
                      className={cn(
                        "size-[18px] shrink-0 transition-colors",
                        active
                          ? "text-[var(--gold)]"
                          : "text-white/45 group-hover:text-white/80",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px] transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "brand-gradient fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col transition-transform duration-300 ease-out",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
          <Link href="/dashboard" onClick={onClose} className="min-w-0 flex-1">
            <BrandLockup />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>

        <SidebarNav onNavigate={onClose} />

        <div className="border-t border-white/10 px-4 py-4 text-[11px] leading-relaxed text-white/40">
          <p className="font-semibold text-white/60">{COLLEGE_NAME}</p>
          <p className="mt-0.5">{COLLEGE_LOCATION}</p>
        </div>
      </aside>
    </>
  );
}
