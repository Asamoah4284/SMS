-- Extend ClassLevel for creche + Year 1–8 (international / private school naming)

DO $$ BEGIN ALTER TYPE "ClassLevel" ADD VALUE 'CRECHE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ClassLevel" ADD VALUE 'YEAR_1'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ClassLevel" ADD VALUE 'YEAR_2'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ClassLevel" ADD VALUE 'YEAR_3'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ClassLevel" ADD VALUE 'YEAR_4'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ClassLevel" ADD VALUE 'YEAR_5'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ClassLevel" ADD VALUE 'YEAR_6'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ClassLevel" ADD VALUE 'YEAR_7'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ClassLevel" ADD VALUE 'YEAR_8'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
