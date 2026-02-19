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
    avgDataQuality,
    pendingDuplicates,
    recentImports,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.organization.count(),
    prisma.property.count(),
    prisma.importBatch.count(),
    prisma.contact.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.contact.count({ where: { email: { not: null } } }),
    prisma.contact.count({ where: { phone: { not: null } } }),
    prisma.contact.count({ where: { status: "VALIDATED" } }),
    prisma.contact.aggregate({ _avg: { dataQualityScore: true } }),
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
        completedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
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
    avgDataQuality: Math.round(avgDataQuality._avg.dataQualityScore ?? 0),
    pendingDuplicates,
    recentImports,
  });
}
