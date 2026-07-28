import type { Metadata } from "next";

import { DailyReportView } from "./daily-view";

export const metadata: Metadata = { title: "Daily Report" };

export default function DailyReportPage() {
  return <DailyReportView />;
}
