-- Backs the login rate limiter: one row per failed admin login, read as a
-- sliding window. Avoids needing Redis for a low-volume admin-only login.
CREATE TABLE IF NOT EXISTS "login_attempts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "login_attempts_key_createdAt_idx" ON "login_attempts"("key", "createdAt");
