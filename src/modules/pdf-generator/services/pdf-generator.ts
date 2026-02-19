import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
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
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set. Check your .env file.");
    _anthropic = new Anthropic({ apiKey: key });
  }
  return _anthropic;
}

export interface PdfContent {
  headline: string;
  subheadline: string;
  propertySnapshot: {
    name: string;
    type: string;
    location: string;
    units: string;
    yearBuilt: string;
    riskProfile: string;
  };
  topRisks: { risk: string; description: string }[];
  paulDavisAdvantages: string[];
  callToAction: string;
  repName: string;
  repPhone: string;
  repEmail: string;
}

/**
 * Generates a prospect-specific one-page PDF leave-behind.
 * Uses Claude to create personalized content, then generates
 * an HTML-based document that can be printed/saved as PDF.
 */
export async function generateProspectPdf(
  contactId: string,
  propertyId: string
): Promise<{ id: string; filePath: string; html: string }> {
  const [contact, property] = await Promise.all([
    prisma.contact.findUniqueOrThrow({
      where: { id: contactId },
      include: {
        organization: { select: { name: true, orgType: true } },
        territory: { select: { name: true } },
      },
    }),
    prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      include: {
        territory: { select: { name: true } },
      },
    }),
  ]);

  // Parse enrichment if available
  let enrichment: any = null;
  if (contact.enrichmentBrief) {
    try {
      enrichment = JSON.parse(contact.enrichmentBrief);
    } catch {}
  }

  const prompt = `You are creating a one-page leave-behind document for a Paul Davis Restoration sales rep visiting a prospect. This should be professional, specific, and compelling.

## Prospect
- **Name:** ${contact.fullName}
- **Title:** ${contact.title || "Decision Maker"}
- **Organization:** ${contact.organization?.name || "Independent"}
- **Territory:** ${contact.territory?.name || "South Florida"}

## Property
- **Name:** ${property.name}
- **Type:** ${property.propertyType?.replace("_", " ") || "Commercial Property"}
- **Location:** ${property.addressLine1}, ${property.city}, ${property.state} ${property.zipCode}
- **Units:** ${property.unitCount || "N/A"}
- **Year Built:** ${property.yearBuilt || "Unknown"}
- **Floors:** ${property.floors || "N/A"}
- **Flood Zone:** ${property.floodZone || "Unknown"}
- **Coastal Exposure:** ${property.coastalExposure ? "Yes" : "Unknown"}

${enrichment ? `## Research Intel
- **Summary:** ${enrichment.summary || ""}
- **Pain Triggers:** ${(enrichment.pain_triggers || []).join("; ")}
- **Risk Factors:** ${(enrichment.risk_factors || []).join("; ")}` : ""}

## Task
Generate a JSON document with content for a one-page leave-behind PDF. It should be specific to THIS property and THIS prospect. Generic content is worthless.

{
  "headline": "A compelling headline mentioning the property name (max 10 words)",
  "subheadline": "A line about why Paul Davis is reaching out, specific to their situation",
  "propertySnapshot": {
    "name": "Property name",
    "type": "Property type",
    "location": "City, State",
    "units": "Unit count or N/A",
    "yearBuilt": "Year or Unknown",
    "riskProfile": "1-2 sentence risk assessment specific to this property"
  },
  "topRisks": [
    {"risk": "Risk category name", "description": "Specific risk description for THIS property"},
    {"risk": "...", "description": "..."},
    {"risk": "...", "description": "..."}
  ],
  "paulDavisAdvantages": [
    "4-5 bullet points — each specific to this prospect's situation, not generic marketing copy"
  ],
  "callToAction": "A compelling next step, specific to this prospect"
}

Make the risk assessment real — consider building age, coastal proximity, hurricane exposure, flood zone, and South Florida climate. Be specific.`;

  const response = await getAnthropicClient().messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
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

  const content: PdfContent = {
    ...JSON.parse(jsonStr.trim()),
    repName: "Paul Davis Restoration",
    repPhone: "(561) 555-0100",
    repEmail: "info@pauldavis-pbctc.com",
  };

  // Generate HTML document
  const html = generateHtml(content, contact.fullName, property.name);

  // Save to disk
  const pdfDir = join(process.cwd(), "generated-pdfs");
  await mkdir(pdfDir, { recursive: true });
  const fileName = `${property.name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.html`;
  const filePath = join(pdfDir, fileName);
  await writeFile(filePath, html, "utf-8");

  // Save record to DB
  const record = await prisma.generatedPdf.create({
    data: {
      propertyId: property.id,
      templateId: "prospect-leave-behind-v1",
      filePath: `/generated-pdfs/${fileName}`,
      metadata: {
        contactId: contact.id,
        contactName: contact.fullName,
        propertyName: property.name,
        generatedContent: content as any,
      } as any,
    },
  });

  return { id: record.id, filePath: record.filePath, html };
}

function generateHtml(content: PdfContent, contactName: string, propertyName: string): string {
  const risksHtml = content.topRisks
    .map(
      (r) => `
      <div style="margin-bottom: 12px;">
        <div style="font-weight: 600; color: #dc2626; font-size: 14px;">&#9888; ${escapeHtml(r.risk)}</div>
        <div style="color: #374151; font-size: 13px; margin-top: 2px;">${escapeHtml(r.description)}</div>
      </div>`
    )
    .join("");

  const advantagesHtml = content.paulDavisAdvantages
    .map((a) => `<li style="margin-bottom: 6px; color: #374151; font-size: 13px;">${escapeHtml(a)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paul Davis - ${escapeHtml(propertyName)}</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; padding: 40px;
      color: #1f2937;
      max-width: 8.5in;
    }
    .header {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 3px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 20px;
    }
    .logo { font-size: 24px; font-weight: 800; color: #1d4ed8; }
    .logo-sub { font-size: 11px; color: #6b7280; letter-spacing: 1px; text-transform: uppercase; }
    .prepared-for { text-align: right; font-size: 12px; color: #6b7280; }
    .prepared-for strong { color: #1f2937; display: block; font-size: 14px; }
    .headline { font-size: 22px; font-weight: 700; color: #1f2937; margin-bottom: 4px; }
    .subheadline { font-size: 14px; color: #4b5563; margin-bottom: 20px; }
    .two-col { display: flex; gap: 24px; margin-bottom: 20px; }
    .col { flex: 1; }
    .section-title {
      font-size: 13px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1px; color: #1d4ed8; margin-bottom: 10px;
      border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;
    }
    .snapshot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
    .snapshot-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
    .snapshot-value { font-size: 13px; font-weight: 500; margin-bottom: 6px; }
    .risk-profile {
      background: #fef2f2; border-left: 3px solid #dc2626;
      padding: 8px 12px; font-size: 13px; color: #991b1b; margin-top: 10px;
    }
    .advantages-list { padding-left: 20px; margin: 0; }
    .cta {
      background: #1d4ed8; color: white; padding: 16px 24px;
      text-align: center; font-size: 15px; font-weight: 600;
      margin-top: 20px; border-radius: 6px;
    }
    .footer {
      display: flex; justify-content: space-between;
      margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb;
      font-size: 11px; color: #6b7280;
    }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">PAUL DAVIS</div>
      <div class="logo-sub">Restoration &bull; Palm Beach County &bull; Treasure Coast</div>
    </div>
    <div class="prepared-for">
      Prepared for<br>
      <strong>${escapeHtml(contactName)}</strong>
      ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
    </div>
  </div>

  <div class="headline">${escapeHtml(content.headline)}</div>
  <div class="subheadline">${escapeHtml(content.subheadline)}</div>

  <div class="two-col">
    <div class="col">
      <div class="section-title">Property Snapshot</div>
      <div class="snapshot-grid">
        <div><div class="snapshot-label">Property</div><div class="snapshot-value">${escapeHtml(content.propertySnapshot.name)}</div></div>
        <div><div class="snapshot-label">Type</div><div class="snapshot-value">${escapeHtml(content.propertySnapshot.type)}</div></div>
        <div><div class="snapshot-label">Location</div><div class="snapshot-value">${escapeHtml(content.propertySnapshot.location)}</div></div>
        <div><div class="snapshot-label">Units</div><div class="snapshot-value">${escapeHtml(content.propertySnapshot.units)}</div></div>
        <div><div class="snapshot-label">Year Built</div><div class="snapshot-value">${escapeHtml(content.propertySnapshot.yearBuilt)}</div></div>
      </div>
      <div class="risk-profile"><strong>Risk Profile:</strong> ${escapeHtml(content.propertySnapshot.riskProfile)}</div>
    </div>

    <div class="col">
      <div class="section-title">Key Risks for This Property</div>
      ${risksHtml}
    </div>
  </div>

  <div class="section-title">Why Paul Davis for ${escapeHtml(content.propertySnapshot.name)}</div>
  <ul class="advantages-list">
    ${advantagesHtml}
  </ul>

  <div class="cta">${escapeHtml(content.callToAction)}</div>

  <div class="footer">
    <div>${escapeHtml(content.repName)} &bull; ${escapeHtml(content.repPhone)} &bull; ${escapeHtml(content.repEmail)}</div>
    <div>24/7 Emergency Response &bull; Average 30-Minute Arrival</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function listGeneratedPdfs(propertyId?: string) {
  const where = propertyId ? { propertyId } : {};
  return prisma.generatedPdf.findMany({
    where,
    include: {
      property: {
        select: { name: true, city: true, state: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
