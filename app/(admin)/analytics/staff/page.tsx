import type { Metadata } from "next";

import { StaffAnalyticsView } from "./staff-view";

export const metadata: Metadata = { title: "Staff Analytics" };

export default function StaffAnalyticsPage() {
  return <StaffAnalyticsView />;
}
