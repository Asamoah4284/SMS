-- Safe migration for Render / managed Postgres (no shadow DB required).
-- classNumber: add nullable → backfill from level → NOT NULL + unique

ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "classNumber" INTEGER;

UPDATE "classes"
SET "classNumber" = CASE "level"
  WHEN 'NURSERY_1' THEN 1
  WHEN 'NURSERY_2' THEN 2
  WHEN 'KG_1' THEN 3
  WHEN 'KG_2' THEN 4
  WHEN 'BASIC_1' THEN 5
  WHEN 'BASIC_2' THEN 6
  WHEN 'BASIC_3' THEN 7
  WHEN 'BASIC_4' THEN 8
  WHEN 'BASIC_5' THEN 9
  WHEN 'BASIC_6' THEN 10
  WHEN 'JHS_1' THEN 11
  WHEN 'JHS_2' THEN 12
  WHEN 'JHS_3' THEN 13
  ELSE "classNumber"
END
WHERE "classNumber" IS NULL;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "level", "name") AS rn
  FROM "classes"
  WHERE "classNumber" IS NULL
)
UPDATE "classes" c
SET "classNumber" = numbered.rn + 100
FROM numbered
WHERE c.id = numbered.id;

ALTER TABLE "classes" ALTER COLUMN "classNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "classes_classNumber_key" ON "classes"("classNumber");

-- Admin first-login password change
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Paystack commission breakdown (fees)
ALTER TABLE "paystack_intents" ADD COLUMN IF NOT EXISTS "schoolAmountGhs" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "paystack_intents" ADD COLUMN IF NOT EXISTS "platformFeeGhs" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Paystack commission breakdown (library)
ALTER TABLE "book_paystack_intents" ADD COLUMN IF NOT EXISTS "schoolAmountGhs" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "book_paystack_intents" ADD COLUMN IF NOT EXISTS "platformFeeGhs" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Parent push notifications
CREATE TABLE IF NOT EXISTS "push_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX IF NOT EXISTS "push_tokens_parentPhone_idx" ON "push_tokens"("parentPhone");

-- School wallet & payout requests
DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "school_wallet" (
    "id" TEXT NOT NULL,
    "availableBalanceGhs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payout_requests" (
    "id" TEXT NOT NULL,
    "amountGhs" DOUBLE PRECISION NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "paystackTransferCode" TEXT,
    "failureReason" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
