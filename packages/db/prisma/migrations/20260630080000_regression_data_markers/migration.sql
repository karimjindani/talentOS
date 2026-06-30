-- Regression data markers let local/dev cleanup remove only rows explicitly
-- created by regression workflows. User-created and seeded data is unmarked
-- and must not be deleted by regression cleanup.
CREATE TABLE "regression_data_markers" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regression_data_markers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "regression_data_markers_entityType_entityId_key" ON "regression_data_markers"("entityType", "entityId");
CREATE INDEX "regression_data_markers_runId_idx" ON "regression_data_markers"("runId");
CREATE INDEX "regression_data_markers_entityType_entityId_idx" ON "regression_data_markers"("entityType", "entityId");
