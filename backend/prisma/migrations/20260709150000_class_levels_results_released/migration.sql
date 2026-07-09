-- Extend ClassLevel enum for school import (creche + year 1–8)
ALTER TYPE "ClassLevel" ADD VALUE IF NOT EXISTS 'CRECHE';
ALTER TYPE "ClassLevel" ADD VALUE IF NOT EXISTS 'YEAR_1';
ALTER TYPE "ClassLevel" ADD VALUE IF NOT EXISTS 'YEAR_2';
ALTER TYPE "ClassLevel" ADD VALUE IF NOT EXISTS 'YEAR_3';
ALTER TYPE "ClassLevel" ADD VALUE IF NOT EXISTS 'YEAR_4';
ALTER TYPE "ClassLevel" ADD VALUE IF NOT EXISTS 'YEAR_5';
ALTER TYPE "ClassLevel" ADD VALUE IF NOT EXISTS 'YEAR_6';
ALTER TYPE "ClassLevel" ADD VALUE IF NOT EXISTS 'YEAR_7';
ALTER TYPE "ClassLevel" ADD VALUE IF NOT EXISTS 'YEAR_8';

-- Hide exam marks from students until staff releases results
ALTER TABLE "online_exams" ADD COLUMN IF NOT EXISTS "resultsReleased" BOOLEAN NOT NULL DEFAULT false;
