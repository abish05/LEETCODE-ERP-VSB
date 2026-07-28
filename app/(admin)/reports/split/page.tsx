import type { Metadata } from "next";

import { SplitReportView } from "./split-view";

export const metadata: Metadata = { title: "Split Report" };

export default function SplitReportPage() {
  return <SplitReportView />;
}
