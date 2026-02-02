-- CreateTable
CREATE TABLE "CardKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNUSED',
    "batchNo" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "consumedAt" DATETIME,
    "consumedBy" TEXT,
    "lockedAt" DATETIME,
    "lockJobId" TEXT
);

-- CreateTable
CREATE TABLE "VerificationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sheeridUrl" TEXT NOT NULL,
    "verificationId" TEXT,
    "cardKeyCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "resultMessage" TEXT,
    "resultUrl" TEXT,
    "errorCode" TEXT,
    "upstreamReqId" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationJob_cardKeyCode_fkey" FOREIGN KEY ("cardKeyCode") REFERENCES "CardKey" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "CardKey_code_key" ON "CardKey"("code");

-- CreateIndex
CREATE INDEX "VerificationJob_verificationId_idx" ON "VerificationJob"("verificationId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStats_date_key" ON "DailyStats"("date");
