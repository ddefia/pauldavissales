/**
 * Shapes a Job (with its action items + billing forecasts) into the payload the
 * dashboard UI consumes. Derived values (estimate variance, the inline "latest
 * action item", open/closed state) are computed here so they are consistent
 * everywhere and never stored stale.
 */

import type { Job, JobActionItem, JobBillingForecast } from "@/generated/prisma/client";

export type JobWithRelations = Job & {
  actionItems: JobActionItem[];
  billingForecasts: JobBillingForecast[];
};

// A job is "closed" for review purposes if its uploaded Job Status reads as
// terminal. RMS exports often include closed jobs, and those should drop out
// of the Open list automatically (not just when they leave the export).
const CLOSED_STATUSES = new Set([
  "closed",
  "cancelled",
  "canceled",
  "void",
  "voided",
  "lost",
  "dead",
  "archived",
]);

export function isClosedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const v = status.trim().toLowerCase();
  return CLOSED_STATUSES.has(v) || v.startsWith("closed") || v.startsWith("cancel");
}

export function serializeJob(job: JobWithRelations) {
  const variance =
    job.currentEstimate != null && job.committedEstimate != null
      ? job.currentEstimate - job.committedEstimate
      : null;

  const variancePct =
    variance != null && job.committedEstimate
      ? (variance / job.committedEstimate) * 100
      : null;

  // Actual gross-profit margin (%) from the uploaded GP$ ÷ current estimate.
  const actualGpPct =
    job.actualGp != null && job.currentEstimate
      ? (job.actualGp / job.currentEstimate) * 100
      : null;

  // Action items arrive newest-first; surface the most recent OPEN one inline,
  // falling back to the most recent of any status.
  const openActions = job.actionItems.filter((a) => a.status === "open");
  const latestActionItem = openActions[0] ?? job.actionItems[0] ?? null;

  // Drop the raw uploaded row from API payloads — it's kept for auditing but
  // sending ~2,000 of them to the browser bloats every list response.
  const { rawData: _rawData, ...rest } = job;
  void _rawData;

  return {
    ...rest,
    variance,
    variancePct,
    actualGpPct,
    latestActionItem,
    openActionCount: openActions.length,
    isOpen: !job.struckOut && !job.closedFromExport && !isClosedStatus(job.jobStatus),
  };
}

export const JOB_RELATION_INCLUDE = {
  actionItems: { orderBy: { createdAt: "desc" as const } },
  billingForecasts: { orderBy: { month: "asc" as const } },
};
