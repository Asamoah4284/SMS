-- CreateEnum
CREATE TYPE "PromotionBatchStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "PromotionAction" AS ENUM ('PROMOTE', 'REPEAT', 'WITHDRAW');

-- CreateTable
CREATE TABLE "promotion_batches" (
    "id" TEXT NOT NULL,
    "sourceClassId" TEXT NOT NULL,
    "targetClassId" TEXT,
    "status" "PromotionBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "finalizedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    CONSTRAINT "promotion_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_decisions" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "action" "PromotionAction" NOT NULL,
    "targetClassId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promotion_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_batches_sourceClassId_status_idx" ON "promotion_batches"("sourceClassId", "status");
CREATE UNIQUE INDEX "promotion_decisions_batchId_studentId_key" ON "promotion_decisions"("batchId", "studentId");
CREATE INDEX "promotion_decisions_studentId_createdAt_idx" ON "promotion_decisions"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_sourceClassId_fkey" FOREIGN KEY ("sourceClassId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_targetClassId_fkey" FOREIGN KEY ("targetClassId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "promotion_decisions" ADD CONSTRAINT "promotion_decisions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "promotion_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_decisions" ADD CONSTRAINT "promotion_decisions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "promotion_decisions" ADD CONSTRAINT "promotion_decisions_targetClassId_fkey" FOREIGN KEY ("targetClassId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
