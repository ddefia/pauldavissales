-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "customerName" TEXT,
    "office" TEXT,
    "pm" TEXT,
    "jobStatus" TEXT,
    "currentEstimate" DOUBLE PRECISION,
    "rmsUrl" TEXT,
    "externalId" TEXT,
    "rawData" JSONB,
    "committedEstimate" DOUBLE PRECISION,
    "committedEstimateAt" TIMESTAMP(3),
    "targetMargin" DOUBLE PRECISION,
    "targetMarginUnit" TEXT DEFAULT 'percent',
    "targetCompletionDate" TIMESTAMP(3),
    "struckOut" BOOLEAN NOT NULL DEFAULT false,
    "struckOutAt" TIMESTAMP(3),
    "closedFromExport" BOOLEAN NOT NULL DEFAULT false,
    "closedFromExportAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastImportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobActionItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobBillingForecast" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobBillingForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobFieldRevision" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobFieldRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobImportLog" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "matchedJobs" INTEGER NOT NULL DEFAULT 0,
    "newJobs" INTEGER NOT NULL DEFAULT 0,
    "closedJobs" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "detectedColumns" JSONB,
    "jobNumberColumn" TEXT,
    "errorMessage" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStatusOption" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobStatusOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");

-- CreateIndex
CREATE INDEX "Job_pm_idx" ON "Job"("pm");

-- CreateIndex
CREATE INDEX "Job_office_idx" ON "Job"("office");

-- CreateIndex
CREATE INDEX "Job_jobStatus_idx" ON "Job"("jobStatus");

-- CreateIndex
CREATE INDEX "Job_struckOut_idx" ON "Job"("struckOut");

-- CreateIndex
CREATE INDEX "Job_closedFromExport_idx" ON "Job"("closedFromExport");

-- CreateIndex
CREATE INDEX "JobActionItem_jobId_idx" ON "JobActionItem"("jobId");

-- CreateIndex
CREATE INDEX "JobActionItem_status_idx" ON "JobActionItem"("status");

-- CreateIndex
CREATE INDEX "JobBillingForecast_jobId_idx" ON "JobBillingForecast"("jobId");

-- CreateIndex
CREATE INDEX "JobBillingForecast_month_idx" ON "JobBillingForecast"("month");

-- CreateIndex
CREATE UNIQUE INDEX "JobBillingForecast_jobId_month_key" ON "JobBillingForecast"("jobId", "month");

-- CreateIndex
CREATE INDEX "JobFieldRevision_jobId_idx" ON "JobFieldRevision"("jobId");

-- CreateIndex
CREATE INDEX "JobFieldRevision_field_idx" ON "JobFieldRevision"("field");

-- CreateIndex
CREATE INDEX "JobImportLog_createdAt_idx" ON "JobImportLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobStatusOption_value_key" ON "JobStatusOption"("value");

-- CreateIndex
CREATE INDEX "JobStatusOption_sortOrder_idx" ON "JobStatusOption"("sortOrder");

-- AddForeignKey
ALTER TABLE "JobActionItem" ADD CONSTRAINT "JobActionItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobBillingForecast" ADD CONSTRAINT "JobBillingForecast_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFieldRevision" ADD CONSTRAINT "JobFieldRevision_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
