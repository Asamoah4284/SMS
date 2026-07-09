ALTER TABLE "online_exams" ADD COLUMN IF NOT EXISTS "assessmentType" "AssessmentType" NOT NULL DEFAULT 'EXAM';
