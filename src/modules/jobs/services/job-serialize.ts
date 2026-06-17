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

export function serializeJob(job: JobWithRelations) {
  const variance =
    job.currentEstimate != null && job.committedEstimate != null
      ? job.currentEstimate - job.committedEstimate
      : null;

  const variancePct =
    variance != null && job.committedEstimate
      ? (variance / job.committedEstimate) * 100
      : null;

  // Action items arrive newest-first; surface the most recent OPEN one inline,
  // falling back to the most recent of any status.
  const openActions = job.actionItems.filter((a) => a.status === "open");
  const latestActionItem = openActions[0] ?? job.actionItems[0] ?? null;

  return {
    ...job,
    variance,
    variancePct,
    latestActionItem,
    openActionCount: openActions.length,
    isOpen: !job.struckOut && !job.closedFromExport,
  };
}

export const JOB_RELATION_INCLUDE = {
  actionItems: { orderBy: { createdAt: "desc" as const } },
  billingForecasts: { orderBy: { month: "asc" as const } },
};
