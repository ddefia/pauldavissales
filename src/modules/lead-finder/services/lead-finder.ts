import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { readFileSync } from "fs";
import { resolve } from "path";

let _anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    let key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      try {
        const envContent = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
        const match = envContent.match(/^ANTHROPIC_API_KEY=["']?([^"'\r\n]+)["']?/m);
        key = match?.[1]?.trim() || undefined;
      } catch {}
    }
    if (!key) {
      throw new Error("ANTHROPIC_API_KEY is not set. Check your .env file.");
    }
    _anthropic = new Anthropic({ apiKey: key });
  }
  return _anthropic;
}

export interface FoundLead {
  fullName: string;
  title: string;
  organizationName: string;
  orgType: string;
  email: string | null;
  phone: string | null;
  propertyName: string | null;
  propertyType: string | null;
  city: string;
  state: string;
  zipCode: string;
  reasoning: string;
}

export interface LeadFinderResult {
  leads: FoundLead[];
  searchCriteria: string;
  suggestions: string[];
}

/**
 * Uses Claude to discover and suggest new leads
 * based on criteria like property type, geography, or org type.
 */
export async function findLeads(criteria: {
  query: string;
  territory?: string;
  orgType?: string;
  propertyType?: string;
  limit?: number;
}): Promise<LeadFinderResult> {
  // Get existing contacts for dedup context
  const existingOrgs = await prisma.organization.findMany({
    select: { name: true },
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  const existingNames = existingOrgs.map((o) => o.name).join(", ");

  const prompt = `You are a lead generation specialist for Paul Davis Restoration, a disaster restoration company (water, fire, mold, storm) serving South Florida — specifically Palm Beach County, Martin County, St. Lucie County, and Indian River County.

## Search Request
${criteria.query}

${criteria.territory ? `**Territory Focus:** ${criteria.territory}` : ""}
${criteria.orgType ? `**Organization Type:** ${criteria.orgType}` : ""}
${criteria.propertyType ? `**Property Type:** ${criteria.propertyType}` : ""}

## Context
Our ideal prospects are:
- Property management companies managing multi-unit buildings
- HOA/COA boards for condos, townhomes, and communities
- Building owners/operators of high-rise and mid-rise buildings
- Facilities managers and maintenance directors
- Real estate developers with active South Florida projects
- Insurance agencies specializing in property claims

Key South Florida factors:
- Hurricane season (June-November) drives emergency planning
- Aging condo infrastructure (post-Surfside building safety act)
- Coastal buildings face salt air, flooding, and wind damage
- High humidity creates ongoing mold risk
- Many buildings 30+ years old need ongoing restoration work

## Already in our database (do NOT suggest these)
${existingNames || "No existing contacts yet"}

## Task
Suggest ${criteria.limit || 10} new, realistic prospect leads that would be valuable for Paul Davis Restoration. For each lead, provide what a rep would need to start outreach.

Return JSON:
{
  "leads": [
    {
      "fullName": "Full name (realistic for South Florida)",
      "title": "Job title",
      "organizationName": "Company/HOA/COA name",
      "orgType": "PROPERTY_MANAGEMENT | HOA | CONDO_ASSOCIATION | BUILDING_OWNER | DEVELOPER | INSURANCE",
      "email": "Realistic email format or null",
      "phone": "561/772/772 area code format or null",
      "propertyName": "Associated property name or null",
      "propertyType": "LUXURY_CONDO | HIGH_RISE | MID_RISE | LOW_RISE | TOWNHOME | HOA_COMMUNITY | COMMERCIAL | MIXED_USE",
      "city": "City in the territory",
      "state": "FL",
      "zipCode": "Real South Florida ZIP code",
      "reasoning": "Why this person/org is a good prospect"
    }
  ],
  "suggestions": [
    "2-3 strategic suggestions for finding more leads in this segment"
  ]
}

Be realistic. Use actual South Florida cities, ZIP codes, and naming patterns. These should feel like real prospects a sales rep could follow up on.`;

  const response = await getAnthropicClient().messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let jsonStr = textBlock.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const result = JSON.parse(jsonStr.trim());

  return {
    leads: result.leads || [],
    searchCriteria: criteria.query,
    suggestions: result.suggestions || [],
  };
}

/**
 * Imports a found lead into the database as a new contact
 */
export async function importFoundLead(lead: FoundLead): Promise<string> {
  // Parse name
  const nameParts = lead.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Unknown";
  const lastName = nameParts.slice(1).join(" ") || "Unknown";

  // Find or create organization
  let organizationId: string | null = null;
  if (lead.organizationName) {
    const normalized = lead.organizationName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    const existingOrg = await prisma.organization.findFirst({
      where: { nameNormalized: normalized },
    });

    if (existingOrg) {
      organizationId = existingOrg.id;
    } else {
      const orgTypeMap: Record<string, any> = {
        PROPERTY_MANAGEMENT: "PROPERTY_MANAGEMENT",
        HOA: "HOA",
        CONDO_ASSOCIATION: "CONDO_ASSOCIATION",
        BUILDING_OWNER: "BUILDING_OWNER",
        DEVELOPER: "DEVELOPER",
        INSURANCE: "INSURANCE",
      };

      const newOrg = await prisma.organization.create({
        data: {
          name: lead.organizationName,
          nameNormalized: normalized,
          orgType: orgTypeMap[lead.orgType] ?? "OTHER",
          source: "LEAD_FINDER",
        },
      });
      organizationId = newOrg.id;
    }
  }

  // Find territory by ZIP
  let territoryId: string | null = null;
  if (lead.zipCode) {
    const territory = await prisma.territory.findFirst({
      where: { zipCodes: { has: lead.zipCode } },
    });
    if (territory) {
      territoryId = territory.id;
    }
  }

  // Create contact
  const contact = await prisma.contact.create({
    data: {
      firstName,
      lastName,
      fullName: lead.fullName,
      title: lead.title,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      state: lead.state,
      zipCode: lead.zipCode,
      organizationId,
      territoryId,
      source: "LEAD_FINDER",
      status: "RAW",
      isGoldenRecord: true,
      dataQualityScore: 30, // Lower score since AI-generated
    },
  });

  // Create property if provided
  if (lead.propertyName) {
    const propertyTypeMap: Record<string, any> = {
      LUXURY_CONDO: "LUXURY_CONDO",
      HIGH_RISE: "HIGH_RISE",
      MID_RISE: "MID_RISE",
      LOW_RISE: "LOW_RISE",
      TOWNHOME: "TOWNHOME",
      HOA_COMMUNITY: "HOA_COMMUNITY",
      COMMERCIAL: "COMMERCIAL",
      MIXED_USE: "MIXED_USE",
    };

    const property = await prisma.property.create({
      data: {
        name: lead.propertyName,
        nameNormalized: lead.propertyName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim(),
        propertyType: propertyTypeMap[lead.propertyType ?? ""] ?? "OTHER",
        addressLine1: "TBD",
        city: lead.city,
        state: lead.state,
        zipCode: lead.zipCode,
        territoryId,
      },
    });

    // Link contact to property
    await prisma.contactProperty.create({
      data: {
        contactId: contact.id,
        propertyId: property.id,
        role: lead.title,
        isPrimary: true,
      },
    });
  }

  return contact.id;
}
