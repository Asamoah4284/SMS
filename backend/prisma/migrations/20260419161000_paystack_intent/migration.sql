-- CreateTable
CREATE TABLE "paystack_intents" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountGhs" DOUBLE PRECISION NOT NULL,
    "amountPesewas" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "callbackUrl" TEXT,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "paystackAccessCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paystack_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paystack_intents_reference_key" ON "paystack_intents"("reference");

-- CreateIndex
CREATE INDEX "paystack_intents_studentId_termId_idx" ON "paystack_intents"("studentId", "termId");

-- AddForeignKey
ALTER TABLE "paystack_intents" ADD CONSTRAINT "paystack_intents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paystack_intents" ADD CONSTRAINT "paystack_intents_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
