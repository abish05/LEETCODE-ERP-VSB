import {
  Bell,
  Building2,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Layers3,
  Settings,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match nested routes (e.g. /users/[id]) as well as the exact path. */
  deep?: boolean;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/users", label: "Users", icon: Users, deep: true },
    ],
  },
  {
    heading: "Reports",
    items: [
      { href: "/reports/daily", label: "Daily Report", icon: CalendarDays },
      { href: "/reports/leaderboard", label: "Leaderboard", icon: Trophy },
      { href: "/reports/split", label: "Split Report", icon: Layers3 },
    ],
  },
  {
    heading: "Analytics",
    items: [
      { href: "/analytics", label: "Departments", icon: Building2 },
      { href: "/analytics/staff", label: "Staff", icon: GraduationCap },
    ],
  },
  {
    heading: "Administration",
    items: [
      { href: "/import", label: "Bulk Import", icon: Upload },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
