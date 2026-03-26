import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { scoreContact } from "@/modules/scoring/services/lead-scorer";

/**
 * Apollo CSV Enrichment Importer
 *
 * Matches Apollo-exported contacts to existing DB records by email,
 * then updates phone numbers, LinkedIn, AI research brief, and org intel.
 */

// Apollo CSV column → our field mapping
const APOLLO_COLUMN_MAP = {
  "First Name": "firstName",
  "Last Name": "lastName",
  Title: "title",
  "Company Name": "companyName",
  Email: "email",
  "Work Direct Phone": "workDirectPhone",
  "Home Phone": "homePhone",
  "Mobile Phone": "mobilePhone",
  "Corporate Phone": "corporatePhone",
  "Other Phone": "otherPhone",
  Seniority: "seniority",
  Departments: "departments",
  Industry: "industry",
  "# Employees": "employeeCount",
  "Annual Revenue": "annualRevenue",
  "Person Linkedin Url": "linkedinUrl",
  Website: "website",
  "Company Linkedin Url": "companyLinkedinUrl",
  "Company Address": "companyAddress",
  "Company City": "companyCity",
  "Company State": "companyState",
  "Company Country": "companyCountry",
  "Company Phone": "companyPhone",
  "Apollo Contact Id": "apolloContactId",
  "Apollo Account Id": "apolloAccountId",
  Keywords: "keywords",
  Technologies: "technologies",
  "Total Funding": "totalFunding",
  "Latest Funding": "latestFunding",
  "AI custom field 2656": "aiResearchBrief",
  "Property & News Summary 2331": "propertyNewsSummary",
} as const;

export interface ApolloRow {
  firstName: string;
  lastName: string;
  title: string;
  companyName: string;
  email: string;
  workDirectPhone: string;
  homePhone: string;
  mobilePhone: string;
  corporatePhone: string;
  otherPhone: string;
  seniority: string;
  departments: string;
  industry: string;
  employeeCount: string;
  annualRevenue: string;
  linkedinUrl: string;
  website: string;
  companyLinkedinUrl: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyCountry: string;
  companyPhone: string;
  apolloContactId: string;
  apolloAccountId: string;
  keywords: string;
  technologies: string;
  totalFunding: string;
  latestFunding: string;
  aiResearchBrief: string;
  propertyNewsSummary: string;
}

export interface ImportResult {
  totalRows: number;
  matched: number;
  updated: number;
  unmatched: number;
  errors: number;
  orgsUpdated: number;
  scored: number;
  details: {
    updatedContacts: { id: string; email: string; name: string }[];
    unmatchedRows: { email: string; name: string; company: string }[];
    errorRows: { email: string; error: string }[];
  };
}

/**
 * Parse raw CSV rows (from file-parser or manual parse) into typed Apollo rows.
 */
export function mapApolloColumns(
  rawRows: Record<string, string>[]
): ApolloRow[] {
  return rawRows.map((raw) => {
    const mapped: Record<string, string> = {};
    for (const [csvCol, field] of Object.entries(APOLLO_COLUMN_MAP)) {
      const val = raw[csvCol];
      // XLSX parser may return numbers — coerce everything to string
      mapped[field] = val != null ? String(val).trim() : "";
    }
    return mapped as unknown as ApolloRow;
  });
}

/**
 * Normalize a phone string — strip non-digits, ensure US format.
 */
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 7) return `+${digits}`;
  return null;
}

/**
 * Pick the best available phone for each slot.
 * Priority: corporate → work direct → other for main phone.
 */
function resolvePhones(row: ApolloRow) {
  return {
    phone: normalizePhone(row.corporatePhone) || normalizePhone(row.workDirectPhone) || normalizePhone(row.otherPhone),
    phoneMobile: normalizePhone(row.mobilePhone),
    phoneSecondary: normalizePhone(row.workDirectPhone) || normalizePhone(row.homePhone),
  };
}

/**
 * Parse employee count like "1,001-5,000" → midpoint integer.
 */
function parseEmployeeCount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const rangeMatch = cleaned.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    return Math.round((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2);
  }
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Build a structured enrichment brief from Apollo AI fields.
 * Stored as JSON string in contact.enrichmentBrief.
 */
function buildEnrichmentBrief(row: ApolloRow): string {
  const brief = {
    source: "apollo",
    importedAt: new Date().toISOString(),
    summary: row.aiResearchBrief || null,
    propertyNewsSummary: row.propertyNewsSummary || null,
    apolloMeta: {
      seniority: row.seniority || null,
      departments: row.departments || null,
      keywords: row.keywords || null,
      technologies: row.technologies || null,
      totalFunding: row.totalFunding || null,
      latestFunding: row.latestFunding || null,
    },
  };
  return JSON.stringify(brief);
}

/**
 * Extract pain triggers from the AI research brief.
 * Looks for keywords relevant to Paul Davis restoration services.
 */
function extractPainTriggers(aiText: string): string[] {
  if (!aiText) return [];
  const triggers: string[] = [];
  const text = aiText.toLowerCase();

  const triggerPatterns: [RegExp, string][] = [
    [/oceanfront|ocean.?front|beachfront/, "Oceanfront property exposure"],
    [/high.?rise|high rise/, "High-rise building management"],
    [/luxury|high.?end/, "Luxury property standards"],
    [/hurricane|storm|wind damage|tropical/, "Hurricane/storm risk"],
    [/flood|water damage|water intrusion/, "Flood/water damage risk"],
    [/aging|older building|built (?:19[0-7]\d|198\d)/, "Aging infrastructure"],
    [/mold|remediat/, "Mold remediation needs"],
    [/fire|smoke/, "Fire/smoke damage risk"],
    [/insurance claim|insurance.*restoration/, "Insurance claims experience"],
    [/multiple propert|portfolio.*\d+/, "Multi-property portfolio"],
    [/condo.*association|hoa|community.*association/, "Association management"],
    [/renovation|remodel|capital improvement/, "Active renovation/capex"],
  ];

  for (const [pattern, trigger] of triggerPatterns) {
    if (pattern.test(text)) {
      triggers.push(trigger);
    }
  }
  return triggers;
}

/**
 * Extract personalization hooks from the AI brief.
 */
function extractPersonalizationHooks(row: ApolloRow): string[] {
  const hooks: string[] = [];
  const text = row.aiResearchBrief?.toLowerCase() || "";

  if (row.linkedinUrl) hooks.push(`LinkedIn: ${row.linkedinUrl}`);
  if (row.seniority) hooks.push(`Seniority: ${row.seniority}`);
  if (row.departments) hooks.push(`Department: ${row.departments}`);

  // Extract specific property names mentioned
  const propertyMention = row.aiResearchBrief?.match(
    /(?:manages?|oversees?|responsible for)\s+([^.]+)/i
  );
  if (propertyMention) hooks.push(`Manages: ${propertyMention[1].trim()}`);

  // Industry context
  if (row.industry) hooks.push(`Industry: ${row.industry}`);

  // Local presence
  if (/palm beach|martin county|st\.?\s*lucie|indian river|treasure coast/i.test(text)) {
    hooks.push("Local to Paul Davis territory");
  }

  return hooks;
}

/**
 * Build company intel JSON for Organization.companyIntel.
 */
function buildCompanyIntel(row: ApolloRow): Record<string, unknown> {
  return {
    source: "apollo",
    industry: row.industry || null,
    employeeCount: row.employeeCount || null,
    annualRevenue: row.annualRevenue || null,
    keywords: row.keywords?.split(",").map((k) => k.trim()).filter(Boolean) || [],
    technologies: row.technologies?.split(",").map((t) => t.trim()).filter(Boolean) || [],
    totalFunding: row.totalFunding || null,
    latestFunding: row.latestFunding || null,
    companyLinkedinUrl: row.companyLinkedinUrl || null,
    companyAddress: [row.companyAddress, row.companyCity, row.companyState]
      .filter(Boolean)
      .join(", ") || null,
    apolloAccountId: row.apolloAccountId || null,
  };
}

/**
 * Main import function: match Apollo CSV rows to existing contacts by email,
 * update enrichment fields, phone numbers, and org data.
 */
export async function importApolloEnrichment(
  rows: ApolloRow[],
  onProgress?: (processed: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    totalRows: rows.length,
    matched: 0,
    updated: 0,
    unmatched: 0,
    errors: 0,
    orgsUpdated: 0,
    scored: 0,
    details: {
      updatedContacts: [],
      unmatchedRows: [],
      errorRows: [],
    },
  };

  // Pre-fetch all emails from the CSV for batch lookup
  const csvEmails = rows
    .map((r) => r.email?.toLowerCase().trim())
    .filter(Boolean);

  // Batch lookup: find all existing contacts matching these emails
  const existingContacts = await prisma.contact.findMany({
    where: {
      email: { in: csvEmails },
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      phoneMobile: true,
      phoneSecondary: true,
      organizationId: true,
      status: true,
      enrichmentBrief: true,
    },
  });

  // Build email → contact lookup map
  const contactByEmail = new Map<string, (typeof existingContacts)[0]>();
  for (const c of existingContacts) {
    if (c.email) contactByEmail.set(c.email.toLowerCase(), c);
  }

  // Track orgs we've already updated this run
  const updatedOrgIds = new Set<string>();

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = row.email?.toLowerCase().trim();

    if (!email) {
      result.errors++;
      result.details.errorRows.push({
        email: "",
        error: "No email in row",
      });
      onProgress?.(i + 1, rows.length);
      continue;
    }

    const contact = contactByEmail.get(email);

    if (!contact) {
      result.unmatched++;
      result.details.unmatchedRows.push({
        email: row.email,
        name: `${row.firstName} ${row.lastName}`.trim(),
        company: row.companyName,
      });
      onProgress?.(i + 1, rows.length);
      continue;
    }

    result.matched++;

    try {
      // Resolve phone numbers — only update if we have new data and field is empty
      const phones = resolvePhones(row);
      const enrichmentBrief = buildEnrichmentBrief(row);
      const painTriggers = extractPainTriggers(row.aiResearchBrief);
      const personalizationHooks = extractPersonalizationHooks(row);

      // Update contact
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          // Phone: only fill if currently empty
          ...(phones.phone && !contact.phone ? { phone: phones.phone } : {}),
          ...(phones.phoneMobile && !contact.phoneMobile ? { phoneMobile: phones.phoneMobile } : {}),
          ...(phones.phoneSecondary && !contact.phoneSecondary ? { phoneSecondary: phones.phoneSecondary } : {}),
          // LinkedIn & Apollo ID
          ...(row.linkedinUrl ? { linkedinUrl: row.linkedinUrl } : {}),
          ...(row.apolloContactId ? { apolloContactId: row.apolloContactId } : {}),
          // Title — update if Apollo has one and ours is empty
          ...(row.title && !contact.fullName.includes(row.title) ? { title: row.title } : {}),
          // Enrichment fields
          enrichmentBrief,
          painTriggers,
          personalizationHooks,
          lastEnrichedAt: new Date(),
          // Only upgrade status if currently RAW or VALIDATED
          ...(contact.status === "RAW" || contact.status === "VALIDATED"
            ? { status: "ENRICHED" as const }
            : {}),
        },
      });

      result.updated++;
      result.details.updatedContacts.push({
        id: contact.id,
        email: contact.email!,
        name: contact.fullName,
      });

      // Update organization if we haven't already this run
      if (contact.organizationId && !updatedOrgIds.has(contact.organizationId)) {
        const companyIntel = buildCompanyIntel(row) as Prisma.InputJsonValue;
        const empCount = parseEmployeeCount(row.employeeCount);

        await prisma.organization.update({
          where: { id: contact.organizationId },
          data: {
            companyIntel,
            ...(row.industry ? { industry: row.industry } : {}),
            ...(row.annualRevenue ? { annualRevenue: row.annualRevenue } : {}),
            ...(empCount ? { employeeCount: empCount } : {}),
            ...(row.website ? { website: row.website } : {}),
            ...(row.companyLinkedinUrl ? { linkedinUrl: row.companyLinkedinUrl } : {}),
            ...(row.apolloAccountId ? { apolloAccountId: row.apolloAccountId } : {}),
            ...(row.companyPhone ? { phone: normalizePhone(row.companyPhone) || undefined } : {}),
          },
        });

        updatedOrgIds.add(contact.organizationId);
        result.orgsUpdated++;
      }
    } catch (err) {
      result.errors++;
      result.details.errorRows.push({
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    onProgress?.(i + 1, rows.length);
  }

  console.log(
    `[Apollo Import] Complete: ${result.matched} matched, ${result.updated} updated, ` +
      `${result.unmatched} unmatched, ${result.errors} errors, ${result.orgsUpdated} orgs updated`
  );

  // Auto-score all successfully updated contacts
  if (result.details.updatedContacts.length > 0) {
    console.log(`[Apollo Import] Scoring ${result.details.updatedContacts.length} contacts...`);
    let scored = 0;
    for (const c of result.details.updatedContacts) {
      try {
        await scoreContact(c.id);
        scored++;
      } catch {
        // scoring failures are non-critical
      }
    }
    result.scored = scored;
    console.log(`[Apollo Import] Scored ${scored} contacts`);
  }

  return result;
}
