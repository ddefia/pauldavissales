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
  company_intel: {
    estimated_size: string;
    service_area: string;
    specialization: string;
    decision_structure: string;
  };
  property_risk_assessment: {
    property_name: string;
    risk_level: "HIGH" | "MEDIUM" | "LOW";
    primary_risks: string[];
    estimated_annual_exposure: string;
  }[];
  pain_triggers: string[];
  personalization_hooks: string[];
  recommended_approach: string[];
  risk_factors: string[];
  competitive_landscape: string;
  best_time_to_call: string;
  warm_lead_score: number;
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

  return `You are an elite sales intelligence analyst for Paul Davis Restoration, a disaster restoration company (water, fire, mold, storm, biohazard) serving Palm Beach County through the Treasure Coast in South Florida.

Your job: build a DEEP research brief that makes a sales rep sound like they already know this person. Use everything you know about the company, the role, the properties, and the South Florida market.

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
- **Domain:** ${contact.organization?.domain || "Not available"}

## Properties Managed/Associated
${propList || "  No properties linked"}

## DEEP RESEARCH INSTRUCTIONS
Go beyond surface-level. Use your knowledge to infer and deduce:

**Company Intelligence:**
- What kind of company is this? How big? What's their service area?
- For property management companies: how many properties do they likely manage? What tier (luxury, mid-market, affordable)?
- For HOA/COA boards: what's the typical board structure? Who makes vendor decisions?
- What's their likely vendor selection process?
- Are they the type that uses one restoration vendor or shops around?

**Property Risk Analysis:**
- For each property, assess REAL risks based on: ZIP code (flood zone?), year built (aging infrastructure?), building type (high-rise = pipe risk, coastal = hurricane/salt damage), unit count (scale of potential damage)
- South Florida specific: hurricane season exposure, King Tide flooding, aging condo infrastructure (post-Surfside building safety laws), mold from humidity
- Estimate annual restoration exposure (e.g., "A 200-unit coastal high-rise built in 1985 likely faces $50K-$200K in annual water damage claims")

**Competitive Landscape:**
- Who likely services this account now? (ServiceMaster, Belfor, ServPro, local firms)
- What would make them switch?

**Timing Intelligence:**
- When is the best time to reach this person? (e.g., HOA board meetings are typically quarterly, budget season is Oct-Dec, hurricane prep is March-May)
- What's happening in their world RIGHT NOW that creates urgency?

Respond in this EXACT JSON format:
{
  "summary": "2-3 sentences: who they are, why Paul Davis should call them TODAY",
  "role_context": "Their decision-making authority, who they report to, what keeps them up at night",
  "portfolio_overview": "Assessment of their property portfolio — types, scale, overall risk profile",
  "company_intel": {
    "estimated_size": "Small/Medium/Large + employee count estimate if possible",
    "service_area": "Geographic coverage",
    "specialization": "What types of properties they focus on",
    "decision_structure": "Who makes vendor decisions and how (single decision-maker, committee, board vote, etc.)"
  },
  "property_risk_assessment": [
    {
      "property_name": "Name of property",
      "risk_level": "HIGH/MEDIUM/LOW",
      "primary_risks": ["specific risk 1", "specific risk 2"],
      "estimated_annual_exposure": "$X-$Y estimated annual restoration spend"
    }
  ],
  "pain_triggers": ["5-7 SPECIFIC issues — not generic. Reference their actual properties, location, building age, etc."],
  "personalization_hooks": ["3-5 things a rep can say to show deep knowledge — mention property names, local events, industry trends"],
  "recommended_approach": ["3-4 tactical steps: what to lead with, what to ask, what to offer"],
  "risk_factors": ["3-4 property-specific restoration risks with real data points"],
  "competitive_landscape": "Who likely has this account, what would make them switch, Paul Davis's angle",
  "best_time_to_call": "Best day/time and why (reference their role, industry patterns, seasonal timing)",
  "warm_lead_score": 75,
  "warm_lead_score_rationale": "Score 0-100 with detailed reasoning"
}

CRITICAL: Be specific to THIS person, THESE properties, THIS part of South Florida. Generic briefs are useless. Reference actual property names, cities, building characteristics, and local market dynamics.`;
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
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  }).catch((err) => {
    throw new Error(`Claude API error: ${err instanceof Error ? err.message : String(err)}`);
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Extract JSON from the response (handle markdown code blocks, truncated responses)
  let jsonStr = textBlock.text;
  // Try code block extraction first (greedy to handle truncated closing)
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    || jsonStr.match(/```(?:json)?\s*([\s\S]+)/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  // Strip any remaining backticks or whitespace
  jsonStr = jsonStr.replace(/^`+|`+$/g, "").trim();

  // Robust JSON repair for truncated responses
  function repairJson(str: string): string {
    // First try parsing as-is
    try { JSON.parse(str); return str; } catch {}

    // Remove any trailing partial key-value (e.g., cut mid-string)
    // Find the last complete value (ends with ", }, ], number, true, false, null)
    let s = str.trim();

    // If truncated mid-string, close the string
    // Count unescaped quotes
    let quoteCount = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '"' && (i === 0 || s[i - 1] !== '\\')) quoteCount++;
    }
    if (quoteCount % 2 !== 0) {
      // Odd quotes — truncated inside a string value
      s += '"';
    }

    // Remove trailing comma if present
    s = s.replace(/,\s*$/, '');

    // Close unclosed brackets/braces
    const stack: string[] = [];
    let inString = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"' && (i === 0 || s[i - 1] !== '\\')) {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }

    // Close everything that's open
    s += stack.reverse().join('');

    // Final cleanup: trailing commas before closing brackets
    s = s.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    return s;
  }

  jsonStr = repairJson(jsonStr);

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

  // Also enrich the organization with deeper company intel
  if (contact.organizationId) {
    await prisma.organization.update({
      where: { id: contact.organizationId },
      data: {
        enrichmentBrief: brief.portfolio_overview,
        companyIntel: {
          ...brief.company_intel,
          competitive_landscape: brief.competitive_landscape,
          role_context: brief.role_context,
          risk_factors: brief.risk_factors,
          enrichedAt: new Date().toISOString(),
        },
      },
    });
  }

  // Enrich properties with per-property risk assessments
  for (const cp of contact.properties) {
    const propAssessment = brief.property_risk_assessment?.find(
      (a) => a.property_name?.toLowerCase().includes(cp.property.name.toLowerCase().substring(0, 10))
    );
    await prisma.property.update({
      where: { id: cp.propertyId },
      data: {
        riskFactors: propAssessment?.primary_risks || brief.risk_factors,
        enrichmentBrief: propAssessment
          ? `Risk: ${propAssessment.risk_level} | Exposure: ${propAssessment.estimated_annual_exposure} | ${propAssessment.primary_risks.join("; ")}`
          : brief.portfolio_overview,
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
