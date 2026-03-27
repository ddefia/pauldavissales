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

  const prompt = `You are writing a 2-page property assessment PDF for Paul Davis Restoration — a sales leave-behind for an in-person meeting. It must be DEEPLY personalized to this specific prospect and property.

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
  "headline": "Compelling headline max 10 words — mention their property or company.",
  "subtitle": "One sentence about what Paul Davis can do for THIS property specifically.",
  "contactBrief": {
    "roleInsight": "2-3 sentences: What their specific role (${contact.title || 'their position'}) means for restoration decisions. What they care about most — budgets? tenant satisfaction? compliance? What keeps them up at night?",
    "decisionStyle": "1-2 sentences: How they likely make vendor decisions. Do they need board approval? Are they the sole decision maker? What will convince them?",
    "painPoints": ["3 specific pain points relevant to their role and property type. NOT generic — reference their building type, location, org type."]
  },
  "propertyRisks": [
    {"risk": "Risk category", "severity": "High or Medium or Low", "detail": "2 sentences specific to THIS building — reference year built, location, type, flood zone, coastal exposure."},
    {"risk": "...", "severity": "...", "detail": "..."},
    {"risk": "...", "severity": "...", "detail": "..."},
    {"risk": "...", "severity": "...", "detail": "..."}
  ],
  "estimatedExposure": "Conservative, BELIEVABLE annual estimate. Small condo: $5k-$15k. Mid-size: $10k-$40k. Large high-rise: $25k-$75k. Format: '$X,000 - $X,000/yr'",
  "services": [
    {"name": "Service name", "why": "One sentence — why THIS property needs this service", "priority": "Immediate or Near-Term or Preventive"},
    {"name": "...", "why": "...", "priority": "..."},
    {"name": "...", "why": "...", "priority": "..."},
    {"name": "...", "why": "...", "priority": "..."}
  ],
  "whyUs": ["4 bullet points (1-2 sentences each). Why Paul Davis specifically for THIS prospect. Reference their role, property type, location. NOT generic marketing."],
  "callToAction": "Specific, actionable next step. A meeting, walkthrough, or assessment request that's easy to say yes to.",
  "nextStep": "One sentence adding urgency or value. Reference hurricane season, building age, or recent weather events."
}

Be SPECIFIC. Reference South Florida conditions, their building's age, their role's responsibilities. Every word must be tailored to THIS prospect.`;

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
      <td style="padding:5px 8px;font-size:10px;font-weight:600;color:${D};border-bottom:1px solid #f3f4f6;">${e(s.name)}</td>
      <td style="padding:5px 8px;font-size:10px;color:#4b5563;border-bottom:1px solid #f3f4f6;">${e(s.why)}</td>
      <td style="padding:5px 8px;text-align:center;border-bottom:1px solid #f3f4f6;">
        <span style="background:${priColor(s.priority)};color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px;">${e(s.priority)}</span>
      </td>
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
  </style>
</head>
<body>

<!-- ═══════════════════ PAGE 1: FULL COVER ═══════════════════ -->
<div class="page" style="display:flex;flex-direction:column;background:#fff;">

  <!-- Top dark band: PD logo + label -->
  <div style="background:${D};padding:28px 48px 24px;display:flex;justify-content:space-between;align-items:flex-start;">
    <img src="${img.paulDavisLogo}" alt="Paul Davis" style="height:52px;" />
    <div style="text-align:right;">
      <div style="color:${G};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Confidential Property Assessment</div>
      <div style="color:#6b7280;font-size:10px;margin-top:3px;">${dateStr}</div>
    </div>
  </div>

  <!-- Hero image (street view) or dark gradient fallback -->
  ${img.streetView ? `
  <div style="position:relative;height:310px;overflow:hidden;">
    <img src="${img.streetView}" alt="${e(propertyName)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='';this.parentElement.style.background='linear-gradient(160deg,#2a2a2a 0%,#1a1a1a 100%)'" />
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.65) 100%);"></div>
    <div style="position:absolute;bottom:24px;left:48px;right:48px;">
      <div style="color:${G};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Property</div>
      <div style="color:#fff;font-size:26px;font-weight:800;line-height:1.15;text-shadow:0 2px 8px rgba(0,0,0,0.5);">${e(propertyName)}</div>
      <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:4px;">${e(propertyAddress)}</div>
    </div>
  </div>` : `
  <div style="height:310px;background:linear-gradient(160deg,#2d2d2d 0%,#1a1a1a 100%);display:flex;flex-direction:column;justify-content:flex-end;padding:24px 48px;">
    <div style="color:${G};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Property</div>
    <div style="color:#fff;font-size:26px;font-weight:800;line-height:1.15;">${e(propertyName)}</div>
    <div style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:4px;">${e(propertyAddress)}</div>
  </div>`}

  <!-- Gold divider -->
  <div style="height:4px;background:linear-gradient(to right, ${G}, #c4a265, ${G});"></div>

  <!-- Lower content area -->
  <div style="flex:1;padding:36px 48px;display:flex;flex-direction:column;justify-content:space-between;">

    <!-- Prepared For + Property side by side -->
    <div style="display:flex;gap:24px;margin-bottom:28px;">

      <!-- Prepared For -->
      <div style="flex:1;background:#f9fafb;border-radius:8px;padding:20px;border-top:3px solid ${G};">
        <div style="font-size:9px;color:${G};font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Prepared For</div>
        ${img.companyLogo ? `
        <div style="margin-bottom:10px;">
          <img src="${img.companyLogo}" alt="" style="height:36px;max-width:120px;object-fit:contain;border-radius:4px;" onerror="this.style.display='none'" />
        </div>` : ""}
        <div style="font-size:20px;font-weight:800;color:${D};line-height:1.2;">${e(contactName)}</div>
        <div style="font-size:12px;color:#4b5563;margin-top:3px;">${e(contactTitle)}</div>
        ${orgName ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;font-weight:500;">${e(orgName)}</div>` : ""}
      </div>

      <!-- Property Details -->
      <div style="flex:1;background:#f9fafb;border-radius:8px;padding:20px;border-top:3px solid ${R};">
        <div style="font-size:9px;color:${R};font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Property Details</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
          ${stats.map(s => `<span style="background:#e5e7eb;padding:3px 10px;border-radius:12px;font-size:10px;color:#374151;font-weight:500;">${e(s!)}</span>`).join("")}
        </div>
        <div style="margin-top:4px;">
          <span style="background:${R};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:12px;">${e(c.estimatedExposure)} est. annual exposure</span>
        </div>
        ${img.satelliteMap ? `<div style="margin-top:12px;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;"><img src="${img.satelliteMap}" alt="" style="width:100%;height:90px;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'" /></div>` : ""}
      </div>
    </div>

    <!-- Tagline -->
    <div style="text-align:center;padding:18px 24px;background:${D};border-radius:8px;">
      <div style="color:#fff;font-size:13px;font-weight:600;margin-bottom:4px;">${e(c.headline)}</div>
      <div style="color:#9ca3af;font-size:11px;">${e(c.subtitle)}</div>
    </div>

    <!-- Footer -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;">
      <div style="font-size:10px;color:#9ca3af;">Paul Davis Restoration &bull; Palm Beach County &bull; Treasure Coast &bull; (561) 478-7272</div>
      <div style="font-size:10px;color:#9ca3af;">Confidential &bull; Page 1 of 3</div>
    </div>
  </div>
</div>

<!-- ═══════════════════ PAGE 2: CONTACT INTEL + PROPERTY ═══════════════════ -->
<div class="page" style="padding:0.5in;">
  ${pageHeader}

  <!-- Headline -->
  <div style="margin-bottom:20px;">
    <div style="width:40px;height:3px;background:${G};margin-bottom:12px;border-radius:2px;"></div>
    <h1 style="font-size:24px;font-weight:800;color:${D};line-height:1.2;margin-bottom:6px;">${e(c.headline)}</h1>
    <p style="font-size:12px;color:#6b7280;max-width:480px;">${e(c.subtitle)}</p>
  </div>

  <!-- Contact Intel -->
  <div style="background:#faf8f3;border-radius:8px;padding:16px;border-left:3px solid ${G};margin-bottom:20px;">
    <div style="font-size:9px;color:${G};text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:10px;">About ${e(contactName.split(" ")[0])}'s Role</div>
    <p style="font-size:11px;color:#374151;margin-bottom:6px;">${e(c.contactBrief.roleInsight)}</p>
    <p style="font-size:10px;color:#6b7280;font-style:italic;">${e(c.contactBrief.decisionStyle)}</p>
    <div style="margin-top:10px;">
      <div style="font-size:9px;color:${R};text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:5px;">Key Pain Points</div>
      <ul style="list-style:none;padding:0;">${painHtml}</ul>
    </div>
  </div>

  <!-- Property Risks -->
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${D};margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid ${R};">
    Risk Assessment: ${e(propertyName)}
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
    <tbody>${risksHtml}</tbody>
  </table>

  ${pageFooter(2)}
</div>

<!-- ═══════════════════ PAGE 3: SERVICES + WHY US + CTA ═══════════════════ -->
<div class="page" style="padding:0.5in;">
  ${pageHeader}

  <!-- Recommended Services -->
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${D};margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid ${G};">
    Recommended Services
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
    <thead>
      <tr style="background:${D};color:#fff;">
        <th style="padding:5px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">Service</th>
        <th style="padding:5px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">Why for This Property</th>
        <th style="padding:5px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">Priority</th>
      </tr>
    </thead>
    <tbody>${servicesHtml}</tbody>
  </table>

  <!-- Why Paul Davis -->
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${D};margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid ${G};">
    Why Paul Davis for ${e(propertyName)}
  </div>
  <div style="margin-bottom:20px;">
    ${whyUsHtml}
  </div>

  <!-- CTA -->
  <div style="background:${R};color:#fff;padding:20px 28px;border-radius:10px;text-align:center;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;opacity:0.8;margin-bottom:6px;">Your Next Step</div>
    <div style="font-size:15px;font-weight:700;line-height:1.3;">${e(c.callToAction)}</div>
    ${c.nextStep ? `<div style="font-size:11px;opacity:0.9;margin-top:5px;font-style:italic;">${e(c.nextStep)}</div>` : ""}
    <div style="margin-top:10px;"><span style="background:rgba(255,255,255,0.2);padding:4px 16px;border-radius:16px;font-size:12px;font-weight:600;">(561) 478-7272 &bull; 24/7 Emergency Response</span></div>
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
