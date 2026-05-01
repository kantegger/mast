-- CreateTable
CREATE TABLE "Thesis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "brokenAt" DATETIME
);

-- CreateTable
CREATE TABLE "Variable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "thesisId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assumedDir" TEXT NOT NULL,
    "observedDir" TEXT,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "aiBreakRisk" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'valid',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Variable_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Path" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "thesisId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Path_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PathStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PathStep_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "Path" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathId" TEXT NOT NULL,
    "pathStepId" TEXT,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditionKind" TEXT NOT NULL,
    "conditionExpr" TEXT NOT NULL,
    "referenceValue" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "autoInserted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firedAt" DATETIME,
    CONSTRAINT "Trigger_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "Path" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trigger_pathStepId_fkey" FOREIGN KEY ("pathStepId") REFERENCES "PathStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "thesisId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "size" DECIMAL NOT NULL,
    "costBasis" DECIMAL NOT NULL,
    "riskBudget" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Position_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Position_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "Path" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "positionId" TEXT NOT NULL,
    "pathStepId" TEXT,
    "triggerId" TEXT,
    "intent" TEXT NOT NULL,
    "size" DECIMAL NOT NULL,
    "price" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "gateDecisionKind" TEXT,
    "gateDecisionReason" TEXT,
    "overrideFlowId" TEXT,
    "reviewedAt" DATETIME,
    "reviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" DATETIME,
    CONSTRAINT "Trade_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trade_pathStepId_fkey" FOREIGN KEY ("pathStepId") REFERENCES "PathStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Trade_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "Trigger" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Trade_overrideFlowId_fkey" FOREIGN KEY ("overrideFlowId") REFERENCES "OverrideFlow" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deviation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT,
    "positionId" TEXT,
    "type" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deviation_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deviation_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OverrideFlow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathStepId" TEXT,
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
    CONSTRAINT "OverrideFlow_pathStepId_fkey" FOREIGN KEY ("pathStepId") REFERENCES "PathStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ViewPnLFlow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "positionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "unlockedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ViewPnLFlow_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Variable_thesisId_idx" ON "Variable"("thesisId");

-- CreateIndex
CREATE INDEX "Variable_status_idx" ON "Variable"("status");

-- CreateIndex
CREATE INDEX "Path_thesisId_idx" ON "Path"("thesisId");

-- CreateIndex
CREATE INDEX "Path_status_idx" ON "Path"("status");

-- CreateIndex
CREATE INDEX "PathStep_pathId_idx" ON "PathStep"("pathId");

-- CreateIndex
CREATE INDEX "PathStep_status_idx" ON "PathStep"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PathStep_pathId_order_key" ON "PathStep"("pathId", "order");

-- CreateIndex
CREATE INDEX "Trigger_pathId_idx" ON "Trigger"("pathId");

-- CreateIndex
CREATE INDEX "Trigger_pathStepId_idx" ON "Trigger"("pathStepId");

-- CreateIndex
CREATE INDEX "Trigger_status_idx" ON "Trigger"("status");

-- CreateIndex
CREATE INDEX "Trigger_priority_idx" ON "Trigger"("priority");

-- CreateIndex
CREATE INDEX "Position_thesisId_idx" ON "Position"("thesisId");

-- CreateIndex
CREATE INDEX "Position_pathId_idx" ON "Position"("pathId");

-- CreateIndex
CREATE INDEX "Position_status_idx" ON "Position"("status");

-- CreateIndex
CREATE INDEX "Position_symbol_idx" ON "Position"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_overrideFlowId_key" ON "Trade"("overrideFlowId");

-- CreateIndex
CREATE INDEX "Trade_positionId_idx" ON "Trade"("positionId");

-- CreateIndex
CREATE INDEX "Trade_pathStepId_idx" ON "Trade"("pathStepId");

-- CreateIndex
CREATE INDEX "Trade_status_idx" ON "Trade"("status");

-- CreateIndex
CREATE INDEX "Trade_createdAt_idx" ON "Trade"("createdAt");

-- CreateIndex
CREATE INDEX "Deviation_type_idx" ON "Deviation"("type");

-- CreateIndex
CREATE INDEX "Deviation_createdAt_idx" ON "Deviation"("createdAt");

-- CreateIndex
CREATE INDEX "OverrideFlow_status_idx" ON "OverrideFlow"("status");

-- CreateIndex
CREATE INDEX "OverrideFlow_pathStepId_idx" ON "OverrideFlow"("pathStepId");

-- CreateIndex
CREATE INDEX "ViewPnLFlow_positionId_idx" ON "ViewPnLFlow"("positionId");

-- CreateIndex
CREATE INDEX "ViewPnLFlow_status_idx" ON "ViewPnLFlow"("status");
