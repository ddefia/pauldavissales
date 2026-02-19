import { stringSimilarity } from "string-similarity-js";
import prisma from "@/lib/prisma";

export interface DuplicateCandidate {
  existingContactId: string;
  newContactId: string;
  confidence: number;
  matchReasons: string[];
}

const THRESHOLDS = {
  emailExactWeight: 0.4,
  nameFuzzyWeight: 0.3,
  nameFuzzyThreshold: 0.85,
  phoneExactWeight: 0.2,
  orgFuzzyWeight: 0.1,
  autoMergeThreshold: 0.95,
  reviewThreshold: 0.70,
};

export async function findDuplicatesForContact(contact: {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  organizationId: string | null;
}): Promise<DuplicateCandidate | null> {
  let bestMatch: DuplicateCandidate | null = null;

  // 1. Exact email match
  if (contact.email) {
    const emailMatches = await prisma.contact.findMany({
      where: {
        email: contact.email,
        id: { not: contact.id },
        isGoldenRecord: true,
      },
      select: { id: true, firstName: true, lastName: true, organizationId: true },
      take: 5,
    });

    for (const match of emailMatches) {
      const reasons: string[] = ["email_exact"];
      let score = THRESHOLDS.emailExactWeight;

      // Bonus: name similarity
      const nameSim = stringSimilarity(
        `${contact.firstName} ${contact.lastName}`.toLowerCase(),
        `${match.firstName} ${match.lastName}`.toLowerCase()
      );
      if (nameSim >= THRESHOLDS.nameFuzzyThreshold) {
        score += THRESHOLDS.nameFuzzyWeight;
        reasons.push(`name_fuzzy_${Math.round(nameSim * 100)}`);
      }

      if (match.organizationId && match.organizationId === contact.organizationId) {
        score += THRESHOLDS.orgFuzzyWeight;
        reasons.push("org_match");
      }

      if (!bestMatch || score > bestMatch.confidence) {
        bestMatch = {
          existingContactId: match.id,
          newContactId: contact.id,
          confidence: Math.min(score, 1.0),
          matchReasons: reasons,
        };
      }
    }
  }

  // 2. Exact phone match
  if (contact.phone) {
    const phoneMatches = await prisma.contact.findMany({
      where: {
        phone: contact.phone,
        id: { not: contact.id },
        isGoldenRecord: true,
      },
      select: { id: true, firstName: true, lastName: true, organizationId: true },
      take: 5,
    });

    for (const match of phoneMatches) {
      const reasons: string[] = ["phone_exact"];
      let score = THRESHOLDS.phoneExactWeight;

      const nameSim = stringSimilarity(
        `${contact.firstName} ${contact.lastName}`.toLowerCase(),
        `${match.firstName} ${match.lastName}`.toLowerCase()
      );
      if (nameSim >= THRESHOLDS.nameFuzzyThreshold) {
        score += THRESHOLDS.nameFuzzyWeight;
        reasons.push(`name_fuzzy_${Math.round(nameSim * 100)}`);
      }

      if (contact.email) {
        // Already checked email above, so this is a phone+name match
        score += 0.05;
      }

      if (match.organizationId && match.organizationId === contact.organizationId) {
        score += THRESHOLDS.orgFuzzyWeight;
        reasons.push("org_match");
      }

      if (!bestMatch || score > bestMatch.confidence) {
        bestMatch = {
          existingContactId: match.id,
          newContactId: contact.id,
          confidence: Math.min(score, 1.0),
          matchReasons: reasons,
        };
      }
    }
  }

  // 3. Fuzzy name + org match (no email/phone match)
  if (!bestMatch && contact.lastName) {
    const nameCandidates = await prisma.contact.findMany({
      where: {
        lastName: { startsWith: contact.lastName.charAt(0), mode: "insensitive" },
        id: { not: contact.id },
        isGoldenRecord: true,
      },
      select: { id: true, firstName: true, lastName: true, organizationId: true, email: true },
      take: 50,
    });

    for (const match of nameCandidates) {
      const nameSim = stringSimilarity(
        `${contact.firstName} ${contact.lastName}`.toLowerCase(),
        `${match.firstName} ${match.lastName}`.toLowerCase()
      );

      if (nameSim >= 0.92) {
        const reasons: string[] = [`name_fuzzy_${Math.round(nameSim * 100)}`];
        let score = THRESHOLDS.nameFuzzyWeight;

        if (match.organizationId && match.organizationId === contact.organizationId) {
          score += THRESHOLDS.orgFuzzyWeight;
          reasons.push("org_match");
        }

        if (score >= THRESHOLDS.reviewThreshold && (!bestMatch || score > bestMatch.confidence)) {
          bestMatch = {
            existingContactId: match.id,
            newContactId: contact.id,
            confidence: Math.min(score, 1.0),
            matchReasons: reasons,
          };
        }
      }
    }
  }

  return bestMatch && bestMatch.confidence >= THRESHOLDS.reviewThreshold
    ? bestMatch
    : null;
}

export async function createDuplicateGroup(
  candidate: DuplicateCandidate
): Promise<string> {
  // Check if existing contact is already in a pending group
  const existingGroup = await prisma.duplicateGroup.findFirst({
    where: {
      contacts: { some: { id: candidate.existingContactId } },
      status: "PENDING",
    },
  });

  if (existingGroup) {
    // Add new contact to existing group
    await prisma.contact.update({
      where: { id: candidate.newContactId },
      data: { duplicateGroupId: existingGroup.id },
    });
    return existingGroup.id;
  }

  const isAutoMerge = candidate.confidence >= THRESHOLDS.autoMergeThreshold;

  const group = await prisma.duplicateGroup.create({
    data: {
      confidence: candidate.confidence,
      matchReasons: candidate.matchReasons,
      status: isAutoMerge ? "AUTO_MERGED" : "PENDING",
      goldenRecordId: isAutoMerge ? candidate.existingContactId : null,
    },
  });

  // Link both contacts to the group
  await prisma.contact.updateMany({
    where: { id: { in: [candidate.existingContactId, candidate.newContactId] } },
    data: { duplicateGroupId: group.id },
  });

  // If auto-merge, mark the existing as golden record
  if (isAutoMerge) {
    await mergeContacts(group.id, candidate.existingContactId);
  }

  return group.id;
}

export async function mergeContacts(
  duplicateGroupId: string,
  winnerId: string,
  mergedById?: string
): Promise<void> {
  const group = await prisma.duplicateGroup.findUniqueOrThrow({
    where: { id: duplicateGroupId },
    include: { contacts: true },
  });

  const winner = group.contacts.find((c) => c.id === winnerId);
  if (!winner) throw new Error("Winner contact not in duplicate group");

  const losers = group.contacts.filter((c) => c.id !== winnerId);

  for (const loser of losers) {
    // Fill in missing fields on the winner from the loser
    const updates: Record<string, any> = {};
    const fieldsToMerge = [
      "email", "emailSecondary", "phone", "phoneSecondary", "phoneMobile",
      "title", "department", "addressLine1", "city", "state", "zipCode",
      "county", "fax",
    ] as const;

    for (const field of fieldsToMerge) {
      if (!winner[field] && loser[field]) {
        updates[field] = loser[field];
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.contact.update({
        where: { id: winnerId },
        data: updates,
      });
    }

    // Point loser to winner
    await prisma.contact.update({
      where: { id: loser.id },
      data: {
        goldenRecordId: winnerId,
        isGoldenRecord: false,
      },
    });

    // Move relationships (ContactProperty) from loser to winner
    const loserProperties = await prisma.contactProperty.findMany({
      where: { contactId: loser.id },
    });
    for (const cp of loserProperties) {
      const exists = await prisma.contactProperty.findUnique({
        where: {
          contactId_propertyId: { contactId: winnerId, propertyId: cp.propertyId },
        },
      });
      if (!exists) {
        await prisma.contactProperty.update({
          where: { id: cp.id },
          data: { contactId: winnerId },
        });
      }
    }
  }

  // Mark winner as golden record
  await prisma.contact.update({
    where: { id: winnerId },
    data: { isGoldenRecord: true },
  });

  // Mark group resolved
  await prisma.duplicateGroup.update({
    where: { id: duplicateGroupId },
    data: {
      status: mergedById ? "MANUALLY_MERGED" : "AUTO_MERGED",
      goldenRecordId: winnerId,
      mergedById,
      resolvedAt: new Date(),
    },
  });
}
