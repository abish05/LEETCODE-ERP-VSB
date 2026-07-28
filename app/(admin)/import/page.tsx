import type { Metadata } from "next";

import { ImportView } from "./import-view";

export const metadata: Metadata = { title: "Bulk Import" };

export default function ImportPage() {
  return <ImportView />;
}
