import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

export const maxDuration = 120;

/**
 * Mass actions on duplicate groups:
 * - { action: "dismiss_all" } — dismiss all pending groups
 * - { action: "delete_all_losers" } — for each pending group, keep the highest-quality contact and delete the rest
 * - { action: "delete_groups", groupIds: [...] } — delete specific groups
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, groupIds } = body;

  if (action === "dismiss_all") {
    // Dismiss all pending groups — unlink contacts and mark dismissed
    const pendingGroups = await prisma.duplicateGroup.findMany({
      where: { status: "PENDING" },
      select: { id: true },
    });

    for (const group of pendingGroups) {
      await prisma.contact.updateMany({
        where: { duplicateGroupId: group.id },
        data: { duplicateGroupId: null },
      });
    }

    const result = await prisma.duplicateGroup.updateMany({
      where: { status: "PENDING" },
      data: { status: "DISMISSED", resolvedAt: new Date(), mergedById: session.user.id },
    });

    return NextResponse.json({ data: { dismissed: result.count } });
  }

  if (action === "delete_all_losers") {
    // For each pending group, keep the contact with the highest data quality score
    // and delete the others (losers)
    const pendingGroups = await prisma.duplicateGroup.findMany({
      where: { status: "PENDING" },
      include: {
        contacts: {
          select: { id: true, dataQualityScore: true, email: true, fullName: true },
          orderBy: { dataQualityScore: "desc" },
        },
      },
    });

    let deleted = 0;
    let kept = 0;

    for (const group of pendingGroups) {
      if (group.contacts.length < 2) continue;

      // Winner is the first (highest quality score)
      const winner = group.contacts[0];
      const losers = group.contacts.slice(1);

      // Delete losers' related data then the contacts themselves
      for (const loser of losers) {
        await prisma.contactProperty.deleteMany({ where: { contactId: loser.id } });
        await prisma.validationResult.deleteMany({ where: { contactId: loser.id } });
        await prisma.importRow.updateMany({
          where: { contactId: loser.id },
          data: { contactId: null },
        });
        await prisma.contact.delete({ where: { id: loser.id } });
        deleted++;
      }

      // Mark the group resolved
      await prisma.duplicateGroup.update({
        where: { id: group.id },
        data: {
          status: "MANUALLY_MERGED",
          goldenRecordId: winner.id,
          mergedById: session.user.id,
          resolvedAt: new Date(),
        },
      });

      // Unlink winner from group
      await prisma.contact.update({
        where: { id: winner.id },
        data: { duplicateGroupId: null, isGoldenRecord: true },
      });

      kept++;
    }

    return NextResponse.json({ data: { groups: pendingGroups.length, deleted, kept } });
  }

  if (action === "dismiss_selected" && Array.isArray(groupIds)) {
    for (const groupId of groupIds) {
      await prisma.contact.updateMany({
        where: { duplicateGroupId: groupId },
        data: { duplicateGroupId: null },
      });
    }
    const result = await prisma.duplicateGroup.updateMany({
      where: { id: { in: groupIds } },
      data: { status: "DISMISSED", resolvedAt: new Date(), mergedById: session.user.id },
    });
    return NextResponse.json({ data: { dismissed: result.count } });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const page = parseInt(sp.get("page") ?? "1");
  const pageSize = parseInt(sp.get("pageSize") ?? "25");
  const status = sp.get("status") ?? "PENDING";

  const where: any = {};
  if (status !== "ALL") where.status = status;

  const [groups, total] = await Promise.all([
    prisma.duplicateGroup.findMany({
      where,
      orderBy: { confidence: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        contacts: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            title: true,
            organizationId: true,
            organization: { select: { name: true } },
            dataQualityScore: true,
            source: true,
            isGoldenRecord: true,
          },
        },
      },
    }),
    prisma.duplicateGroup.count({ where }),
  ]);

  return NextResponse.json({
    data: groups,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
