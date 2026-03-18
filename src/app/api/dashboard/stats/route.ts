import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalContacts,
    totalOrganizations,
    totalProperties,
    totalImports,
    contactsByStatus,
    contactsWithEmail,
    contactsWithPhone,
    validatedContacts,
    enrichedContacts,
    scoredContacts,
    avgDataQuality,
    contactsWithTitle,
    contactsWithTitleOrPhone,
    pendingDuplicates,
    recentImports,
    contactsByTerritory,
    topScoredContacts,
    mapContacts,
  ] = await Promise.all([
    prisma.contact.count({ where: { isGoldenRecord: true } }),
    prisma.organization.count(),
    prisma.property.count(),
    prisma.importBatch.count(),
    prisma.contact.groupBy({
      by: ["status"],
      where: { isGoldenRecord: true },
      _count: true,
    }),
    prisma.contact.count({ where: { isGoldenRecord: true, email: { not: null } } }),
    prisma.contact.count({ where: { isGoldenRecord: true, phone: { not: null } } }),
    prisma.contact.count({ where: { isGoldenRecord: true, status: "VALIDATED" } }),
    prisma.contact.count({ where: { isGoldenRecord: true, enrichmentBrief: { not: null } } }),
    prisma.contact.count({ where: { isGoldenRecord: true, compositeScore: { not: null } } }),
    prisma.contact.aggregate({ where: { isGoldenRecord: true }, _avg: { dataQualityScore: true } }),
    prisma.contact.count({ where: { isGoldenRecord: true, title: { not: "" } } }),
    prisma.contact.count({ where: { isGoldenRecord: true, OR: [{ title: { not: "" } }, { phone: { not: "" } }] } }),
    prisma.duplicateGroup.count({ where: { status: "PENDING" } }),
    prisma.importBatch.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        status: true,
        source: true,
        totalRows: true,
        newContacts: true,
        createdAt: true,
      },
    }),
    prisma.contact.groupBy({
      by: ["territoryId"],
      where: { isGoldenRecord: true, territoryId: { not: null } },
      _count: true,
    }),
    prisma.contact.findMany({
      where: { isGoldenRecord: true, compositeScore: { not: null } },
      select: {
        id: true,
        fullName: true,
        title: true,
        compositeScore: true,
        fitScore: true,
        triggerScore: true,
        email: true,
        phone: true,
        organization: { select: { name: true } },
        territory: { select: { name: true } },
      },
      orderBy: { compositeScore: "desc" },
      take: 10,
    }),
    // Contacts with city data for map
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
  ]);

  // Get territory names for the groupBy
  const territoryIds = contactsByTerritory.map((t) => t.territoryId).filter(Boolean) as string[];
  const territories = territoryIds.length > 0
    ? await prisma.territory.findMany({
        where: { id: { in: territoryIds } },
        select: { id: true, name: true },
      })
    : [];

  const territoryMap = Object.fromEntries(territories.map((t) => [t.id, t.name]));

  return NextResponse.json({
    data: {
      totalContacts,
      totalOrganizations,
      totalProperties,
      totalImports,
      contactsByStatus: Object.fromEntries(
        contactsByStatus.map((s) => [s.status, s._count])
      ),
      emailCoverage: totalContacts > 0 ? Math.round((contactsWithEmail / totalContacts) * 100) : 0,
      phoneCoverage: totalContacts > 0 ? Math.round((contactsWithPhone / totalContacts) * 100) : 0,
      validatedPct: totalContacts > 0 ? Math.round((validatedContacts / totalContacts) * 100) : 0,
      enrichedCount: contactsWithTitleOrPhone,
      aiBriefCount: enrichedContacts,
      scoredCount: scoredContacts,
      titleCount: contactsWithTitle,
      phoneCount: contactsWithPhone,
      enrichedPct: totalContacts > 0 ? Math.round((contactsWithTitleOrPhone / totalContacts) * 100) : 0,
      scoredPct: totalContacts > 0 ? Math.round((scoredContacts / totalContacts) * 100) : 0,
      avgDataQuality: Math.round(avgDataQuality._avg.dataQualityScore ?? 0),
      pendingDuplicates,
      recentImports,
      territoryBreakdown: contactsByTerritory.map((t) => ({
        name: territoryMap[t.territoryId!] || "Unknown",
        count: t._count,
      })),
      topScoredContacts,
      mapContacts: mapContacts.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        city: c.city,
        territory: c.territory?.name || null,
        compositeScore: c.compositeScore,
        status: c.status,
      })),
    },
  });
}
