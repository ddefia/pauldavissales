/**
 * Job import = UPSERT keyed on job number. Never a wipe-and-replace.
 *
 * (Whitepaper §4.3 — the single instruction the build must contain:)
 *   Uploading a new export is an UPSERT keyed on job number. Update only
 *   uploaded fields on matched jobs; preserve all manually entered fields;
 *   insert new jobs; flag missing jobs as closed without deleting.
 *
 * This module touches ONLY Layer A (uploaded) fields on existing rows. Every
 * Layer B field (committed estimate snapshot, target margin, target date,
 * billing forecast, action items, strike-out) is left untouched.
 */

import prisma from "@/lib/prisma";
import { parseFile } from "@/modules/ingest/services/file-parser";
import {
  detectJobColumns,
  parseCurrency,
  type JobColumnMapping,
} from "./job-columns";

export interface JobImportResult {
  importLogId: string;
  fileName: string;
  totalRows: number;
  matched: number; // existing jobs updated (Layer A only)
  inserted: number; // job numbers seen for the first time
  closed: number; // disappeared from this export, flagged closed
  skipped: number; // rows with no job number
  reopened: number; // previously closed jobs that came back
  detectedColumns: JobColumnMapping;
  unmatchedHeaders: string[];
  jobNumberColumn: string | null;
}

export class JobImportError extends Error {}

function cleanString(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Parse + upsert an RMS export buffer into the Job table.
 * Returns a summary so the UI can show "N updated, N new, N closed —
 * all manual data preserved" (whitepaper §6.4).
 */
export async function processJobImport(
  buffer: Buffer,
  fileName: string,
  fileSize: number,
  uploadedById: string | null
): Promise<JobImportResult> {
  const parsed = await parseFile(buffer, fileName);
  const { mapping, unmatchedHeaders } = detectJobColumns(parsed.headers);

  if (!mapping.jobNumber) {
    throw new JobImportError(
      `Could not find a Job Number column. Detected headers: ${parsed.headers.join(
        ", "
      )}. The export must include a unique, stable job number (whitepaper §13).`
    );
  }

  const col = mapping; // shorthand
  const get = (row: Record<string, string>, field: keyof JobColumnMapping) => {
    const header = col[field];
    return header ? cleanString(row[header]) : null;
  };

  // Snapshot existing jobs once, so we can tell matched-vs-new and detect
  // disappearances without a query per row.
  const existing = await prisma.job.findMany({
    select: {
      id: true,
      jobNumber: true,
      committedEstimate: true,
      struckOut: true,
      closedFromExport: true,
    },
  });
  const existingByNumber = new Map(existing.map((j) => [j.jobNumber, j]));

  // Create the import log up front so each job can reference it.
  const importLog = await prisma.jobImportLog.create({
    data: {
      fileName,
      fileSize,
      jobNumberColumn: col.jobNumber,
      detectedColumns: col as unknown as object,
      uploadedById,
    },
  });

  const seen = new Set<string>();
  let matched = 0;
  let inserted = 0;
  let skipped = 0;
  let reopened = 0;
  const now = new Date();

  for (const row of parsed.rows) {
    const jobNumber = get(row, "jobNumber");
    if (!jobNumber) {
      skipped++;
      continue;
    }
    // First occurrence in this file wins (guards against duplicate rows).
    if (seen.has(jobNumber)) continue;
    seen.add(jobNumber);

    // ── Layer A fields, refreshed from the export every upload ──
    const layerA = {
      customerName: get(row, "customerName"),
      office: get(row, "office"),
      pm: get(row, "pm"),
      jobStatus: get(row, "jobStatus"),
      currentEstimate: parseCurrency(get(row, "currentEstimate")),
      actualGp: parseCurrency(get(row, "actualGp")),
      rmsUrl: get(row, "rmsUrl"),
      externalId: get(row, "externalId"),
      rawData: row as unknown as object,
      lastSeenAt: now,
      lastImportId: importLog.id,
    };

    const prior = existingByNumber.get(jobNumber);

    if (prior) {
      // UPDATE — Layer A only. Layer B is never named here, so it is preserved.
      const wasClosed = prior.closedFromExport;
      await prisma.job.update({
        where: { id: prior.id },
        data: {
          ...layerA,
          // Job reappeared in the export → it is open again.
          closedFromExport: false,
          closedFromExportAt: null,
          // Snapshot the committed estimate the first time we ever see a value
          // for a job that didn't have one captured yet. Never overwrite.
          ...(prior.committedEstimate == null && layerA.currentEstimate != null
            ? { committedEstimate: layerA.currentEstimate, committedEstimateAt: now }
            : {}),
        },
      });
      matched++;
      if (wasClosed) reopened++;
    } else {
      // INSERT — new job. Layer B starts empty; committed estimate is snapshotted.
      await prisma.job.create({
        data: {
          jobNumber,
          ...layerA,
          firstSeenAt: now,
          ...(layerA.currentEstimate != null
            ? { committedEstimate: layerA.currentEstimate, committedEstimateAt: now }
            : {}),
        },
      });
      inserted++;
    }
  }

  // Jobs present before but absent from this export → flag as closed.
  // NEVER delete; the accountability history is retained (whitepaper §4.3).
  const disappeared = existing.filter(
    (j) => !seen.has(j.jobNumber) && !j.closedFromExport && !j.struckOut
  );
  if (disappeared.length > 0) {
    await prisma.job.updateMany({
      where: { id: { in: disappeared.map((j) => j.id) } },
      data: { closedFromExport: true, closedFromExportAt: now },
    });
  }
  const closed = disappeared.length;

  const finalLog = await prisma.jobImportLog.update({
    where: { id: importLog.id },
    data: {
      totalRows: parsed.totalRows,
      matchedJobs: matched,
      newJobs: inserted,
      closedJobs: closed,
      skippedRows: skipped,
    },
  });

  return {
    importLogId: finalLog.id,
    fileName,
    totalRows: parsed.totalRows,
    matched,
    inserted,
    closed,
    skipped,
    reopened,
    detectedColumns: col,
    unmatchedHeaders,
    jobNumberColumn: col.jobNumber,
  };
}
