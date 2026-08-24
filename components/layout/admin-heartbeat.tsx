"use client";

import { useEffect } from "react";
import { mutateJson } from "@/lib/hooks";

export function AdminHeartbeat() {
  useEffect(() => {
    // Ping immediately on mount
    mutateJson("/api/admins/heartbeat", "POST", {}).catch(() => {});

    // Then ping every 3 minutes
    const interval = setInterval(() => {
      mutateJson("/api/admins/heartbeat", "POST", {}).catch(() => {});
    }, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
