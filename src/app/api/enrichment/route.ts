import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { enrichContact, enrichBatch } from "@/modules/enrichment/services/claude-enricher";

// Allow long enrichment runs
export const maxDuration = 300;

// In-memory batch status for polling
let currentBatch: {
  running: boolean;
  success: number;
  failed: number;
  total: number;
  errors: string[];
  startedAt: Date | null;
} = { running: false, success: 0, failed: 0, total: 0, errors: [], startedAt: null };

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Single contact enrichment (synchronous — takes ~30 sec)
  if (body.contactId) {
    try {
      const brief = await enrichContact(body.contactId);
      return NextResponse.json({ data: brief });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Enrichment failed" },
        { status: 500 }
      );
    }
  }

  // Check batch status
  if (body.checkStatus) {
    return NextResponse.json({ data: { ...currentBatch } });
  }

  // Don't allow starting a new batch while one is running
  if (currentBatch.running) {
    return NextResponse.json({
      data: {
        ...currentBatch,
        message: "A batch is already running. Check back for progress.",
      },
    });
  }

  // Batch enrichment
  let contactIds: string[] = [];
  const batchSize = body.batchSize ?? 10;

  if (body.contactIds && Array.isArray(body.contactIds)) {
    contactIds = body.contactIds;
  } else if (body.all) {
    // Prioritize contacts with the best data: has org, has title, has full name
    const contacts = await prisma.contact.findMany({
      where: {
        isGoldenRecord: true,
        status: { in: ["RAW", "VALIDATED"] },
        enrichmentBrief: null,
        lastName: { not: "" },
      },
      select: { id: true },
      orderBy: [
        { dataQualityScore: { sort: "desc", nulls: "last" } },
      ],
      take: batchSize,
    });
    contactIds = contacts.map((c) => c.id);
  } else {
    return NextResponse.json(
      { error: "Provide contactId, contactIds, or all: true" },
      { status: 400 }
    );
  }

  if (contactIds.length === 0) {
    return NextResponse.json({
      data: { success: 0, failed: 0, total: 0, errors: [], message: "No contacts to enrich" },
    });
  }

  // Start batch in background — respond immediately
  currentBatch = {
    running: true,
    success: 0,
    failed: 0,
    total: contactIds.length,
    errors: [],
    startedAt: new Date(),
  };

  // Fire and forget — runs in background
  enrichBatch(contactIds, (status) => {
    // Live progress updates
    currentBatch.success = status.success;
    currentBatch.failed = status.failed;
  }).then((result) => {
    currentBatch = {
      running: false,
      success: result.success,
      failed: result.failed,
      total: contactIds.length,
      errors: result.errors,
      startedAt: currentBatch.startedAt,
    };
    console.log(`[Enrichment] Batch complete: ${result.success} enriched, ${result.failed} failed`);
  }).catch((err) => {
    currentBatch = {
      running: false,
      success: currentBatch.success,
      failed: currentBatch.failed,
      total: contactIds.length,
      errors: [...currentBatch.errors, err instanceof Error ? err.message : String(err)],
      startedAt: currentBatch.startedAt,
    };
    console.error("[Enrichment] Batch crashed:", err);
  });

  return NextResponse.json({
    data: {
      message: `Enrichment started for ${contactIds.length} contacts. Poll for status.`,
      ...currentBatch,
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  // Get enriched contacts with brief data
  const [contacts, total, enrichedCount, pendingCount] = await Promise.all([
    prisma.contact.findMany({
      where: { isGoldenRecord: true, enrichmentBrief: { not: null } },
      select: {
        id: true,
        fullName: true,
        title: true,
        email: true,
        status: true,
        enrichmentBrief: true,
        lastEnrichedAt: true,
        organization: { select: { name: true, orgType: true } },
        territory: { select: { name: true } },
      },
      orderBy: { lastEnrichedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.contact.count({
      where: { isGoldenRecord: true, enrichmentBrief: { not: null } },
    }),
    prisma.contact.count({
      where: { isGoldenRecord: true, enrichmentBrief: { not: null } },
    }),
    prisma.contact.count({
      where: {
        isGoldenRecord: true,
        enrichmentBrief: null,
        status: { in: ["RAW", "VALIDATED"] },
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      contacts: contacts.map((c) => ({
        ...c,
        enrichmentBrief: c.enrichmentBrief
          ? (() => {
              try {
                return JSON.parse(c.enrichmentBrief);
              } catch {
                return c.enrichmentBrief;
              }
            })()
          : null,
      })),
      total,
      enrichedCount,
      pendingCount,
      batchStatus: currentBatch,
      page,
      pages: Math.ceil(total / limit),
    },
  });
}
