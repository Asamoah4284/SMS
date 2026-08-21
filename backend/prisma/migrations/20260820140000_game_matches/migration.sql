-- CreateTable
CREATE TABLE "game_matches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "hostStudentId" TEXT NOT NULL,
    "guestStudentId" TEXT,
    "hostName" TEXT NOT NULL,
    "guestName" TEXT,
    "seed" JSONB NOT NULL,
    "state" JSONB NOT NULL,
    "turn" TEXT NOT NULL DEFAULT 'HOST',
    "winnerStudentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_matches_code_key" ON "game_matches"("code");

-- CreateIndex
CREATE INDEX "game_matches_hostStudentId_idx" ON "game_matches"("hostStudentId");

-- CreateIndex
CREATE INDEX "game_matches_guestStudentId_idx" ON "game_matches"("guestStudentId");

-- CreateIndex
CREATE INDEX "game_matches_status_idx" ON "game_matches"("status");
