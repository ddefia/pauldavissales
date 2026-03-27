import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { queryOne } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalContacts, totalOrganizations, callList, contactsByTerritory, mapContacts, weeklyPlan] =
    await Promise.all([
      prisma.contact.count({ where: { isGoldenRecord: true } }),
      prisma.organization.count(),

      // Single prioritized call list — top 30 contacts by score
      // Only contacts with a phone or email (reachable)
      prisma.contact.findMany({
        where: {
          isGoldenRecord: true,
          compositeScore: { gte: 15 },
          OR: [{ phone: { not: null } }, { email: { not: null } }],
        },
        select: {
          id: true,
          fullName: true,
          title: true,
          compositeScore: true,
          email: true,
          phone: true,
          phoneMobile: true,
          city: true,
          painTriggers: true,
          enrichmentBrief: true,
          lastEnrichedAt: true,
          organization: { select: { name: true } },
          territory: { select: { name: true } },
        },
        orderBy: { compositeScore: "desc" },
        take: 30,
      }),

      // Territory breakdown
      prisma.contact.groupBy({
        by: ["territoryId"],
        where: { isGoldenRecord: true, territoryId: { not: null } },
        _count: true,
      }),

      // Map contacts
      prisma.contact.findMany({
        where: { isGoldenRecord: true, city: { not: null } },
        select: {
          id: true,
          fullName: true,
          city: true,
          compositeScore: true,
          status: true,
          territory: { select: { name: true } },
        },
      }),

      // Active weekly plan via direct pg (bypasses Prisma adapter schema cache)
      queryOne(`SELECT * FROM "WeeklyPlan" WHERE status = 'active' ORDER BY "weekStart" DESC LIMIT 1`).catch(() => null),
    ]);

  // Build a human-readable "why" for each contact from their enrichment data
  const callListWithWhy = callList.map((c) => {
    let why = "";

    // Try to extract a one-liner from enrichment brief
    if (c.enrichmentBrief) {
      try {
        const brief =
          typeof c.enrichmentBrief === "string"
            ? JSON.parse(c.enrichmentBrief)
            : c.enrichmentBrief;

        // Apollo-sourced briefs have a "summary" field
        if (brief.summary) {
          // Take first sentence only
          const firstSentence = brief.summary.split(/[.!]\s/)[0];
          if (firstSentence && firstSentence.length < 150) {
            why = firstSentence;
          }
        }
        // Claude-sourced briefs have a different structure
        if (!why && brief.role_context) {
          why = brief.role_context;
        }
      } catch {}
    }

    // Fallback: build from pain triggers
    if (!why && c.painTriggers && c.painTriggers.length > 0) {
      why = c.painTriggers.slice(0, 2).join(", ");
    }

    // Fallback: title + company
    if (!why) {
      why = [c.title, c.organization?.name].filter(Boolean).join(" at ");
    }

    return {
      id: c.id,
      fullName: c.fullName,
      title: c.title,
      email: c.email,
      phone: c.phone,
      phoneMobile: c.phoneMobile,
      city: c.city,
      orgName: c.organization?.name || null,
      territory: c.territory?.name || null,
      why,
      hasEnrichment: !!c.lastEnrichedAt,
    };
  });

  // Territory names
  const territoryIds = contactsByTerritory
    .map((t) => t.territoryId)
    .filter(Boolean) as string[];
  const territories =
    territoryIds.length > 0
      ? await prisma.territory.findMany({
          where: { id: { in: territoryIds } },
          select: { id: true, name: true },
        })
      : [];
  const territoryMap = Object.fromEntries(
    territories.map((t) => [t.id, t.name])
  );

  return NextResponse.json({
    data: {
      totalContacts,
      totalOrganizations,
      callList: callListWithWhy,
      territoryBreakdown: contactsByTerritory.map((t) => ({
        name: territoryMap[t.territoryId!] || "Unknown",
        count: t._count,
      })),
      mapContacts: mapContacts.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        city: c.city,
        territory: c.territory?.name || null,
        compositeScore: c.compositeScore,
        status: c.status,
      })),
      weeklyPlan: weeklyPlan
        ? {
            id: weeklyPlan.id,
            weekNumber: weeklyPlan.weekNumber,
            label: weeklyPlan.label,
            status: weeklyPlan.status,
            weekStart: weeklyPlan.weekStart,
            targetCalls: weeklyPlan.targetCalls,
            targetEmails: weeklyPlan.targetEmails,
            targetVoicemails: weeklyPlan.targetVoicemails,
            targetMeetings: weeklyPlan.targetMeetings,
            targetPdfs: weeklyPlan.targetPdfs,
            actualCalls: weeklyPlan.actualCalls,
            actualEmails: weeklyPlan.actualEmails,
            actualVoicemails: weeklyPlan.actualVoicemails,
            actualMeetings: weeklyPlan.actualMeetings,
            actualPdfs: weeklyPlan.actualPdfs,
            notes: weeklyPlan.notes,
          }
        : null,
    },
  });
}
