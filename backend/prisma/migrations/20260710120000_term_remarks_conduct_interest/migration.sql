-- AlterTable
ALTER TABLE "term_remarks" ADD COLUMN IF NOT EXISTS "conduct" TEXT;
ALTER TABLE "term_remarks" ADD COLUMN IF NOT EXISTS "interest" TEXT;
