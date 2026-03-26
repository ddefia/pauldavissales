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
  whyUs: string[];
  topRisks: { risk: string; detail: string }[];
  estimatedExposure: string;
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
    companyLogo: orgDomain ? `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${orgDomain}&size=128` : null,
    streetView: googleKey && propertyAddress
      ? `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${encodeURIComponent(propertyAddress)}&key=${googleKey}`
      : null,
    satelliteMap: googleKey && lat && lng
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=400x200&maptype=satellite&markers=color:red|${lat},${lng}&key=${googleKey}`
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

  const prompt = `You are writing a SHORT, punchy 1-page sales leave-behind for Paul Davis Restoration. This goes to a prospect before or after a meeting. Keep it concise — every word must earn its place.

## Paul Davis Restoration
- Full-service property restoration (water, fire, mold, storm damage)
- Palm Beach County & Treasure Coast, South Florida
- 24/7 emergency response, 30-min average arrival
- Works with all major insurance carriers
- Specializes in commercial & multi-family

## Prospect
- **Name:** ${contact.fullName}
- **Title:** ${contact.title || "Decision Maker"}
- **Company:** ${contact.organization?.name || "Independent"} (${contact.organization?.orgType?.replace("_", " ") || "Property Management"})

## Property
- **Name:** ${property.name}
- **Type:** ${property.propertyType?.replace("_", " ") || "Commercial"}
- **Address:** ${propertyAddress}
- **Units:** ${property.unitCount || "N/A"} | **Year Built:** ${property.yearBuilt || "Unknown"} | **Floors:** ${property.floors || "N/A"}
- **Flood Zone:** ${property.floodZone || "Unknown"} | **Coastal:** ${property.coastalExposure ? "Yes" : "Unknown"}

${enrichment ? `## Intel
- Pain triggers: ${(enrichment.pain_triggers || []).join("; ")}
- Risk factors: ${(enrichment.risk_factors || []).join("; ")}` : ""}

## Task
Return ONLY valid JSON (no markdown, no fences):

{
  "headline": "Short, compelling headline for this specific prospect — max 10 words. Mention their property or company name.",
  "subtitle": "One sentence about what Paul Davis can do for THIS property specifically.",
  "whyUs": [
    "4 bullet points (1-2 sentences each) about why Paul Davis is the RIGHT fit for THIS property and THIS prospect. Be specific — mention their building type, age, location risks, their role. NOT generic marketing."
  ],
  "topRisks": [
    {"risk": "Risk name", "detail": "One sentence — specific to THIS building"},
    {"risk": "Risk name", "detail": "One sentence"},
    {"risk": "Risk name", "detail": "One sentence"}
  ],
  "estimatedExposure": "Realistic annual restoration budget estimate. Use conservative, BELIEVABLE numbers. For a small condo: $5,000-$15,000/yr. Mid-size building: $10,000-$40,000/yr. Large high-rise: $25,000-$75,000/yr. Format: '$X,000 - $X,000/yr'",
  "callToAction": "A specific, actionable next step. Example: 'Schedule a free 15-minute property walkthrough this week' or 'Let us run a complimentary risk assessment for [property name]'. Must feel like a clear, easy thing to say yes to.",
  "nextStep": "A second line reinforcing urgency or value. Example: 'Hurricane season starts June 1 — let's make sure you're covered.' or 'We'll deliver a custom restoration plan within 48 hours, no obligation.'"
}

IMPORTANT:
- Keep estimated exposure REALISTIC and conservative — do NOT inflate numbers, they must be believable to a property manager who knows their budget.
- The callToAction should be a specific meeting/call/walkthrough request, not vague.
- Be SPECIFIC to their property. Reference South Florida conditions. Keep it short.`;

  const response = await getAnthropicClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

  let jsonStr = textBlock.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];
  const content: PdfContent = JSON.parse(jsonStr.trim());

  const html = generateHtml(content, contact.fullName, contact.title || "Decision Maker", contact.organization?.name || "", property.name, propertyAddress, images);

  const record = await prisma.generatedPdf.create({
    data: {
      propertyId: property.id,
      templateId: "prospect-one-pager-v1",
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

// ─── HTML Template — Single Page ─────────────────────────────────────────────

function generateHtml(
  content: PdfContent,
  contactName: string,
  contactTitle: string,
  orgName: string,
  propertyName: string,
  propertyAddress: string,
  images: PdfImages
): string {
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const GOLD = "#A1854A";
  const RED = "#ED1C24";
  const DARK = "#222222";

  const companyLogoHtml = images.companyLogo
    ? `<div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
        <img src="${images.companyLogo}" alt="" style="height:24px;width:24px;border-radius:4px;border:1px solid #e5e7eb;" onerror="this.parentElement.style.display='none'" />
        <span style="font-size:10px;color:#9ca3af;">Company Profile</span>
       </div>`
    : "";

  const risksHtml = content.topRisks.map((r) => `
    <tr>
      <td style="padding:6px 10px;font-size:11px;font-weight:600;color:${DARK};border-bottom:1px solid #f3f4f6;white-space:nowrap;vertical-align:top;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${RED};margin-right:6px;vertical-align:middle;"></span>${esc(r.risk)}
      </td>
      <td style="padding:6px 10px;font-size:11px;color:#4b5563;border-bottom:1px solid #f3f4f6;">${esc(r.detail)}</td>
    </tr>`).join("");

  const whyUsHtml = content.whyUs.map((item) => `
    <div style="display:flex;gap:8px;margin-bottom:8px;">
      <span style="color:${GOLD};font-size:14px;font-weight:700;flex-shrink:0;margin-top:1px;">&#10003;</span>
      <span style="font-size:11px;color:#374151;line-height:1.5;">${esc(item)}</span>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paul Davis - ${esc(propertyName)}</title>
  <style>
    @page { size: letter; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 8.5in;
      min-height: 11in;
      position: relative;
    }
    @media screen {
      body { background: #e5e7eb; }
      .page {
        max-width: 8.5in;
        margin: 20px auto;
        background: white;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      }
    }
  </style>
</head>
<body>

<div class="page">
  <!-- ─── HEADER BAR ─── -->
  <div style="background:${DARK};padding:16px 40px;display:flex;justify-content:space-between;align-items:center;">
    <img src="${images.paulDavisLogo}" alt="Paul Davis" style="height:40px;width:auto;" />
    <div style="color:#9ca3af;font-size:10px;text-align:right;">
      <div style="color:${GOLD};font-weight:600;font-size:11px;">PROPERTY ASSESSMENT</div>
      <div>${dateStr}</div>
    </div>
  </div>

  <!-- ─── HERO: STREET VIEW + HEADLINE ─── -->
  ${images.streetView ? `
  <div style="position:relative;height:220px;overflow:hidden;">
    <img src="${images.streetView}" alt="${esc(propertyName)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display='none'" />
    <div style="position:absolute;top:12px;left:16px;background:rgba(0,0,0,0.7);color:#fff;padding:6px 12px;border-radius:4px;font-size:10px;">
      <span style="color:${GOLD};font-weight:700;">${esc(propertyName)}</span> &bull; ${esc(propertyAddress)}
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.85));padding:20px 40px;">
      <div style="color:#fff;font-size:22px;font-weight:800;line-height:1.2;">${esc(content.headline)}</div>
      <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px;">${esc(content.subtitle)}</div>
    </div>
  </div>` : `
  <div style="padding:28px 40px 16px;border-bottom:2px solid ${GOLD};">
    <div style="font-size:24px;font-weight:800;color:${DARK};line-height:1.2;">${esc(content.headline)}</div>
    <div style="font-size:13px;color:#6b7280;margin-top:4px;">${esc(content.subtitle)}</div>
  </div>`}

  <!-- ─── BODY ─── -->
  <div style="padding:20px 40px 16px;">

    <!-- Prepared For + Property -->
    <div style="display:flex;gap:20px;margin-bottom:20px;">
      <div style="flex:1;background:#f9fafb;border-radius:6px;padding:14px;border-left:3px solid ${GOLD};">
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Prepared For</div>
        <div style="font-size:15px;font-weight:700;color:${DARK};">${esc(contactName)}</div>
        <div style="font-size:11px;color:#4b5563;">${esc(contactTitle)}</div>
        ${orgName ? `<div style="font-size:11px;color:#6b7280;">${esc(orgName)}</div>` : ""}
        ${companyLogoHtml}
      </div>
      <div style="flex:1;background:#f9fafb;border-radius:6px;padding:14px;border-left:3px solid ${RED};">
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Property</div>
        <div style="font-size:15px;font-weight:700;color:${DARK};">${esc(propertyName)}</div>
        <div style="font-size:11px;color:#4b5563;">${esc(propertyAddress)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <div style="background:${RED};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;">${esc(content.estimatedExposure)}</div>
          ${images.satelliteMap ? `<img src="${images.satelliteMap}" alt="" style="height:36px;width:auto;border-radius:4px;border:1px solid #e5e7eb;" onerror="this.style.display='none'" />` : ""}
        </div>
      </div>
    </div>

    <!-- Two Column Layout -->
    <div style="display:flex;gap:20px;">

      <!-- LEFT: Why Paul Davis -->
      <div style="flex:1;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${DARK};margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid ${GOLD};">
          Why Paul Davis for ${esc(propertyName)}
        </div>
        ${whyUsHtml}
      </div>

      <!-- RIGHT: Top Risks -->
      <div style="flex:1;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${DARK};margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid ${RED};">
          Key Risk Factors
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${risksHtml}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ─── CTA FOOTER ─── -->
  <div style="position:absolute;bottom:0;left:0;right:0;">
    <div style="background:${RED};color:#fff;padding:20px 40px;text-align:center;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;opacity:0.8;margin-bottom:6px;">Your Next Step</div>
      <div style="font-size:17px;font-weight:700;line-height:1.3;">${esc(content.callToAction)}</div>
      ${content.nextStep ? `<div style="font-size:12px;opacity:0.9;margin-top:6px;font-style:italic;">${esc(content.nextStep)}</div>` : ""}
      <div style="margin-top:10px;font-size:13px;font-weight:600;">
        <span style="background:rgba(255,255,255,0.2);padding:4px 16px;border-radius:20px;">(561) 478-7272 &bull; 24/7</span>
      </div>
    </div>
    <div style="background:${DARK};padding:8px 40px;display:flex;justify-content:space-between;font-size:9px;color:#6b7280;">
      <span>Paul Davis Restoration &bull; Palm Beach County &bull; Treasure Coast</span>
      <span>pauldavis.com &bull; Confidential</span>
    </div>
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
