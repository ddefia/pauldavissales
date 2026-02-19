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

export interface GeneratedTalkTrack {
  opener_30sec: string;
  discovery_questions: string[];
  value_propositions: string[];
  objection_handlers: { objection: string; response: string }[];
  follow_up_email: { subject: string; body: string };
  voicemail_script: string;
  next_steps: string[];
}

export async function generateTalkTrack(
  contactId: string
): Promise<GeneratedTalkTrack> {
  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: {
      organization: {
        select: { name: true, orgType: true },
      },
      properties: {
        include: {
          property: {
            select: {
              name: true,
              propertyType: true,
              city: true,
              unitCount: true,
              yearBuilt: true,
            },
          },
        },
      },
      territory: { select: { name: true } },
    },
  });

  // Parse enrichment brief if available
  let enrichment: any = null;
  if (contact.enrichmentBrief) {
    try {
      enrichment = JSON.parse(contact.enrichmentBrief);
    } catch {
      // Not JSON, use as plain text
    }
  }

  const propSummary = contact.properties
    .map((cp) => {
      const p = cp.property;
      return `${p.name} (${p.propertyType?.replace("_", " ") || "unknown type"}, ${p.city}, ${p.unitCount || "?"} units${p.yearBuilt ? `, built ${p.yearBuilt}` : ""})`;
    })
    .join("; ");

  const prompt = `You are a sales coach for Paul Davis Restoration in South Florida (Palm Beach County through the Treasure Coast). Generate a complete, ready-to-use sales playbook for a rep calling this prospect.

## Prospect
- **Name:** ${contact.fullName}
- **Title:** ${contact.title || "Unknown title"}
- **Organization:** ${contact.organization?.name || "Unknown"} (${contact.organization?.orgType?.replace("_", " ") || "Unknown type"})
- **Properties:** ${propSummary || "None linked"}
- **Territory:** ${contact.territory?.name || "Unassigned"}

${enrichment ? `## Research Brief
- **Summary:** ${enrichment.summary || ""}
- **Pain Triggers:** ${(enrichment.pain_triggers || []).join("; ")}
- **Personalization Hooks:** ${(enrichment.personalization_hooks || []).join("; ")}
- **Recommended Approach:** ${(enrichment.recommended_approach || []).join("; ")}` : "## No enrichment data available — generate based on role and property type."}

## Paul Davis Value Props
- 24/7 emergency response, average 30-min arrival in territory
- Full-service restoration: water, fire, mold, storm, biohazard
- Direct insurance billing + advocacy
- Commercial & residential expertise
- Dedicated account manager for property management firms
- Preventive maintenance programs
- Emergency preparedness planning for HOA/COA boards

## Generate
Create a complete talk track in JSON format:
{
  "opener_30sec": "A natural, warm 30-second phone opener. Use their name and reference something specific about their property or role. NOT robotic.",
  "discovery_questions": ["5-6 questions that uncover needs, current vendor relationships, and pain points. Conversational, not interrogating."],
  "value_propositions": ["3-4 value props tailored to THIS specific prospect's situation"],
  "objection_handlers": [
    {"objection": "We already have a restoration company", "response": "..."},
    {"objection": "We're not looking right now", "response": "..."},
    {"objection": "Just send me some information", "response": "..."}
  ],
  "follow_up_email": {
    "subject": "Short, specific subject line",
    "body": "2-3 paragraph email. Professional but warm. Reference the call. Include one specific value add."
  },
  "voicemail_script": "30-second voicemail that creates curiosity and gives a reason to call back",
  "next_steps": ["2-3 specific next steps based on different call outcomes"]
}

Make everything feel natural and specific to this prospect. A generic script is useless.`;

  const response = await getAnthropicClient().messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 3000,
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

  const talkTrack: GeneratedTalkTrack = JSON.parse(jsonStr.trim());

  // Save to database as a TalkTrack record
  const saved = await prisma.talkTrack.create({
    data: {
      name: `Talk track for ${contact.fullName}`,
      segment: contact.organization?.orgType ?? "GENERAL",
      category: "personalized",
      content: talkTrack as any,
      isActive: true,
    },
  });

  // Link to contact
  await prisma.contact.update({
    where: { id: contactId },
    data: { talkTrackId: saved.id },
  });

  return talkTrack;
}
