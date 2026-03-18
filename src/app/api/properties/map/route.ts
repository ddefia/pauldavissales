import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const propertyType = params.get("propertyType");
  const territory = params.get("territory");
  const minUnits = params.get("minUnits");
  const yearBuiltBefore = params.get("yearBuiltBefore");
  const minOpportunity = params.get("minOpportunity");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    latitude: { not: null },
    longitude: { not: null },
  };

  if (propertyType) where.propertyType = propertyType;
  if (territory) where.territory = { name: territory };
  if (minUnits) where.unitCount = { gte: parseInt(minUnits) };
  if (yearBuiltBefore) where.yearBuilt = { lte: parseInt(yearBuiltBefore) };
  if (minOpportunity) where.opportunityScore = { gte: parseFloat(minOpportunity) };

  const properties = await prisma.property.findMany({
    where,
    select: {
      id: true,
      name: true,
      propertyType: true,
      addressLine1: true,
      city: true,
      state: true,
      zipCode: true,
      latitude: true,
      longitude: true,
      unitCount: true,
      yearBuilt: true,
      floors: true,
      riskLevel: true,
      floodZone: true,
      coastalExposure: true,
      opportunityScore: true,
      enrichmentBrief: true,
      territory: { select: { name: true } },
      _count: { select: { contacts: true, organizations: true } },
    },
    orderBy: { opportunityScore: "desc" },
  });

  // Stats
  const total = properties.length;
  const highOpp = properties.filter((p) => (p.opportunityScore ?? 0) >= 70).length;
  const medOpp = properties.filter((p) => (p.opportunityScore ?? 0) >= 40 && (p.opportunityScore ?? 0) < 70).length;

  return NextResponse.json({
    data: {
      properties: properties.map((p) => ({
        ...p,
        territory: p.territory?.name || null,
        contactCount: p._count.contacts,
        orgCount: p._count.organizations,
        _count: undefined,
      })),
      stats: { total, highOpp, medOpp },
    },
  });
}
