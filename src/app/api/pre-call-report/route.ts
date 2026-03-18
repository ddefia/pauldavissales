import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { enrichContact } from "@/modules/enrichment/services/claude-enricher";
import { generateTalkTrack } from "@/modules/talk-tracks/services/talk-track-generator";
import { scoreContact } from "@/modules/scoring/services/lead-scorer";

// Allow long generation runs
export const maxDuration = 300;

/**
 * Pre-Call Report: One-click generates everything a rep needs before calling a contact.
 * Runs: Enrichment → Scoring → Talk Track (sequentially, since each builds on the previous).
 * Returns a unified report object.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { contactId } = body;

  if (!contactId) {
    return NextResponse.json(
      { error: "contactId is required" },
      { status: 400 }
    );
  }

  // Load contact to check current state
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      fullName: true,
      title: true,
      email: true,
      phone: true,
      enrichmentBrief: true,
      lastEnrichedAt: true,
      compositeScore: true,
      fitScore: true,
      triggerScore: true,
      reachabilityScore: true,
      talkTrackId: true,
      organization: { select: { name: true, orgType: true } },
      territory: { select: { name: true } },
      properties: {
        include: {
          property: {
            select: {
              id: true,
              name: true,
              propertyType: true,
              city: true,
              state: true,
              unitCount: true,
              yearBuilt: true,
            },
          },
        },
      },
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const steps: { step: string; status: string; duration?: number }[] = [];
  let enrichmentBrief: any = null;
  let talkTrack: any = null;
  let scores: any = null;

  // Step 1: Enrichment (skip if already enriched in the last 7 days)
  const recentlyEnriched =
    contact.lastEnrichedAt &&
    Date.now() - new Date(contact.lastEnrichedAt).getTime() < 7 * 24 * 60 * 60 * 1000;

  if (recentlyEnriched && contact.enrichmentBrief) {
    try {
      enrichmentBrief =
        typeof contact.enrichmentBrief === "string"
          ? JSON.parse(contact.enrichmentBrief)
          : contact.enrichmentBrief;
      steps.push({ step: "enrichment", status: "cached" });
    } catch {
      enrichmentBrief = null;
    }
  }

  if (!enrichmentBrief) {
    const start = Date.now();
    try {
      enrichmentBrief = await enrichContact(contactId);
      steps.push({
        step: "enrichment",
        status: "generated",
        duration: Date.now() - start,
      });
    } catch (err) {
      steps.push({
        step: "enrichment",
        status: "failed",
        duration: Date.now() - start,
      });
      console.error("[PreCallReport] Enrichment failed:", err);
    }
  }

  // Step 2: Scoring
  const start2 = Date.now();
  try {
    scores = await scoreContact(contactId);
    steps.push({
      step: "scoring",
      status: "generated",
      duration: Date.now() - start2,
    });
  } catch (err) {
    steps.push({ step: "scoring", status: "failed", duration: Date.now() - start2 });
    console.error("[PreCallReport] Scoring failed:", err);
  }

  // Step 3: Talk Track
  const start3 = Date.now();
  try {
    talkTrack = await generateTalkTrack(contactId);
    steps.push({
      step: "talk_track",
      status: "generated",
      duration: Date.now() - start3,
    });
  } catch (err) {
    steps.push({
      step: "talk_track",
      status: "failed",
      duration: Date.now() - start3,
    });
    console.error("[PreCallReport] Talk track failed:", err);
  }

  // Reload contact to get updated scores
  const updated = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      compositeScore: true,
      fitScore: true,
      triggerScore: true,
      reachabilityScore: true,
    },
  });

  return NextResponse.json({
    data: {
      contact: {
        id: contact.id,
        fullName: contact.fullName,
        title: contact.title,
        email: contact.email,
        phone: contact.phone,
        organization: contact.organization,
        territory: contact.territory,
        properties: contact.properties.map((cp) => cp.property),
      },
      enrichment: enrichmentBrief,
      scores: updated || scores,
      talkTrack,
      steps,
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * GET: List ALL golden-record contacts for pre-call reports.
 * Enriched contacts sort first (by score), then unenriched contacts.
 * Supports search and pagination.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "30");
  const page = parseInt(searchParams.get("page") ?? "1");
  const search = searchParams.get("search")?.trim() || "";
  const skip = (page - 1) * limit;

  const where: any = {
    isGoldenRecord: true,
    lastName: { not: "" },
  };

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { organization: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        title: true,
        email: true,
        phone: true,
        status: true,
        compositeScore: true,
        fitScore: true,
        triggerScore: true,
        reachabilityScore: true,
        lastEnrichedAt: true,
        talkTrackId: true,
        organization: { select: { name: true, orgType: true } },
        territory: { select: { name: true } },
      },
      orderBy: [
        { lastEnrichedAt: { sort: "desc", nulls: "last" } },
        { compositeScore: { sort: "desc", nulls: "last" } },
        { fullName: "asc" },
      ],
      skip,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({
    data: { contacts },
    pagination: {
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
