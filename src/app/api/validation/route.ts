import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { runValidation } from "@/modules/validation/services/validation-orchestrator";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  let contactIds: string[] = [];

  if (body.contactIds && Array.isArray(body.contactIds)) {
    contactIds = body.contactIds;
  } else if (body.importBatchId) {
    const contacts = await prisma.contact.findMany({
      where: { importBatchId: body.importBatchId, isGoldenRecord: true },
      select: { id: true },
    });
    contactIds = contacts.map((c) => c.id);
  } else if (body.all) {
    const contacts = await prisma.contact.findMany({
      where: { isGoldenRecord: true, status: "RAW" },
      select: { id: true },
      take: 500,
    });
    contactIds = contacts.map((c) => c.id);
  } else {
    return NextResponse.json(
      { error: "Provide contactIds, importBatchId, or all: true" },
      { status: 400 }
    );
  }

  if (contactIds.length === 0) {
    return NextResponse.json({ data: { processed: 0, valid: 0, invalid: 0, warnings: 0 } });
  }

  const result = await runValidation(contactIds);
  return NextResponse.json({ data: result });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return validation summary stats
  const [
    totalResults,
    validCount,
    invalidCount,
    warnCount,
    byType,
  ] = await Promise.all([
    prisma.validationResult.count(),
    prisma.validationResult.count({ where: { status: "VALID" } }),
    prisma.validationResult.count({ where: { status: "INVALID" } }),
    prisma.validationResult.count({ where: { status: "WARN" } }),
    prisma.validationResult.groupBy({
      by: ["type", "status"],
      _count: true,
    }),
  ]);

  return NextResponse.json({
    data: {
      total: totalResults,
      valid: validCount,
      invalid: invalidCount,
      warnings: warnCount,
      byType: byType.map((g) => ({
        type: g.type,
        status: g.status,
        count: g._count,
      })),
    },
  });
}
