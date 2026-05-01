/*
  Warnings:

  - Made the column `pathStepId` on table `OverrideFlow` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OverrideFlow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathStepId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "cooldownSeconds" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "overrideType" TEXT NOT NULL,
    "confirmationStage" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cooldownStartsAt" DATETIME,
    "confirmedAt" DATETIME,
    "executedAt" DATETIME,
    "abortedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OverrideFlow_pathStepId_fkey" FOREIGN KEY ("pathStepId") REFERENCES "PathStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OverrideFlow" ("abortedAt", "confirmationStage", "confirmedAt", "cooldownSeconds", "cooldownStartsAt", "createdAt", "executedAt", "id", "overrideType", "pathStepId", "reason", "severity", "status", "updatedAt") SELECT "abortedAt", "confirmationStage", "confirmedAt", "cooldownSeconds", "cooldownStartsAt", "createdAt", "executedAt", "id", "overrideType", "pathStepId", "reason", "severity", "status", "updatedAt" FROM "OverrideFlow";
DROP TABLE "OverrideFlow";
ALTER TABLE "new_OverrideFlow" RENAME TO "OverrideFlow";
CREATE INDEX "OverrideFlow_status_idx" ON "OverrideFlow"("status");
CREATE INDEX "OverrideFlow_pathStepId_idx" ON "OverrideFlow"("pathStepId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
