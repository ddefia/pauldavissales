-- AlterTable: cached AI-generated per-job summary (Layer B, preserved across uploads)
ALTER TABLE "Job" ADD COLUMN "aiSummary" TEXT;
ALTER TABLE "Job" ADD COLUMN "aiSummaryAt" TIMESTAMP(3);
