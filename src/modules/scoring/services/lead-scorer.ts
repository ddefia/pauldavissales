import prisma from "@/lib/prisma";

interface ScoringInput {
  id: string;
  // Fit signals
  title: string | null;
  organizationOrgType: string | null;
  propertyCount: number;
  totalUnits: number;
  hasHighRise: boolean;
  hasLuxury: boolean;
  isCoastal: boolean;
  // Trigger signals
  isEnriched: boolean;
  painTriggerCount: number;
  // Reachability signals
  hasEmail: boolean;
  hasPhone: boolean;
  hasMobile: boolean;
  emailValid: boolean;
  phoneValid: boolean;
  dataQualityScore: number;
  // Relationship signals
  hasOrganization: boolean;
  hasProperties: boolean;
  inTerritory: boolean;
}

const TITLE_SCORES: Record<string, number> = {
  // High decision-maker titles
  "property manager": 95,
  "community association manager": 95,
  cam: 95,
  "general manager": 90,
  "facilities manager": 90,
  "building manager": 85,
  "chief engineer": 85,
  director: 80,
  "vice president": 80,
  vp: 80,
  president: 85,
  owner: 85,
  "board member": 70,
  "board president": 80,
  treasurer: 65,
  secretary: 55,
  "maintenance supervisor": 70,
  superintendent: 70,
  "regional manager": 90,
  "asset manager": 85,
  "portfolio manager": 85,
};

function scoreFit(input: ScoringInput): number {
  let score = 0;

  // Title relevance (0-35 points)
  if (input.title) {
    const titleLower = input.title.toLowerCase();
    let bestTitleScore = 0;
    for (const [key, val] of Object.entries(TITLE_SCORES)) {
      if (titleLower.includes(key)) {
        bestTitleScore = Math.max(bestTitleScore, val);
      }
    }
    score += (bestTitleScore / 100) * 35;
  }

  // Organization type (0-20 points)
  const orgTypeScores: Record<string, number> = {
    PROPERTY_MANAGEMENT: 20,
    CONDO_ASSOCIATION: 18,
    HOA: 16,
    BUILDING_OWNER: 15,
    DEVELOPER: 12,
    INSURANCE: 8,
    OTHER: 5,
  };
  if (input.organizationOrgType) {
    score += orgTypeScores[input.organizationOrgType] ?? 5;
  }

  // Portfolio size (0-25 points)
  score += Math.min(input.propertyCount * 5, 15); // Up to 15 for multiple properties
  score += Math.min(input.totalUnits / 20, 10); // Up to 10 for unit count

  // Property type bonus (0-20 points)
  if (input.hasHighRise) score += 10;
  if (input.hasLuxury) score += 10;
  if (input.isCoastal) score += 5;

  return Math.min(Math.round(score), 100);
}

function scoreTrigger(input: ScoringInput): number {
  let score = 0;

  // Enrichment provides trigger signals
  if (input.isEnriched) {
    score += 20;
    score += Math.min(input.painTriggerCount * 12, 60);
  }

  // South Florida hurricane season proximity bonus
  const month = new Date().getMonth(); // 0-indexed
  if (month >= 4 && month <= 10) {
    // May through November — peak storm/hurricane season
    score += 20;
  }

  return Math.min(Math.round(score), 100);
}

function scoreReachability(input: ScoringInput): number {
  let score = 0;

  if (input.hasEmail) score += 25;
  if (input.emailValid) score += 15;
  if (input.hasPhone) score += 20;
  if (input.phoneValid) score += 10;
  if (input.hasMobile) score += 15;

  // Data quality bonus
  score += (input.dataQualityScore / 100) * 15;

  return Math.min(Math.round(score), 100);
}

function scoreRelationship(input: ScoringInput): number {
  let score = 0;

  if (input.hasOrganization) score += 30;
  if (input.hasProperties) score += 30;
  if (input.inTerritory) score += 40;

  return Math.min(Math.round(score), 100);
}

function computeComposite(
  fit: number,
  trigger: number,
  reachability: number,
  relationship: number
): number {
  // Weighted composite
  return Math.round(
    fit * 0.30 +
    trigger * 0.25 +
    reachability * 0.25 +
    relationship * 0.20
  );
}

function determineNextAction(
  fit: number,
  trigger: number,
  reachability: number,
  hasMobile: boolean,
  hasEmail: boolean
): string {
  const composite = computeComposite(fit, trigger, reachability, 50);

  if (composite >= 75) {
    if (hasMobile) return "call_mobile";
    if (hasEmail) return "email_then_call";
    return "call_office";
  } else if (composite >= 50) {
    if (hasEmail) return "email_sequence";
    return "call_office";
  } else if (composite >= 30) {
    if (hasEmail) return "nurture_email";
    return "drop_by";
  }
  return "low_priority_nurture";
}

export async function scoreContact(contactId: string): Promise<{
  fitScore: number;
  triggerScore: number;
  reachabilityScore: number;
  compositeScore: number;
  nextAction: string;
}> {
  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: {
      organization: { select: { orgType: true } },
      properties: {
        include: {
          property: {
            select: {
              propertyType: true,
              unitCount: true,
              coastalExposure: true,
            },
          },
        },
      },
      validationResults: {
        select: { type: true, field: true, status: true },
      },
    },
  });

  const properties = contact.properties.map((cp) => cp.property);
  const totalUnits = properties.reduce((sum, p) => sum + (p.unitCount ?? 0), 0);
  const hasHighRise = properties.some(
    (p) => p.propertyType === "HIGH_RISE" || p.propertyType === "MID_RISE"
  );
  const hasLuxury = properties.some((p) => p.propertyType === "LUXURY_CONDO");
  const isCoastal = properties.some((p) => p.coastalExposure === true);

  const emailValidation = contact.validationResults.find(
    (v) => v.field === "email" && v.type === "EMAIL_MX"
  );
  const phoneValidation = contact.validationResults.find(
    (v) => v.field === "phone" && v.type === "PHONE_FORMAT"
  );

  const input: ScoringInput = {
    id: contact.id,
    title: contact.title,
    organizationOrgType: contact.organization?.orgType ?? null,
    propertyCount: properties.length,
    totalUnits,
    hasHighRise,
    hasLuxury,
    isCoastal,
    isEnriched: contact.status === "ENRICHED" || !!contact.enrichmentBrief,
    painTriggerCount: contact.painTriggers?.length ?? 0,
    hasEmail: !!contact.email,
    hasPhone: !!contact.phone,
    hasMobile: !!contact.phoneMobile,
    emailValid: emailValidation?.status === "VALID",
    phoneValid: phoneValidation?.status === "VALID",
    dataQualityScore: contact.dataQualityScore ?? 0,
    hasOrganization: !!contact.organizationId,
    hasProperties: properties.length > 0,
    inTerritory: !!contact.territoryId,
  };

  const fitScore = scoreFit(input);
  const triggerScore = scoreTrigger(input);
  const reachabilityScore = scoreReachability(input);
  const relationshipScore = scoreRelationship(input);
  const compositeScore = computeComposite(
    fitScore,
    triggerScore,
    reachabilityScore,
    relationshipScore
  );
  const nextAction = determineNextAction(
    fitScore,
    triggerScore,
    reachabilityScore,
    !!contact.phoneMobile,
    !!contact.email
  );

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      fitScore,
      triggerScore,
      reachabilityScore,
      compositeScore,
      lastScoredAt: new Date(),
      status: contact.status === "ENRICHED" ? "SCORED" : contact.status,
    },
  });

  return { fitScore, triggerScore, reachabilityScore, compositeScore, nextAction };
}

export async function scoreAll(): Promise<{ scored: number }> {
  const contacts = await prisma.contact.findMany({
    where: { isGoldenRecord: true },
    select: { id: true },
  });

  let scored = 0;
  for (const c of contacts) {
    try {
      await scoreContact(c.id);
      scored++;
    } catch {
      // skip failures
    }
  }
  return { scored };
}
