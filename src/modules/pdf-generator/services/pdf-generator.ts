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
  coverTitle: string;
  coverSubtitle: string;
  executiveSummary: string;
  contactBrief: {
    roleAnalysis: string;
    decisionAuthority: string;
    communicationStyle: string;
  };
  propertyAssessments: {
    name: string;
    type: string;
    location: string;
    units: string;
    yearBuilt: string;
    overallRisk: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
    riskSummary: string;
    risks: { category: string; severity: "High" | "Medium" | "Low"; detail: string }[];
    estimatedAnnualExposure: string;
  }[];
  serviceRecommendations: {
    service: string;
    relevance: string;
    priority: "Immediate" | "Near-Term" | "Preventive";
  }[];
  whyPaulDavis: string[];
  localExpertise: string;
  insuranceNote: string;
  callToAction: string;
  nextSteps: string[];
}

/**
 * Generates a comprehensive multi-page branded prospect PDF.
 * Uses Claude to create deeply personalized content.
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

  let enrichment: any = null;
  if (contact.enrichmentBrief) {
    try {
      enrichment = JSON.parse(contact.enrichmentBrief);
    } catch {}
  }

  const prompt = `You are creating a comprehensive, multi-page property assessment document for a Paul Davis Restoration sales rep. This is a leave-behind document for an in-person sales visit. It must be deeply specific, professional, and compelling.

## About Paul Davis Restoration
- Full-service restoration company (water, fire, mold, storm damage)
- Serves Palm Beach County and Treasure Coast (South Florida)
- 24/7 emergency response, average 30-minute arrival
- Works directly with all major insurance carriers
- Specializes in commercial and multi-family properties

## Prospect
- **Name:** ${contact.fullName}
- **Title:** ${contact.title || "Decision Maker"}
- **Organization:** ${contact.organization?.name || "Independent"}
- **Org Type:** ${contact.organization?.orgType?.replace("_", " ") || "Unknown"}
- **Territory:** ${contact.territory?.name || "South Florida"}

## Property
- **Name:** ${property.name}
- **Type:** ${property.propertyType?.replace("_", " ") || "Commercial Property"}
- **Address:** ${property.addressLine1 || ""}, ${property.city}, ${property.state} ${property.zipCode}
- **Units:** ${property.unitCount || "N/A"}
- **Year Built:** ${property.yearBuilt || "Unknown"}
- **Floors:** ${property.floors || "N/A"}
- **Flood Zone:** ${property.floodZone || "Unknown"}
- **Coastal Exposure:** ${property.coastalExposure ? "Yes" : "Unknown"}

${enrichment ? `## Enrichment Intel
- **Summary:** ${enrichment.summary || ""}
- **Role Context:** ${enrichment.role_context || ""}
- **Pain Triggers:** ${(enrichment.pain_triggers || []).join("; ")}
- **Risk Factors:** ${(enrichment.risk_factors || []).join("; ")}
- **Competitive Landscape:** ${enrichment.competitive_landscape || ""}
- **Company Intel:** ${JSON.stringify(enrichment.company_intel || {})}` : ""}

## Task
Generate a JSON document for a comprehensive multi-page property assessment PDF. Every section must be specific to THIS property and THIS prospect. Generic content is unacceptable.

Return ONLY valid JSON (no markdown, no code fences):

{
  "coverTitle": "Compelling title mentioning the property name (max 8 words)",
  "coverSubtitle": "One line about why this assessment matters to them specifically",
  "executiveSummary": "2-3 paragraph executive summary. Mention the specific property, its age, location risks, and why proactive restoration partnership matters for their portfolio. Reference South Florida conditions (hurricanes, humidity, salt air, flooding).",
  "contactBrief": {
    "roleAnalysis": "What their role means for restoration decisions — their authority level, what they care about",
    "decisionAuthority": "How decisions get made at their org — who else is involved",
    "communicationStyle": "Recommended approach based on their role and org type"
  },
  "propertyAssessments": [
    {
      "name": "Property name",
      "type": "Property type formatted nicely",
      "location": "City, State ZIP",
      "units": "Unit count or N/A",
      "yearBuilt": "Year",
      "overallRisk": "CRITICAL or HIGH or MODERATE or LOW",
      "riskSummary": "2-sentence overall risk assessment for this specific property",
      "risks": [
        {"category": "Water Damage", "severity": "High", "detail": "Specific risk detail for THIS building based on age, location, type"},
        {"category": "Hurricane/Storm", "severity": "High", "detail": "Specific to South Florida coastal exposure"},
        {"category": "Mold & Moisture", "severity": "Medium", "detail": "Based on building age and Florida humidity"},
        {"category": "Fire Risk", "severity": "Low", "detail": "Based on building construction and systems"}
      ],
      "estimatedAnnualExposure": "$XX,000 - $XX,000 estimated annual restoration exposure"
    }
  ],
  "serviceRecommendations": [
    {"service": "Service name", "relevance": "Why this specific service matters for this property", "priority": "Immediate or Near-Term or Preventive"},
    {"service": "...", "relevance": "...", "priority": "..."},
    {"service": "...", "relevance": "...", "priority": "..."},
    {"service": "...", "relevance": "...", "priority": "..."}
  ],
  "whyPaulDavis": [
    "5-6 bullet points, each specific to this prospect's situation and needs — NOT generic marketing"
  ],
  "localExpertise": "1-2 sentences about Paul Davis's specific expertise in their territory/area of South Florida",
  "insuranceNote": "1-2 sentences about how Paul Davis handles insurance coordination relevant to their property type",
  "callToAction": "Compelling, specific next step for this prospect",
  "nextSteps": ["Step 1 specific to their situation", "Step 2", "Step 3"]
}

Make every risk assessment REAL. Consider: building age deterioration, South Florida hurricane seasons, coastal salt air corrosion, humidity/mold pressure, flood zone exposure, pipe aging (especially pre-2000 buildings), roof lifecycle, HVAC moisture issues. Be specific to the year built and location.`;

  const response = await getAnthropicClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let jsonStr = textBlock.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  const content: PdfContent = JSON.parse(jsonStr.trim());

  const html = generateHtml(content, contact.fullName, contact.title || "Decision Maker", contact.organization?.name || "", property.name);

  const pdfDir = join(process.cwd(), "generated-pdfs");
  await mkdir(pdfDir, { recursive: true });
  const fileName = `${property.name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.html`;
  const filePath = join(pdfDir, fileName);
  await writeFile(filePath, html, "utf-8");

  const record = await prisma.generatedPdf.create({
    data: {
      propertyId: property.id,
      templateId: "prospect-assessment-v2",
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

function generateHtml(content: PdfContent, contactName: string, contactTitle: string, orgName: string, propertyName: string): string {
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const riskColor = (level: string) => {
    switch (level.toUpperCase()) {
      case "CRITICAL": return { bg: "#7f1d1d", text: "#fff" };
      case "HIGH": return { bg: "#dc2626", text: "#fff" };
      case "MODERATE": return { bg: "#d97706", text: "#fff" };
      case "LOW": return { bg: "#16a34a", text: "#fff" };
      default: return { bg: "#6b7280", text: "#fff" };
    }
  };

  const severityDot = (s: string) => {
    if (s === "High") return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;margin-right:6px;"></span>';
    if (s === "Medium") return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#d97706;margin-right:6px;"></span>';
    return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-right:6px;"></span>';
  };

  const priorityBadge = (p: string) => {
    const colors: Record<string, string> = { "Immediate": "#dc2626", "Near-Term": "#d97706", "Preventive": "#2563eb" };
    const c = colors[p] || "#6b7280";
    return `<span style="display:inline-block;background:${c};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px;">${esc(p)}</span>`;
  };

  const propertyCards = content.propertyAssessments.map((prop) => {
    const rc = riskColor(prop.overallRisk);
    const risksRows = prop.risks.map((r) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">
          ${severityDot(r.severity)}${esc(r.category)}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#4b5563;">${esc(r.detail)}</td>
      </tr>`).join("");

    return `
    <div style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background:#1a1a1a;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:700;">${esc(prop.name)}</div>
          <div style="font-size:12px;opacity:0.8;margin-top:2px;">${esc(prop.type)} &bull; ${esc(prop.location)}</div>
        </div>
        <div style="background:${rc.bg};color:${rc.text};padding:4px 12px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.5px;">${esc(prop.overallRisk)} RISK</div>
      </div>
      <div style="padding:16px 20px;">
        <div style="display:flex;gap:24px;margin-bottom:16px;">
          <div><span style="font-size:11px;color:#6b7280;text-transform:uppercase;">Units</span><br><strong style="font-size:14px;">${esc(prop.units)}</strong></div>
          <div><span style="font-size:11px;color:#6b7280;text-transform:uppercase;">Year Built</span><br><strong style="font-size:14px;">${esc(prop.yearBuilt)}</strong></div>
          <div><span style="font-size:11px;color:#6b7280;text-transform:uppercase;">Est. Annual Exposure</span><br><strong style="font-size:14px;color:#dc2626;">${esc(prop.estimatedAnnualExposure)}</strong></div>
        </div>
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:10px 14px;font-size:13px;color:#991b1b;margin-bottom:16px;border-radius:0 4px 4px 0;">
          ${esc(prop.riskSummary)}
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600;border-bottom:2px solid #e5e7eb;">Risk Category</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600;border-bottom:2px solid #e5e7eb;">Assessment</th>
            </tr>
          </thead>
          <tbody>${risksRows}</tbody>
        </table>
      </div>
    </div>`;
  }).join("");

  const servicesRows = content.serviceRecommendations.map((s) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;">${esc(s.service)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#4b5563;">${esc(s.relevance)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:center;">${priorityBadge(s.priority)}</td>
    </tr>`).join("");

  const advantagesHtml = content.whyPaulDavis
    .map((a) => `<li style="margin-bottom:8px;font-size:13px;color:#374151;padding-left:4px;">${esc(a)}</li>`)
    .join("");

  const stepsHtml = content.nextSteps
    .map((s, i) => `<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
      <div style="width:28px;height:28px;border-radius:50%;background:#ED1C24;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;shrink:0;">${i + 1}</div>
      <p style="font-size:13px;color:#374151;margin:0;padding-top:4px;">${esc(s)}</p>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paul Davis - Property Assessment - ${esc(propertyName)}</title>
  <style>
    @page { size: letter; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 8.5in;
      min-height: 11in;
      padding: 0.6in;
      page-break-after: always;
      position: relative;
    }
    .page:last-child { page-break-after: auto; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 2px solid #C4A265;
      margin-bottom: 24px;
    }
    .page-header-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pd-mark {
      width: 32px;
      height: 32px;
      background: #1a1a1a;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #C4A265;
      font-weight: 900;
      font-size: 14px;
    }
    .pd-name {
      font-size: 16px;
      font-weight: 800;
      color: #C4A265;
    }
    .pd-sub {
      font-size: 9px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .page-footer {
      position: absolute;
      bottom: 0.5in;
      left: 0.6in;
      right: 0.6in;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #1a1a1a;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #C4A265;
    }
    @media print {
      .page { padding: 0.5in; }
      .page-footer { bottom: 0.4in; left: 0.5in; right: 0.5in; }
    }
    @media screen {
      body { background: #f3f4f6; }
      .page {
        max-width: 8.5in;
        margin: 20px auto;
        background: white;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        border-radius: 4px;
      }
    }
  </style>
</head>
<body>

<!-- ==================== PAGE 1: COVER ==================== -->
<div class="page" style="display:flex;flex-direction:column;justify-content:space-between;">
  <div>
    <!-- Top bar -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:60px;">
      <div class="page-header-logo">
        <div class="pd-mark">PD</div>
        <div>
          <div class="pd-name">PAUL DAVIS</div>
          <div class="pd-sub">Restoration</div>
        </div>
      </div>
      <div style="text-align:right;font-size:11px;color:#6b7280;">
        <div style="font-weight:600;color:#1a1a1a;">CONFIDENTIAL</div>
        <div>Property Assessment</div>
        <div>${dateStr}</div>
      </div>
    </div>

    <!-- Title block -->
    <div style="margin-bottom:48px;">
      <div style="width:60px;height:4px;background:#C4A265;margin-bottom:24px;border-radius:2px;"></div>
      <h1 style="font-size:36px;font-weight:800;color:#1a1a1a;line-height:1.2;margin-bottom:12px;">${esc(content.coverTitle)}</h1>
      <p style="font-size:16px;color:#6b7280;max-width:500px;">${esc(content.coverSubtitle)}</p>
    </div>

    <!-- Prepared for block -->
    <div style="background:#f9fafb;border-radius:8px;padding:24px;max-width:400px;">
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">Prepared For</div>
      <div style="font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">${esc(contactName)}</div>
      <div style="font-size:14px;color:#4b5563;">${esc(contactTitle)}</div>
      ${orgName ? `<div style="font-size:14px;color:#6b7280;">${esc(orgName)}</div>` : ""}
    </div>
  </div>

  <!-- Bottom branding -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <div style="font-size:11px;color:#6b7280;">Paul Davis Restoration</div>
      <div style="font-size:11px;color:#6b7280;">Palm Beach County &bull; Treasure Coast</div>
      <div style="font-size:11px;color:#9ca3af;">24/7 Emergency: (561) 478-7272</div>
    </div>
    <div style="width:80px;height:3px;background:#C4A265;border-radius:2px;"></div>
  </div>
</div>

<!-- ==================== PAGE 2: EXECUTIVE SUMMARY + CONTACT INTEL ==================== -->
<div class="page">
  <div class="page-header">
    <div class="page-header-logo">
      <div class="pd-mark">PD</div>
      <div>
        <div class="pd-name" style="font-size:13px;">PAUL DAVIS</div>
        <div class="pd-sub" style="font-size:8px;">Restoration</div>
      </div>
    </div>
    <div style="font-size:10px;color:#9ca3af;">Property Assessment &bull; ${esc(propertyName)}</div>
  </div>

  <div class="section-title">Executive Summary</div>
  <div style="font-size:13px;color:#374151;margin-bottom:28px;white-space:pre-line;">${esc(content.executiveSummary)}</div>

  <div class="section-title">Contact Intelligence</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px;">
    <div style="background:#f9fafb;border-radius:6px;padding:14px;">
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Role Analysis</div>
      <p style="font-size:12px;color:#374151;">${esc(content.contactBrief.roleAnalysis)}</p>
    </div>
    <div style="background:#f9fafb;border-radius:6px;padding:14px;">
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Decision Authority</div>
      <p style="font-size:12px;color:#374151;">${esc(content.contactBrief.decisionAuthority)}</p>
    </div>
  </div>
  <div style="background:#faf8f3;border-left:4px solid #C4A265;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:28px;">
    <div style="font-size:10px;color:#C4A265;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;font-weight:600;">Recommended Communication Approach</div>
    <p style="font-size:12px;color:#374151;">${esc(content.contactBrief.communicationStyle)}</p>
  </div>

  <div class="section-title">Insurance &amp; Claims Coordination</div>
  <div style="background:#f0f9ff;border-radius:6px;padding:14px;font-size:12px;color:#1e40af;">
    ${esc(content.insuranceNote)}
  </div>

  <div class="page-footer">
    <div>Paul Davis Restoration &bull; Confidential Assessment</div>
    <div>Page 2</div>
  </div>
</div>

<!-- ==================== PAGE 3: PROPERTY RISK ASSESSMENT ==================== -->
<div class="page">
  <div class="page-header">
    <div class="page-header-logo">
      <div class="pd-mark">PD</div>
      <div>
        <div class="pd-name" style="font-size:13px;">PAUL DAVIS</div>
        <div class="pd-sub" style="font-size:8px;">Restoration</div>
      </div>
    </div>
    <div style="font-size:10px;color:#9ca3af;">Property Assessment &bull; ${esc(propertyName)}</div>
  </div>

  <div class="section-title">Property Risk Assessment</div>
  ${propertyCards}

  <div class="page-footer">
    <div>Paul Davis Restoration &bull; Confidential Assessment</div>
    <div>Page 3</div>
  </div>
</div>

<!-- ==================== PAGE 4: SERVICES + WHY PD + CTA ==================== -->
<div class="page">
  <div class="page-header">
    <div class="page-header-logo">
      <div class="pd-mark">PD</div>
      <div>
        <div class="pd-name" style="font-size:13px;">PAUL DAVIS</div>
        <div class="pd-sub" style="font-size:8px;">Restoration</div>
      </div>
    </div>
    <div style="font-size:10px;color:#9ca3af;">Property Assessment &bull; ${esc(propertyName)}</div>
  </div>

  <div class="section-title">Recommended Services</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:28px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
    <thead>
      <tr style="background:#1a1a1a;color:#fff;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Service</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Relevance</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Priority</th>
      </tr>
    </thead>
    <tbody>${servicesRows}</tbody>
  </table>

  <div class="section-title">Why Paul Davis for ${esc(propertyName)}</div>
  <ul style="padding-left:20px;margin-bottom:24px;list-style:none;">
    ${content.whyPaulDavis.map((a) => `<li style="margin-bottom:8px;font-size:13px;color:#374151;padding-left:4px;position:relative;">
      <span style="position:absolute;left:-18px;color:#C4A265;font-weight:700;">&#10003;</span>${esc(a)}
    </li>`).join("")}
  </ul>

  <div style="background:#f9fafb;border-radius:6px;padding:14px;margin-bottom:24px;">
    <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;font-weight:600;">Local Expertise</div>
    <p style="font-size:12px;color:#374151;">${esc(content.localExpertise)}</p>
  </div>

  <!-- CTA Block -->
  <div style="background:#ED1C24;color:#fff;padding:24px;border-radius:8px;text-align:center;margin-bottom:24px;">
    <div style="font-size:18px;font-weight:700;margin-bottom:8px;">${esc(content.callToAction)}</div>
    <div style="font-size:13px;opacity:0.9;">Paul Davis Restoration &bull; (561) 478-7272 &bull; Available 24/7</div>
  </div>

  <!-- Next Steps -->
  <div class="section-title">Recommended Next Steps</div>
  ${stepsHtml}

  <div class="page-footer">
    <div>Paul Davis Restoration &bull; Confidential Assessment &bull; (561) 478-7272</div>
    <div>Page 4</div>
  </div>
</div>

</body>
</html>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function listGeneratedPdfs(opts?: { propertyId?: string; contactId?: string }) {
  const where: any = {};
  if (opts?.propertyId) where.propertyId = opts.propertyId;
  if (opts?.contactId) {
    where.metadata = { path: ["contactId"], equals: opts.contactId };
  }
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
