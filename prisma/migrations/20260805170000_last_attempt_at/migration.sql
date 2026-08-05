-- Separate "we tried" from "we succeeded".
--
-- Previously a failed fetch also stamped lastSyncedAt, so a profile that never
-- resolved still looked freshly synced and the pending count read zero while
-- the numbers were stale. Batch ordering now uses lastAttemptAt (guaranteeing
-- forward progress) and lastSyncedAt records successes only.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);

-- Backfill so the first run after deploy does not treat everyone as brand new.
UPDATE "users" SET "lastAttemptAt" = "lastSyncedAt" WHERE "lastAttemptAt" IS NULL;

CREATE INDEX IF NOT EXISTS "users_lastAttemptAt_idx" ON "users"("lastAttemptAt");
