import type { Metadata } from "next";

import { DepartmentAnalyticsView } from "./analytics-view";

export const metadata: Metadata = { title: "Department Analytics" };

export default function AnalyticsPage() {
  return <DepartmentAnalyticsView />;
}
