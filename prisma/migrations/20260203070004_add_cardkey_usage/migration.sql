-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CardKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNUSED',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "batchNo" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "consumedAt" DATETIME,
    "consumedBy" TEXT,
    "lockedAt" DATETIME,
    "lockJobId" TEXT
);
INSERT INTO "new_CardKey" ("batchNo", "code", "consumedAt", "consumedBy", "createdAt", "expiresAt", "id", "lockJobId", "lockedAt", "note", "status") SELECT "batchNo", "code", "consumedAt", "consumedBy", "createdAt", "expiresAt", "id", "lockJobId", "lockedAt", "note", "status" FROM "CardKey";
DROP TABLE "CardKey";
ALTER TABLE "new_CardKey" RENAME TO "CardKey";
CREATE UNIQUE INDEX "CardKey_code_key" ON "CardKey"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
