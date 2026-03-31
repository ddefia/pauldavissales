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
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set. Check your .env file.");
    _anthropic = new Anthropic({ apiKey: key });
  }
  return _anthropic;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PdfContent {
  headline: string;
  subtitle: string;
  contactBrief: {
    roleInsight: string;
    decisionStyle: string;
    painPoints: string[];
  };
  propertyRisks: { risk: string; severity: "High" | "Medium" | "Low"; detail: string }[];
  estimatedExposure: string;
  services: { name: string; why: string; priority: "Immediate" | "Near-Term" | "Preventive" }[];
  whyUs: string[];
  callToAction: string;
  nextStep: string;
}

interface PdfImages {
  paulDavisLogo: string;
  companyLogo: string | null;
  streetView: string | null;
  satelliteMap: string | null;
}

function buildImageUrls(
  orgDomain: string | null | undefined,
  propertyAddress: string,
  lat: number | null,
  lng: number | null
): PdfImages {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  return {
    paulDavisLogo: "https://pauldavis.com/wp-content/uploads/2024/11/PD_Logo_300dpi_RGB.png",
    companyLogo: orgDomain
      ? `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${orgDomain}&size=128`
      : null,
    streetView: googleKey && propertyAddress
      ? `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${encodeURIComponent(propertyAddress)}&key=${googleKey}`
      : null,
    satelliteMap: googleKey && lat && lng
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=600x300&maptype=satellite&markers=color:red|${lat},${lng}&key=${googleKey}`
      : null,
  };
}

// ─── Generator ───────────────────────────────────────────────────────────────

export async function generateProspectPdf(
  contactId: string,
  propertyId: string
): Promise<{ id: string; filePath: string; html: string }> {
  const [contact, property] = await Promise.all([
    prisma.contact.findUniqueOrThrow({
      where: { id: contactId },
      include: {
        organization: { select: { name: true, orgType: true, domain: true, website: true } },
        territory: { select: { name: true } },
      },
    }),
    prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      include: { territory: { select: { name: true } } },
    }),
  ]);

  let enrichment: any = null;
  if (contact.enrichmentBrief) {
    try { enrichment = JSON.parse(contact.enrichmentBrief); } catch {}
  }

  const propertyAddress = [property.addressLine1, property.city, property.state, property.zipCode].filter(Boolean).join(", ");
  const images = buildImageUrls(
    contact.organization?.domain || contact.organization?.website?.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
    propertyAddress,
    property.latitude ? Number(property.latitude) : null,
    property.longitude ? Number(property.longitude) : null
  );

  const prompt = `You are writing a property assessment PDF for Paul Davis Restoration. This is handed IN a meeting that has already been booked — the prospect already agreed to sit down. This is NOT a pitch to earn a meeting; it's a professional leave-behind that shows you did your homework on their property before walking in. It should feel like a knowledgeable colleague prepared this specifically for them.

## Paul Davis Restoration
- Full-service property restoration: water, fire, mold, storm damage
- Palm Beach County & Treasure Coast, South Florida
- 24/7 emergency response, 30-min average arrival
- Works directly with all major insurance carriers
- Specializes in commercial & multi-family properties

## Prospect
- **Name:** ${contact.fullName}
- **Title:** ${contact.title || "Decision Maker"}
- **Company:** ${contact.organization?.name || "Independent"} (${contact.organization?.orgType?.replace("_", " ") || "Property Management"})
- **Territory:** ${contact.territory?.name || "South Florida"}

## Property
- **Name:** ${property.name}
- **Type:** ${property.propertyType?.replace("_", " ") || "Commercial"}
- **Address:** ${propertyAddress}
- **Units:** ${property.unitCount || "N/A"} | **Year Built:** ${property.yearBuilt || "Unknown"} | **Floors:** ${property.floors || "N/A"}
- **Flood Zone:** ${property.floodZone || "Unknown"} | **Coastal:** ${property.coastalExposure ? "Yes" : "Unknown"}

${enrichment ? `## Intel from Research
- **Summary:** ${enrichment.summary || ""}
- **Role Context:** ${enrichment.role_context || ""}
- **Pain Triggers:** ${(enrichment.pain_triggers || []).join("; ")}
- **Risk Factors:** ${(enrichment.risk_factors || []).join("; ")}
- **Competitive Landscape:** ${enrichment.competitive_landscape || ""}
- **Company Intel:** ${JSON.stringify(enrichment.company_intel || {})}` : ""}

## Task
Return ONLY valid JSON (no markdown, no fences):

{
  "headline": "A short, specific observation about this property or their situation — not a slogan. 8 words max. Read like a finding, not an ad.",
  "subtitle": "One grounded sentence framing the assessment — what Paul Davis looked at and why it matters for this property.",
  "contactBrief": {
    "roleInsight": "2-3 sentences: What their role (${contact.title || 'their position'}) actually means day-to-day for property resilience decisions. What they're accountable for. Written like you understand their job.",
    "decisionStyle": "1 sentence: How someone in their role typically manages restoration vendors — proactive contracts, reactive calls, board oversight, etc. Factual, not flattering.",
    "painPoints": ["3 specific operational realities for someone in their role managing this property type in South Florida. These are things they already know and feel — not news to them, just showing you understand."]
  },
  "propertyRisks": [
    {"risk": "Risk category", "severity": "High or Medium or Low", "detail": "2 sentences grounded in the actual building — year built, construction type, location, flood zone, coastal exposure. Factual, not alarming."},
    {"risk": "...", "severity": "...", "detail": "..."},
    {"risk": "...", "severity": "...", "detail": "..."},
    {"risk": "...", "severity": "...", "detail": "..."}
  ],
  "estimatedExposure": "Conservative annual range based on property size and type. Small condo: $5k-$15k. Mid-size: $10k-$40k. Large high-rise: $25k-$75k. Format: '$X,000–$X,000/yr'",
  "services": [
    {"name": "Service name", "why": "One sentence — grounded in something specific about this property or location", "priority": "Immediate or Near-Term or Preventive"},
    {"name": "...", "why": "...", "priority": "..."},
    {"name": "...", "why": "...", "priority": "..."},
    {"name": "...", "why": "...", "priority": "..."}
  ],
  "whyUs": ["4 short points — capabilities and track record relevant to this property type and location. No superlatives. No 'best in class'. Facts and specifics only."],
  "callToAction": "One sentence — a natural, confident statement of availability. Reads like something you'd say at the end of a good meeting. Not a close, not a pitch. Example: 'We're already familiar with properties like this across the county — reach us anytime.'",
  "nextStep": "One factual, useful sentence about South Florida property conditions, insurance trends, or seasonal timing that's genuinely relevant to this property. Something they'd nod at, not roll their eyes at."
}

Tone: This document is handed to someone in a meeting that they already agreed to. They're engaged. Write like a prepared, knowledgeable peer — not a vendor trying to close. Every line should make them think 'they actually know what they're talking about.' Specific, grounded, zero fluff.`;

  const response = await getAnthropicClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

  let jsonStr = textBlock.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];
  const content: PdfContent = JSON.parse(jsonStr.trim());

  const orgName = contact.organization?.name || "";
  const html = generateHtml(content, contact.fullName, contact.title || "Decision Maker", orgName, property.name, propertyAddress, property.unitCount, property.yearBuilt, property.floors, property.propertyType, images);

  const record = await prisma.generatedPdf.create({
    data: {
      propertyId: property.id,
      templateId: "prospect-two-pager-v1",
      filePath: "db-stored",
      metadata: {
        contactId: contact.id,
        contactName: contact.fullName,
        propertyName: property.name,
        generatedContent: content as any,
        htmlContent: html,
      } as any,
    },
  });

  return { id: record.id, filePath: record.filePath, html };
}

// ─── HTML Template — 2 Pages ─────────────────────────────────────────────────

function generateHtml(
  c: PdfContent,
  contactName: string,
  contactTitle: string,
  orgName: string,
  propertyName: string,
  propertyAddress: string,
  unitCount: number | null,
  yearBuilt: number | null,
  floors: number | null,
  propertyType: string | null,
  img: PdfImages
): string {
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const G = "#A1854A", R = "#ED1C24", D = "#222222";

  const sevColor = (s: string) => s === "High" ? R : s === "Medium" ? "#d97706" : "#16a34a";
  const priColor = (p: string) => p === "Immediate" ? R : p === "Near-Term" ? "#d97706" : "#2563eb";

  const companyLogoHtml = img.companyLogo
    ? `<img src="${img.companyLogo}" alt="" style="height:24px;width:24px;border-radius:4px;border:1px solid #e5e7eb;vertical-align:middle;margin-right:6px;" onerror="this.style.display='none'" />`
    : "";

  const pageHeader = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:2px solid ${G};margin-bottom:20px;">
      <img src="${img.paulDavisLogo}" alt="Paul Davis" style="height:32px;" />
      <div style="font-size:9px;color:#9ca3af;">Property Assessment &bull; ${e(propertyName)} &bull; ${dateStr}</div>
    </div>`;

  const pageFooter = (n: number) => `
    <div style="position:absolute;bottom:0.4in;left:0.5in;right:0.5in;display:flex;justify-content:space-between;font-size:8px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:6px;">
      <span>Paul Davis Restoration &bull; Palm Beach County &bull; Treasure Coast &bull; (561) 478-7272</span>
      <span>Page ${n} of 3 &bull; Confidential</span>
    </div>`;

  // Property stats row
  const stats = [
    unitCount ? `${unitCount} Units` : null,
    yearBuilt ? `Built ${yearBuilt}` : null,
    floors ? `${floors} Floors` : null,
    propertyType ? propertyType.replace(/_/g, " ") : null,
  ].filter(Boolean);

  const statsHtml = stats.map(s => `<span style="background:#f3f4f6;padding:2px 8px;border-radius:10px;font-size:10px;color:#4b5563;">${e(s!)}</span>`).join(" ");

  // Risks table
  const risksHtml = c.propertyRisks.map(r => `
    <tr>
      <td style="padding:6px 0;vertical-align:top;width:130px;">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${sevColor(r.severity)};margin-right:5px;vertical-align:middle;"></span>
        <span style="font-size:11px;font-weight:600;color:${D};">${e(r.risk)}</span>
      </td>
      <td style="padding:6px 0 6px 10px;font-size:10px;color:#4b5563;border-bottom:1px solid #f3f4f6;">${e(r.detail)}</td>
    </tr>`).join("");

  // Services
  const servicesHtml = c.services.map(s => `
    <tr>
      <td style="padding:5px 8px;font-size:10px;font-weight:600;color:${D};border-bottom:1px solid #f3f4f6;white-space:nowrap;">${e(s.name)}</td>
      <td style="padding:5px 8px;font-size:10px;color:#4b5563;border-bottom:1px solid #f3f4f6;">${e(s.why)}</td>
    </tr>`).join("");

  // Why us
  const whyUsHtml = c.whyUs.map(item => `
    <div style="display:flex;gap:6px;margin-bottom:6px;">
      <span style="color:${G};font-size:13px;font-weight:700;flex-shrink:0;">&#10003;</span>
      <span style="font-size:10px;color:#374151;line-height:1.5;">${e(item)}</span>
    </div>`).join("");

  // Pain points
  const painHtml = c.contactBrief.painPoints.map(p => `
    <li style="font-size:10px;color:#374151;margin-bottom:3px;padding-left:2px;">${e(p)}</li>`).join("");

  // ── Risk counts for chart ──
  const highCount   = c.propertyRisks.filter(r => r.severity === "High").length;
  const medCount    = c.propertyRisks.filter(r => r.severity === "Medium").length;
  const lowCount    = c.propertyRisks.filter(r => r.severity === "Low").length;
  const totalRisks  = c.propertyRisks.length || 1;

  // ── Service groups for timeline chart ──
  const immediate  = c.services.filter(s => s.priority === "Immediate");
  const nearTerm   = c.services.filter(s => s.priority === "Near-Term");
  const preventive = c.services.filter(s => s.priority === "Preventive");

  const svcBarHtml = (items: typeof c.services, color: string) =>
    items.map(s => `<div style="background:${color};color:#fff;font-size:9px;font-weight:600;padding:4px 10px;border-radius:4px;margin-bottom:3px;">${e(s.name)}</div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Paul Davis - ${e(propertyName)}</title>
  <style>
    @page { size: letter; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2937; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 8.5in; min-height: 11in; position: relative; page-break-after: always; overflow: hidden; }
    .page:last-child { page-break-after: auto; }
    @media screen { body { background: #d1d5db; } .page { max-width: 8.5in; margin: 20px auto; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.15); } }
    @media print { #print-btn { display: none !important; } }
  </style>
</head>
<body>

<div id="print-btn" style="position:fixed;bottom:28px;right:28px;z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
  <button onclick="window.print()" style="background:#222;color:#fff;border:none;padding:12px 22px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.25);display:flex;align-items:center;gap:8px;font-family:inherit;">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    Save as PDF
  </button>
  <div style="font-size:10px;color:#9ca3af;text-align:right;padding-right:2px;">Print → Save as PDF</div>
</div>

<!-- ═══════════════════ PAGE 1: COVER ═══════════════════ -->
<div class="page" style="display:flex;flex-direction:column;background:#fff;">

  <!-- Header -->
  <div style="background:${D};padding:26px 48px 22px;display:flex;justify-content:space-between;align-items:center;">
    <img src="${img.paulDavisLogo}" alt="Paul Davis" style="height:48px;" />
    <div style="text-align:right;">
      <div style="color:${G};font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">Property Assessment</div>
      <div style="color:#6b7280;font-size:10px;margin-top:3px;">Prepared for ${e(dateStr)}</div>
    </div>
  </div>

  <!-- Street view hero -->
  ${img.streetView ? `
  <div style="position:relative;height:340px;overflow:hidden;flex-shrink:0;">
    <img src="${img.streetView}" alt="${e(propertyName)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.background='linear-gradient(160deg,#2a2a2a,#1a1a1a)'" />
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0) 30%,rgba(0,0,0,0.72) 100%);"></div>
    <div style="position:absolute;bottom:28px;left:48px;right:48px;">
      <div style="color:${G};font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">Property</div>
      <div style="color:#fff;font-size:28px;font-weight:800;line-height:1.15;text-shadow:0 2px 10px rgba(0,0,0,0.6);">${e(propertyName)}</div>
      <div style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:5px;">${e(propertyAddress)}</div>
    </div>
  </div>` : `
  <div style="height:340px;flex-shrink:0;background:linear-gradient(160deg,#2d2d2d,#1a1a1a);display:flex;flex-direction:column;justify-content:flex-end;padding:28px 48px;">
    <div style="color:${G};font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">Property</div>
    <div style="color:#fff;font-size:28px;font-weight:800;line-height:1.15;">${e(propertyName)}</div>
    <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-top:5px;">${e(propertyAddress)}</div>
  </div>`}

  <!-- Gold bar -->
  <div style="height:3px;background:linear-gradient(to right,${G},#d4b47a,${G});flex-shrink:0;"></div>

  <!-- Lower section -->
  <div style="flex:1;padding:32px 48px;display:flex;flex-direction:column;justify-content:space-between;">

    <!-- Prepared For row -->
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
      ${img.companyLogo ? `<img src="${img.companyLogo}" alt="" style="height:36px;max-width:120px;object-fit:contain;" onerror="this.style.display='none'" />` : ""}
      <div>
        <div style="font-size:8px;color:${G};font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Prepared For</div>
        <div style="font-size:16px;font-weight:700;color:${D};line-height:1.2;">${e(contactName)}</div>
        <div style="font-size:11px;color:#4b5563;margin-top:2px;">${e(contactTitle)}${orgName ? ` &bull; ${e(orgName)}` : ""}</div>
      </div>
    </div>

    <!-- Central statement -->
    <div style="text-align:center;padding:28px 24px;">
      <div style="font-size:32px;font-weight:800;color:${D};line-height:1.2;margin-bottom:12px;">Property Risk<br/>Assessment</div>
      <div style="width:60px;height:3px;background:${G};margin:0 auto 16px;border-radius:2px;"></div>
      <div style="font-size:11px;color:#6b7280;line-height:1.7;max-width:460px;margin:0 auto;">${e(c.subtitle)}</div>
    </div>

    <!-- Property details bar -->
    <div style="display:flex;justify-content:center;gap:24px;padding:12px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:16px;">
      ${propertyType ? `<div style="text-align:center;"><div style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Type</div><div style="font-size:11px;font-weight:600;color:${D};text-transform:capitalize;">${e(propertyType.replace(/_/g, " "))}</div></div>` : ""}
      ${unitCount ? `<div style="text-align:center;"><div style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Units</div><div style="font-size:11px;font-weight:600;color:${D};">${e(String(unitCount))}</div></div>` : ""}
      ${floors ? `<div style="text-align:center;"><div style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Floors</div><div style="font-size:11px;font-weight:600;color:${D};">${e(String(floors))}</div></div>` : ""}
      ${yearBuilt ? `<div style="text-align:center;"><div style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Built</div><div style="font-size:11px;font-weight:600;color:${D};">${e(String(yearBuilt))}</div></div>` : ""}
    </div>

    <!-- Cover footer -->
    <div style="display:flex;justify-content:space-between;padding-top:4px;">
      <div style="font-size:9px;color:#9ca3af;">Paul Davis Restoration &bull; Palm Beach &bull; Treasure Coast &bull; (561) 478-7272</div>
      <div style="font-size:9px;color:#9ca3af;">Page 1 of 3</div>
    </div>
  </div>
</div>

<!-- ═══════════════════ PAGE 2: ASSESSMENT ═══════════════════ -->
<div class="page" style="padding:0.5in;">
  ${pageHeader}

  <!-- Headline + two-col layout -->
  <div style="display:flex;gap:20px;margin-bottom:18px;">
    <!-- Left: headline + context -->
    <div style="flex:1.5;">
      <div style="width:36px;height:3px;background:${G};margin-bottom:10px;border-radius:2px;"></div>
      <h2 style="font-size:20px;font-weight:800;color:${D};line-height:1.2;margin-bottom:8px;">${e(c.headline)}</h2>
      <div style="background:#faf8f3;border-radius:6px;padding:14px;border-left:3px solid ${G};">
        <div style="font-size:8px;color:${G};text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:8px;">What We Understand About Your Situation</div>
        <p style="font-size:10.5px;color:#374151;margin-bottom:5px;line-height:1.55;">${e(c.contactBrief.roleInsight)}</p>
        <p style="font-size:10px;color:#6b7280;font-style:italic;line-height:1.5;">${e(c.contactBrief.decisionStyle)}</p>
        <div style="margin-top:9px;">
          <div style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:4px;">Day-to-Day Considerations</div>
          <ul style="list-style:none;padding:0;">${painHtml}</ul>
        </div>
      </div>
    </div>
    <!-- Right: satellite map + property facts -->
    <div style="flex:1;display:flex;flex-direction:column;gap:10px;">
      ${img.satelliteMap ? `
      <div style="border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;flex-shrink:0;">
        <img src="${img.satelliteMap}" alt="Satellite view" style="width:100%;height:130px;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'" />
        <div style="padding:5px 8px;background:#f9fafb;font-size:8px;color:#9ca3af;text-align:center;">${e(propertyAddress)}</div>
      </div>` : ""}
      <!-- Risk Snapshot chart -->
      <div style="background:#f9fafb;border-radius:6px;padding:12px;border:1px solid #e5e7eb;">
        <div style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:10px;">Risk Snapshot</div>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          ${highCount > 0 ? `<div style="flex:1;background:${R}15;border:1px solid ${R}40;border-radius:6px;padding:8px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:${R};">${highCount}</div>
            <div style="font-size:8px;color:${R};font-weight:600;letter-spacing:0.5px;">HIGH</div>
          </div>` : ""}
          ${medCount > 0 ? `<div style="flex:1;background:#d9770615;border:1px solid #d9770640;border-radius:6px;padding:8px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#d97706;">${medCount}</div>
            <div style="font-size:8px;color:#d97706;font-weight:600;letter-spacing:0.5px;">MED</div>
          </div>` : ""}
          ${lowCount > 0 ? `<div style="flex:1;background:#16a34a15;border:1px solid #16a34a40;border-radius:6px;padding:8px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#16a34a;">${lowCount}</div>
            <div style="font-size:8px;color:#16a34a;font-weight:600;letter-spacing:0.5px;">LOW</div>
          </div>` : ""}
        </div>
        <!-- Stacked bar -->
        <div style="height:6px;border-radius:3px;overflow:hidden;display:flex;gap:1px;">
          ${highCount > 0 ? `<div style="flex:${highCount};background:${R};"></div>` : ""}
          ${medCount > 0 ? `<div style="flex:${medCount};background:#d97706;"></div>` : ""}
          ${lowCount > 0 ? `<div style="flex:${lowCount};background:#16a34a;"></div>` : ""}
        </div>
      </div>
    </div>
  </div>

  <!-- Risk table -->
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${D};margin-bottom:7px;padding-bottom:4px;border-bottom:1px solid ${R};">
    Risk Assessment — ${e(propertyName)}
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <tbody>${risksHtml}</tbody>
  </table>

  ${pageFooter(2)}
</div>

<!-- ═══════════════════ PAGE 3: SERVICES + CAPABILITIES + CLOSING ═══════════════════ -->
<div class="page" style="padding:0.5in;">
  ${pageHeader}

  <!-- Service Timeline chart -->
  <div style="margin-bottom:18px;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${D};margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid ${G};">
      Service Roadmap
    </div>
    <div style="display:flex;gap:0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${immediate.length > 0 ? `
      <div style="flex:1;background:#fff5f5;padding:12px 14px;border-right:1px solid #e5e7eb;">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${R};flex-shrink:0;"></div>
          <div style="font-size:8px;font-weight:700;color:${R};letter-spacing:1px;text-transform:uppercase;">Immediate</div>
        </div>
        ${svcBarHtml(immediate, R)}
      </div>` : ""}
      ${nearTerm.length > 0 ? `
      <div style="flex:1;background:#fffbeb;padding:12px 14px;border-right:1px solid #e5e7eb;">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#d97706;flex-shrink:0;"></div>
          <div style="font-size:8px;font-weight:700;color:#d97706;letter-spacing:1px;text-transform:uppercase;">Near-Term</div>
        </div>
        ${svcBarHtml(nearTerm, "#d97706")}
      </div>` : ""}
      ${preventive.length > 0 ? `
      <div style="flex:1;background:#eff6ff;padding:12px 14px;">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:#2563eb;flex-shrink:0;"></div>
          <div style="font-size:8px;font-weight:700;color:#2563eb;letter-spacing:1px;text-transform:uppercase;">Preventive</div>
        </div>
        ${svcBarHtml(preventive, "#2563eb")}
      </div>` : ""}
    </div>
  </div>

  <!-- Service detail table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
    <thead>
      <tr style="background:${D};color:#fff;">
        <th style="padding:5px 8px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;">Service</th>
        <th style="padding:5px 8px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.5px;">Why for This Property</th>
      </tr>
    </thead>
    <tbody>${servicesHtml}</tbody>
  </table>

  <!-- How Paul Davis supports -->
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${D};margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid ${G};">
    How Paul Davis Supports ${e(propertyName)}
  </div>
  <div style="margin-bottom:18px;">${whyUsHtml}</div>

  <!-- Closing contact block -->
  <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:${D};padding:12px 18px;display:flex;align-items:center;gap:10px;">
      <img src="${img.paulDavisLogo}" alt="Paul Davis" style="height:24px;opacity:0.92;" />
      <div style="width:1px;height:22px;background:rgba(255,255,255,0.15);"></div>
      <div style="color:#9ca3af;font-size:9px;">Palm Beach County &bull; Treasure Coast &bull; South Florida</div>
    </div>
    <div style="padding:14px 18px;background:#fafafa;">
      <p style="font-size:11.5px;color:#374151;line-height:1.6;margin-bottom:10px;">${e(c.callToAction)}</p>
      ${c.nextStep ? `<p style="font-size:10px;color:#6b7280;line-height:1.5;margin-bottom:10px;">${e(c.nextStep)}</p>` : ""}
      <div style="display:flex;gap:20px;padding-top:10px;border-top:1px solid #e5e7eb;">
        <div><div style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:1px;">Phone</div><div style="font-size:12px;font-weight:700;color:${D};">(561) 478-7272</div></div>
        <div><div style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:1px;">Availability</div><div style="font-size:12px;font-weight:700;color:${D};">24/7 &bull; 365</div></div>
        <div><div style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:1px;">Response</div><div style="font-size:12px;font-weight:700;color:${D};">~30 min avg</div></div>
        <div><div style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:1px;">Insurance</div><div style="font-size:12px;font-weight:700;color:${D};">All major carriers</div></div>
      </div>
    </div>
  </div>

  ${pageFooter(3)}
</div>

</body>
</html>`;
}

function e(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ─── List PDFs ───────────────────────────────────────────────────────────────

export async function listGeneratedPdfs(opts?: { propertyId?: string; contactId?: string }) {
  const where: any = {};
  if (opts?.propertyId) where.propertyId = opts.propertyId;
  if (opts?.contactId) {
    where.metadata = { path: ["contactId"], equals: opts.contactId };
  }
  return prisma.generatedPdf.findMany({
    where,
    include: { property: { select: { name: true, city: true, state: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
