import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { scoreContact, scoreAll } from "@/modules/scoring/services/lead-scorer";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Score single contact
  if (body.contactId) {
    try {
      const scores = await scoreContact(body.contactId);
      return NextResponse.json({ data: scores });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Scoring failed" },
        { status: 500 }
      );
    }
  }

  // Score all golden records
  if (body.all) {
    const result = await scoreAll();
    return NextResponse.json({ data: result });
  }

  // Score batch
  if (body.contactIds && Array.isArray(body.contactIds)) {
    let scored = 0;
    const errors: string[] = [];
    for (const id of body.contactIds) {
      try {
        await scoreContact(id);
        scored++;
      } catch (err) {
        errors.push(`${id}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    return NextResponse.json({ data: { scored, errors } });
  }

  return NextResponse.json(
    { error: "Provide contactId, contactIds, or all: true" },
    { status: 400 }
  );
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "25");
  const skip = (page - 1) * limit;
  const minScore = parseInt(searchParams.get("minScore") ?? "0");

  const where = {
    isGoldenRecord: true,
    compositeScore: { gte: minScore > 0 ? minScore : undefined },
    lastScoredAt: { not: null as null },
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        title: true,
        email: true,
        phone: true,
        phoneMobile: true,
        status: true,
        fitScore: true,
        triggerScore: true,
        reachabilityScore: true,
        compositeScore: true,
        lastScoredAt: true,
        organization: { select: { name: true, orgType: true } },
        territory: { select: { name: true } },
      },
      orderBy: { compositeScore: "desc" },
      skip,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      contacts,
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  });
}
