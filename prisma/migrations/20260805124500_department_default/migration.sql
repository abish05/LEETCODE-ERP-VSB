-- Imported spreadsheets occasionally omit the department column entirely.
-- Defaulting keeps those rows insertable instead of failing the whole import.
ALTER TABLE "users" ALTER COLUMN "department" SET DEFAULT 'Unknown';
