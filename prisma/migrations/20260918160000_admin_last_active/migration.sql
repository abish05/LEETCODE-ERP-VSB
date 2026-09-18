-- The `admins.lastActive` column was added to schema.prisma (for the
-- currently-online admin tracking feature) but no migration ever shipped it,
-- so production was missing the column while the schema already expected it.
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "lastActive" TIMESTAMP(3);
