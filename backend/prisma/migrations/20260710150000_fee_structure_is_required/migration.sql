-- AlterTable
ALTER TABLE "fee_structures" ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT true;
