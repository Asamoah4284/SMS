-- Run on server if you prefer raw SQL, or use: npx prisma migrate deploy
-- Pending migrations (Jul 10, 2026)

-- 1) Report card conduct & interest
ALTER TABLE "term_remarks" ADD COLUMN IF NOT EXISTS "conduct" TEXT;
ALTER TABLE "term_remarks" ADD COLUMN IF NOT EXISTS "interest" TEXT;

-- 2) School events
CREATE TABLE IF NOT EXISTS "school_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_events_eventDate_idx" ON "school_events"("eventDate");

DO $$ BEGIN
  ALTER TABLE "school_events" ADD CONSTRAINT "school_events_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3) Fee item required vs optional
ALTER TABLE "fee_structures" ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT true;

-- Prefer: npx prisma migrate deploy
