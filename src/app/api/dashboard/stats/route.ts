import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contactSelect = {
    id: true,
    fullName: true,
    title: true,
    compositeScore: true,
    email: true,
    phone: true,
    city: true,
    organization: { select: { name: true } },
    territory: { select: { name: true } },
  };

  const [
    totalContacts,
    totalOrganizations,
    // Tiered contacts
    bigFish,
    mediumFish,
    worthACall,
    // Counts per tier
    bigFishCount,
    mediumFishCount,
    worthACallCount,
    // Territory breakdown
    contactsByTerritory,
    // Map contacts
    mapContacts,
  ] = await Promise.all([
    prisma.contact.count({ where: { isGoldenRecord: true } }),
    prisma.organization.count(),

    // Big Fish: score >= 60
    prisma.contact.findMany({
      where: { isGoldenRecord: true, compositeScore: { gte: 60 } },
      select: contactSelect,
      orderBy: { compositeScore: "desc" },
      take: 20,
    }),
    // Medium Fish: score 35-59
    prisma.contact.findMany({
      where: { isGoldenRecord: true, compositeScore: { gte: 35, lt: 60 } },
      select: contactSelect,
      orderBy: { compositeScore: "desc" },
      take: 15,
    }),
    // Worth a Call: score 15-34 with a title
    prisma.contact.findMany({
      where: { isGoldenRecord: true, compositeScore: { gte: 15, lt: 35 }, title: { not: "" } },
      select: contactSelect,
      orderBy: { compositeScore: "desc" },
      take: 10,
    }),

    prisma.contact.count({ where: { isGoldenRecord: true, compositeScore: { gte: 60 } } }),
    prisma.contact.count({ where: { isGoldenRecord: true, compositeScore: { gte: 35, lt: 60 } } }),
    prisma.contact.count({ where: { isGoldenRecord: true, compositeScore: { gte: 15, lt: 35 }, title: { not: "" } } }),

    prisma.contact.groupBy({
      by: ["territoryId"],
      where: { isGoldenRecord: true, territoryId: { not: null } },
      _count: true,
    }),
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

  // Territory names
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
      bigFish,
      mediumFish,
      worthACall,
      bigFishCount,
      mediumFishCount,
      worthACallCount,
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
    },
  });
}
