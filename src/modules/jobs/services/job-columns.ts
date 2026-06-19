/**
 * Auto-detects which columns of an uploaded RMS export map to the Job fields
 * the dashboard cares about. The export is dropped in with zero configuration
 * (whitepaper §6.4), so we detect headers by name rather than asking the user
 * to map every column each week.
 *
 * Only Layer A (uploaded) fields are detected here — Layer B (manual
 * accountability data) never comes from the export.
 */

export type JobColumnField =
  | "jobNumber"
  | "customerName"
  | "office"
  | "pm"
  | "jobStatus"
  | "currentEstimate"
  | "actualGp"
  | "rmsUrl"
  | "externalId";

export type JobColumnMapping = Record<JobColumnField, string | null>;

// Canonical field → known header names (lowercase, "_"/"-" treated as spaces).
// Bare ambiguous words ("job", "claim") are deliberately excluded so compound
// headers like "Job Status" / "Job Value" are not mis-claimed as the key.
const FIELD_ALIASES: Record<JobColumnField, string[]> = {
  jobNumber: [
    "job number", "job no", "job num", "jobno", "jobnum", "job #", "job#",
    "claim number", "claim no", "claim #", "file number", "file no",
    "reference number", "ref number", "reference no", "work order number",
    "wo number", "job code", "project number", "project no", "loss number",
  ],
  externalId: [
    "job id", "jobid", "job guid", "guid", "rms id", "dash id", "internal id",
    "system id", "job key", "uuid",
  ],
  jobStatus: [
    "status", "job status", "stage", "phase", "workflow status",
    "current status", "job stage", "work status", "status name",
  ],
  customerName: [
    "customer", "customer name", "client", "client name", "insured",
    "insured name", "policyholder", "policy holder", "contact name",
    "homeowner", "property owner", "loss name", "name",
  ],
  office: [
    "office", "franchise", "franchise code", "location", "branch", "region",
    "division", "office name", "franchise name", "market",
  ],
  pm: [
    "pm", "project manager", "projectmanager", "manager", "estimator",
    "assigned to", "assigned", "rep", "sales rep", "coordinator", "pm name",
    "supervisor", "owner",
  ],
  currentEstimate: [
    "estimate", "estimate value", "estimate amount", "current estimate",
    "total estimate", "total estimates", "approved estimate", "rcv",
    "estimate total", "contract amount", "contract value", "job value",
    "job amount", "amount", "total", "value", "est value", "est amount",
    "sold estimate",
  ],
  actualGp: [
    "estimate gp", "gross profit", "estimate gross profit", "gp($)",
    "gross profit($)", "estimate gp($)", "gp after wo adjustment",
    "estimate gp after wo adjustment",
  ],
  rmsUrl: [
    "url", "link", "job url", "rms link", "job link", "rms url", "web link",
    "hyperlink", "deep link",
  ],
};

// Order in which fields are considered for each header. Earlier wins ties.
const FIELD_ORDER: JobColumnField[] = [
  "jobNumber",
  "externalId",
  "jobStatus",
  "customerName",
  "office",
  "pm",
  "actualGp",
  "currentEstimate",
  "rmsUrl",
];

function normalize(header: string): string {
  return header.toLowerCase().trim().replace(/[_-]/g, " ").replace(/\s+/g, " ");
}

export interface JobColumnDetection {
  mapping: JobColumnMapping;
  unmatchedHeaders: string[];
}

export function detectJobColumns(headers: string[]): JobColumnDetection {
  const mapping: JobColumnMapping = {
    jobNumber: null,
    customerName: null,
    office: null,
    pm: null,
    jobStatus: null,
    currentEstimate: null,
    actualGp: null,
    rmsUrl: null,
    externalId: null,
  };

  const usedFields = new Set<JobColumnField>();
  const usedHeaders = new Set<string>();

  for (const header of headers) {
    const norm = normalize(header);
    let bestField: JobColumnField | null = null;
    let bestConfidence = 0;

    for (const field of FIELD_ORDER) {
      if (usedFields.has(field)) continue;

      for (const alias of FIELD_ALIASES[field]) {
        let confidence = 0;
        if (norm === alias) {
          confidence = 1.0;
        } else if (
          norm.length > 2 &&
          (norm.includes(alias) || alias.includes(norm))
        ) {
          confidence = 0.7;
        }
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestField = field;
        }
      }
      if (bestConfidence === 1.0) break;
    }

    if (bestField && bestConfidence >= 0.5) {
      mapping[bestField] = header;
      usedFields.add(bestField);
      usedHeaders.add(header);
    }
  }

  // Guarded fallback: if no job-number column matched, look for any header that
  // clearly names an identifier (e.g. a bare "Job", "Claim #", "File").
  if (!mapping.jobNumber) {
    const idWords = ["number", " no", "#", "id", "code", "num"];
    const subjectWords = ["job", "claim", "file", "project", "work order"];
    const fallback = headers.find((h) => {
      if (usedHeaders.has(h)) return false;
      const norm = normalize(h);
      return (
        subjectWords.some((s) => norm.includes(s)) &&
        (idWords.some((w) => norm.includes(w)) || subjectWords.includes(norm))
      );
    });
    if (fallback) {
      mapping.jobNumber = fallback;
      usedHeaders.add(fallback);
    }
  }

  const unmatchedHeaders = headers.filter((h) => !usedHeaders.has(h));
  return { mapping, unmatchedHeaders };
}

/** Parse a currency-ish string ("$42,500.00", "(1,200)") into a number. */
export function parseCurrency(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const negative = /^\(.*\)$/.test(str) || str.includes("-");
  const cleaned = str.replace(/[^0-9.]/g, "");
  if (cleaned === "" || cleaned === ".") return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}
