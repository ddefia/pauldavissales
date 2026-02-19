import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { readFileSync } from "fs";
import { resolve } from "path";

// Lazy-initialize so the API key is read at call time, not module load time
let _anthropic: Anthropic | null = null;

function loadApiKeyFromEnvFile(): string | null {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const envContent = readFileSync(envPath, "utf-8");
    const match = envContent.match(/^ANTHROPIC_API_KEY=["']?([^"'\r\n]+)["']?/m);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    // process.env may have empty string from shell; fallback to .env file
    let key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      key = loadApiKeyFromEnvFile() ?? undefined;
      if (key) {
        console.log("[Enrichment] Loaded API key from .env file (shell env was empty)");
      }
    }
    if (!key) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Check your .env file and shell environment."
      );
    }
    console.log(`[Enrichment] Anthropic client initialized (key: ${key.substring(0, 15)}...)`);
    _anthropic = new Anthropic({ apiKey: key });
  }
  return _anthropic;
}

export interface EnrichmentBrief {
  summary: string;
  role_context: string;
  portfolio_overview: string;
  pain_triggers: string[];
  personalization_hooks: string[];
  recommended_approach: string[];
  risk_factors: string[];
  warm_lead_score_rationale: string;
}

interface ContactForEnrichment {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  county: string | null;
  organization: {
    name: string;
    orgType: string | null;
    website: string | null;
    domain: string | null;
  } | null;
  properties: {
    property: {
      name: string;
      propertyType: string | null;
      city: string;
      state: string;
      zipCode: string;
      unitCount: number | null;
      yearBuilt: number | null;
      floors: number | null;
    };
    role: string | null;
  }[];
  territory: { name: string } | null;
}

function buildPrompt(contact: ContactForEnrichment): string {
  const propList = contact.properties
    .map((cp) => {
      const p = cp.property;
      const details = [
        p.propertyType?.replace("_", " "),
        p.unitCount ? `${p.unitCount} units` : null,
        p.yearBuilt ? `built ${p.yearBuilt}` : null,
        p.floors ? `${p.floors} floors` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `  - ${p.name} (${p.city}, ${p.state} ${p.zipCode}) — ${details || "details unknown"}${cp.role ? ` [Role: ${cp.role}]` : ""}`;
    })
    .join("\n");

  return `You are a sales intelligence researcher for Paul Davis Restoration, a disaster restoration company (water, fire, mold, storm damage) serving Palm Beach County through the Treasure Coast in South Florida.

Research and create a warm lead brief for the following contact. Your goal is to give a sales rep everything they need to make a warm, informed first call.

## Contact Information
- **Name:** ${contact.fullName}
- **Title:** ${contact.title || "Unknown"}
- **Email:** ${contact.email || "Not available"}
- **Phone:** ${contact.phone || "Not available"}
- **Location:** ${[contact.addressLine1, contact.city, contact.state, contact.zipCode].filter(Boolean).join(", ") || "Unknown"}
- **County:** ${contact.county || "Unknown"}
- **Territory:** ${contact.territory?.name || "Unassigned"}

## Organization
- **Name:** ${contact.organization?.name || "Unknown"}
- **Type:** ${contact.organization?.orgType?.replace("_", " ") || "Unknown"}
- **Website:** ${contact.organization?.website || "Not available"}

## Properties Managed/Associated
${propList || "  No properties linked"}

## Your Task
Based on this information and your knowledge of South Florida property management, commercial real estate, HOAs/COAs, and restoration services, produce a structured brief with:

1. **Summary** (2-3 sentences): Who this person is and why they're relevant to Paul Davis
2. **Role Context**: What their role likely involves and their decision-making authority for restoration/maintenance services
3. **Portfolio Overview**: Assessment of the properties they manage/own — size, type, risk profile for restoration needs
4. **Pain Triggers** (3-5 bullet points): Specific issues this person likely faces that Paul Davis solves. Consider:
   - South Florida hurricane season (June-November)
   - Aging building infrastructure
   - Water intrusion/pipe bursts in high-rises
   - Mold risk from humidity
   - Insurance compliance requirements
   - Board/owner pressure for emergency preparedness
   - HOA/COA budget cycle timing
5. **Personalization Hooks** (2-4 bullet points): Specific things a rep could mention to show they've done their homework
6. **Recommended Approach** (2-3 bullet points): How a rep should approach this contact — what to lead with, what angle to take
7. **Risk Factors** (2-3 bullet points): Property-specific restoration risks (flood zone, coastal exposure, building age, etc.)
8. **Warm Lead Score Rationale**: One paragraph explaining how warm this lead is and why

Respond in JSON format matching this exact structure:
{
  "summary": "...",
  "role_context": "...",
  "portfolio_overview": "...",
  "pain_triggers": ["...", "..."],
  "personalization_hooks": ["...", "..."],
  "recommended_approach": ["...", "..."],
  "risk_factors": ["...", "..."],
  "warm_lead_score_rationale": "..."
}

Be specific to South Florida and the restoration industry. Reference actual risks, seasonal patterns, and industry dynamics. Do NOT be generic.`;
}

export async function enrichContact(contactId: string): Promise<EnrichmentBrief> {
  console.log(`[Enrichment] Starting enrichment for contact ${contactId}`);

  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: {
      organization: {
        select: { name: true, orgType: true, website: true, domain: true },
      },
      properties: {
        include: {
          property: {
            select: {
              name: true,
              propertyType: true,
              city: true,
              state: true,
              zipCode: true,
              unitCount: true,
              yearBuilt: true,
              floors: true,
            },
          },
        },
      },
      territory: { select: { name: true } },
    },
  });

  const prompt = buildPrompt(contact);

  const response = await getAnthropicClient().messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  }).catch((err) => {
    throw new Error(`Claude API error: ${err instanceof Error ? err.message : String(err)}`);
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Extract JSON from the response (handle potential markdown code blocks)
  let jsonStr = textBlock.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  let brief: EnrichmentBrief;
  try {
    brief = JSON.parse(jsonStr.trim());
  } catch {
    throw new Error(`Failed to parse enrichment response as JSON: ${jsonStr.substring(0, 200)}`);
  }

  // Save to database
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      enrichmentBrief: JSON.stringify(brief),
      painTriggers: brief.pain_triggers,
      personalizationHooks: brief.personalization_hooks,
      lastEnrichedAt: new Date(),
      status: "ENRICHED",
    },
  });

  // Also enrich the organization if it has one
  if (contact.organizationId) {
    await prisma.organization.update({
      where: { id: contact.organizationId },
      data: {
        enrichmentBrief: brief.portfolio_overview,
        companyIntel: {
          role_context: brief.role_context,
          risk_factors: brief.risk_factors,
          enrichedAt: new Date().toISOString(),
        },
      },
    });
  }

  // Enrich properties with risk factors
  for (const cp of contact.properties) {
    await prisma.property.update({
      where: { id: cp.propertyId },
      data: {
        riskFactors: brief.risk_factors,
        enrichmentBrief: brief.portfolio_overview,
      },
    });
  }

  return brief;
}

export async function enrichBatch(
  contactIds: string[],
  onProgress?: (status: { success: number; failed: number; total: number }) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < contactIds.length; i++) {
    try {
      await enrichContact(contactIds[i]);
      success++;
      console.log(`[Enrichment] ✓ ${i + 1}/${contactIds.length} enriched`);
    } catch (err) {
      failed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`${contactIds[i]}: ${errMsg}`);
      console.error(`[Enrichment] ✗ ${i + 1}/${contactIds.length} FAILED:`, errMsg);

      // If the first error is an API key/auth issue, stop the batch early
      if (failed === 1 && errMsg.includes("authentication")) {
        console.error("[Enrichment] Auth error detected — stopping batch early");
        break;
      }
    }
    onProgress?.({ success, failed, total: contactIds.length });

    // Rate limiting: 1 second between calls to avoid API throttling
    if (i < contactIds.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return { success, failed, errors };
}
