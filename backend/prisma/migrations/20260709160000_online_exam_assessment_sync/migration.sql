-- Link online exams to term assessments for automatic score sync
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "onlineExamId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "assessments_onlineExamId_key" ON "assessments"("onlineExamId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessments_onlineExamId_fkey'
  ) THEN
    ALTER TABLE "assessments"
      ADD CONSTRAINT "assessments_onlineExamId_fkey"
      FOREIGN KEY ("onlineExamId") REFERENCES "online_exams"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
