import { parseFile } from "./file-parser";
import { normalizeRow, NormalizedContact } from "./normalizer";
import { findDuplicatesForContact, createDuplicateGroup } from "./deduplicator";
import { computeDataQualityScore } from "./data-quality";
import prisma from "@/lib/prisma";
import { readFile } from "fs/promises";
import { OrgType, PropertyType } from "@/generated/prisma/client";

async function updateStatus(
  importBatchId: string,
  status: string,
  extra?: Record<string, any>
) {
  await prisma.importBatch.update({
    where: { id: importBatchId },
    data: { status: status as any, ...extra },
  });
}

function detectOrgType(raw: string | null): OrgType | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("hoa") || lower.includes("homeowner")) return "HOA";
  if (lower.includes("coa") || lower.includes("condo")) return "CONDO_ASSOCIATION";
  if (lower.includes("management") || lower.includes("mgmt") || lower.includes("pm")) return "PROPERTY_MANAGEMENT";
  if (lower.includes("owner")) return "BUILDING_OWNER";
  if (lower.includes("developer")) return "DEVELOPER";
  if (lower.includes("insurance")) return "INSURANCE";
  return "OTHER";
}

function detectPropertyType(raw: string | null): PropertyType | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("luxury") || lower.includes("lux")) return "LUXURY_CONDO";
  if (lower.includes("high-rise") || lower.includes("highrise") || lower.includes("high rise")) return "HIGH_RISE";
  if (lower.includes("mid-rise") || lower.includes("midrise")) return "MID_RISE";
  if (lower.includes("low-rise") || lower.includes("lowrise")) return "LOW_RISE";
  if (lower.includes("townhome") || lower.includes("townhouse")) return "TOWNHOME";
  if (lower.includes("single") || lower.includes("sfr")) return "SINGLE_FAMILY";
  if (lower.includes("hoa") || lower.includes("community")) return "HOA_COMMUNITY";
  if (lower.includes("commercial")) return "COMMERCIAL";
  if (lower.includes("mixed")) return "MIXED_USE";
  if (lower.includes("condo")) return "LUXURY_CONDO";
  return "OTHER";
}

function extractDomain(emailOrWebsite: string | null): string | null {
  if (!emailOrWebsite) return null;
  if (emailOrWebsite.includes("@")) {
    return emailOrWebsite.split("@")[1]?.toLowerCase() ?? null;
  }
  try {
    const url = emailOrWebsite.startsWith("http")
      ? emailOrWebsite
      : `https://${emailOrWebsite}`;
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

async function assignTerritory(zipCode: string | null): Promise<string | null> {
  if (!zipCode) return null;
  const territory = await prisma.territory.findFirst({
    where: { zipCodes: { has: zipCode } },
  });
  return territory?.id ?? null;
}

export async function processImport(importBatchId: string): Promise<void> {
  const batch = await prisma.importBatch.findUniqueOrThrow({
    where: { id: importBatchId },
  });

  try {
    await updateStatus(importBatchId, "PROCESSING", {
      processingStartedAt: new Date(),
    });

    // Read file
    const fileBuffer = await readFile(batch.filePath);
    const parsed = await parseFile(fileBuffer, batch.fileName);

    const mapping = (batch.columnMapping as Record<string, string>) ?? {};

    let processedRows = 0;
    let skippedRows = 0;
    let errorRows = 0;
    let newContacts = 0;
    let newOrganizations = 0;
    let newProperties = 0;
    let duplicatesFound = 0;

    // Process each row
    for (let i = 0; i < parsed.rows.length; i++) {
      try {
        const normalized = normalizeRow(parsed.rows[i], mapping);

        // Skip rows with no useful data at all (no name, no email, no phone, no org)
        const hasAnyIdentifier =
          normalized.firstName ||
          normalized.lastName ||
          normalized.email ||
          normalized.phone ||
          normalized.organizationName;

        if (!hasAnyIdentifier) {
          await prisma.importRow.create({
            data: {
              importBatchId,
              rowNumber: i + 2,
              rawData: parsed.rows[i] as any,
              status: "skipped",
              errorMessage: "No identifiable data (no name, email, phone, or organization)",
            },
          });
          skippedRows++;
          continue;
        }

        // If we still have no name at all, use "Unknown" as placeholder
        if (!normalized.firstName && !normalized.lastName) {
          normalized.firstName = "Unknown";
          normalized.fullName = "Unknown";
        }

        // Upsert organization
        let organizationId: string | null = null;
        if (normalized.organizationName) {
          const nameNormalized = normalized.organizationName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
          const existing = await prisma.organization.findFirst({
            where: { nameNormalized },
          });

          if (existing) {
            organizationId = existing.id;
          } else {
            const domain = extractDomain(normalized.email) || extractDomain(normalized.organizationWebsite);
            const org = await prisma.organization.create({
              data: {
                name: normalized.organizationName,
                nameNormalized,
                orgType: detectOrgType(normalized.organizationType),
                website: normalized.organizationWebsite,
                domain,
                phone: normalized.organizationPhone,
                source: batch.source,
                importBatchId,
              },
            });
            organizationId = org.id;
            newOrganizations++;
          }
        }

        // Upsert property
        let propertyId: string | null = null;
        if (normalized.propertyName || normalized.addressLine1) {
          const propName = normalized.propertyName || normalized.addressLine1 || "Unknown";
          const nameNormalized = propName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

          // Match on normalized name + city/zip
          const existing = await prisma.property.findFirst({
            where: {
              nameNormalized,
              ...(normalized.zipCode ? { zipCode: normalized.zipCode } : {}),
            },
          });

          if (existing) {
            propertyId = existing.id;
          } else if (normalized.addressLine1 && normalized.city && normalized.state) {
            const territoryId = await assignTerritory(normalized.zipCode);
            const prop = await prisma.property.create({
              data: {
                name: propName,
                nameNormalized,
                propertyType: detectPropertyType(normalized.propertyType),
                addressLine1: normalized.addressLine1,
                addressLine2: normalized.addressLine2,
                city: normalized.city,
                state: normalized.state,
                zipCode: normalized.zipCode || "",
                county: normalized.county,
                unitCount: normalized.unitCount,
                yearBuilt: normalized.yearBuilt,
                floors: normalized.floors,
                territoryId,
                importBatchId,
              },
            });
            propertyId = prop.id;
            newProperties++;
          }
        }

        // Create contact
        const territoryId = await assignTerritory(normalized.zipCode);
        const contact = await prisma.contact.create({
          data: {
            prefix: normalized.prefix,
            firstName: normalized.firstName,
            lastName: normalized.lastName,
            suffix: normalized.suffix,
            fullName: normalized.fullName,
            title: normalized.title,
            department: normalized.department,
            email: normalized.email,
            emailSecondary: normalized.emailSecondary,
            phone: normalized.phone,
            phoneSecondary: normalized.phoneSecondary,
            phoneMobile: normalized.phoneMobile,
            fax: normalized.fax,
            addressLine1: normalized.addressLine1,
            addressLine2: normalized.addressLine2,
            city: normalized.city,
            state: normalized.state,
            zipCode: normalized.zipCode,
            county: normalized.county,
            organizationId,
            territoryId,
            source: batch.source,
            status: "RAW",
            isGoldenRecord: true,
            importBatchId,
            sourceRowNumber: i + 2,
          },
        });

        // Compute data quality
        const qualityScore = computeDataQualityScore(contact);
        await prisma.contact.update({
          where: { id: contact.id },
          data: { dataQualityScore: qualityScore },
        });

        // Link contact to property
        if (propertyId) {
          await prisma.contactProperty.create({
            data: {
              contactId: contact.id,
              propertyId,
              role: normalized.title,
              isPrimary: true,
            },
          }).catch(() => {}); // Ignore unique constraint violations
        }

        // Track import row
        await prisma.importRow.create({
          data: {
            importBatchId,
            rowNumber: i + 2,
            rawData: parsed.rows[i] as any,
            normalizedData: normalized as any,
            status: "processed",
            contactId: contact.id,
            organizationId,
            propertyId,
          },
        });

        newContacts++;
        processedRows++;
      } catch (err) {
        errorRows++;
        await prisma.importError.create({
          data: {
            importBatchId,
            rowNumber: i + 2,
            errorType: "processing_error",
            message: err instanceof Error ? err.message : String(err),
          },
        });
        await prisma.importRow.create({
          data: {
            importBatchId,
            rowNumber: i + 2,
            rawData: parsed.rows[i] as any,
            status: "error",
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    // Deduplication phase
    await updateStatus(importBatchId, "DEDUPLICATING");

    const importedContacts = await prisma.contact.findMany({
      where: { importBatchId, isGoldenRecord: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        organizationId: true,
      },
    });

    for (const contact of importedContacts) {
      const duplicate = await findDuplicatesForContact(contact);
      if (duplicate) {
        await createDuplicateGroup(duplicate);
        duplicatesFound++;
      }
    }

    // Mark complete
    await prisma.importBatch.update({
      where: { id: importBatchId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalRows: parsed.totalRows,
        processedRows,
        skippedRows,
        errorRows,
        newContacts,
        newOrganizations,
        newProperties,
        duplicatesFound,
      },
    });
  } catch (error) {
    await prisma.importBatch.update({
      where: { id: importBatchId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
