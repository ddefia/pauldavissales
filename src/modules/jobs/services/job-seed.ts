/**
 * Built-in ("hardcoded") job data. The RMS export is baked into the app as
 * src/modules/jobs/data/seed-jobs.json and loaded into the database, so the
 * jobs are always present — even on a brand-new install — without an upload.
 *
 * Seeding only INSERTS job numbers that don't already exist, snapshotting the
 * committed estimate. It never touches manual (Layer B) data or existing rows,
 * so it's safe to run repeatedly.
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import seedData from "@/modules/jobs/data/seed-jobs.json";

interface SeedJob {
  jobNumber: string;
  customerName: string | null;
  office: string | null;
  pm: string | null;
  jobStatus: string | null;
  currentEstimate: number | null;
  actualGp: number | null;
  rmsUrl: string | null;
  externalId: string | null;
}

const SEED_JOBS = seedData as SeedJob[];
export const BUILT_IN_JOB_COUNT = SEED_JOBS.length;

export async function seedBuiltInJobs(): Promise<{
  inserted: number;
  alreadyPresent: number;
  total: number;
}> {
  const existing = await prisma.job.findMany({ select: { jobNumber: true } });
  const have = new Set(existing.map((j) => j.jobNumber));
  const now = new Date();

  const toCreate: Prisma.JobCreateManyInput[] = [];
  for (const j of SEED_JOBS) {
    if (have.has(j.jobNumber)) continue;
    toCreate.push({
      jobNumber: j.jobNumber,
      customerName: j.customerName,
      office: j.office,
      pm: j.pm,
      jobStatus: j.jobStatus,
      currentEstimate: j.currentEstimate,
      actualGp: j.actualGp,
      rmsUrl: j.rmsUrl,
      externalId: j.externalId,
      firstSeenAt: now,
      lastSeenAt: now,
      ...(j.currentEstimate != null
        ? { committedEstimate: j.currentEstimate, committedEstimateAt: now }
        : {}),
    });
  }

  const CHUNK = 500;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await prisma.job.createMany({
      data: toCreate.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
  }

  return {
    inserted: toCreate.length,
    alreadyPresent: SEED_JOBS.length - toCreate.length,
    total: SEED_JOBS.length,
  };
}

/**
 * Remove jobs whose job number is NOT in the built-in dataset (e.g. old test
 * uploads), making the baked-in data the single source. Cascade deletes their
 * action items / forecasts / revisions. Only runs from the explicit,
 * user-confirmed Settings action — never from an upload.
 */
export async function removeJobsOutsideBuiltIn(): Promise<number> {
  const keep = new Set(SEED_JOBS.map((j) => j.jobNumber));
  const existing = await prisma.job.findMany({
    select: { id: true, jobNumber: true },
  });
  const doomed = existing.filter((j) => !keep.has(j.jobNumber)).map((j) => j.id);
  if (doomed.length === 0) return 0;
  const CHUNK = 500;
  for (let i = 0; i < doomed.length; i += CHUNK) {
    await prisma.job.deleteMany({ where: { id: { in: doomed.slice(i, i + CHUNK) } } });
  }
  return doomed.length;
}

// Guards against duplicate concurrent seeds within a single instance.
let _seeding: Promise<unknown> | null = null;

/** Auto-load the built-in jobs the first time the tool is opened on an empty DB. */
export async function ensureJobsSeeded(): Promise<void> {
  const count = await prisma.job.count();
  if (count > 0) return;
  if (!_seeding) {
    _seeding = seedBuiltInJobs().finally(() => {
      _seeding = null;
    });
  }
  await _seeding;
}
