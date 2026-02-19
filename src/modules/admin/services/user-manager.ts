import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";

/**
 * List all users with their territories
 */
export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      territories: {
        include: {
          territory: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get a single user with details
 */
export async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      territories: {
        include: {
          territory: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: {
          importBatches: true,
          auditLogs: true,
        },
      },
    },
  });
}

/**
 * Create a new user
 */
export async function createUser(data: {
  email: string;
  name: string;
  password: string;
  role: "ADMIN" | "MANAGER" | "REP";
  territoryIds?: string[];
}) {
  const passwordHash = await hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
      role: data.role,
    },
  });

  // Assign territories
  if (data.territoryIds && data.territoryIds.length > 0) {
    await prisma.userTerritory.createMany({
      data: data.territoryIds.map((tid) => ({
        userId: user.id,
        territoryId: tid,
      })),
    });
  }

  return user;
}

/**
 * Update user details
 */
export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: "ADMIN" | "MANAGER" | "REP";
    isActive?: boolean;
    password?: string;
    territoryIds?: string[];
  }
) {
  const updates: any = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.email !== undefined) updates.email = data.email;
  if (data.role !== undefined) updates.role = data.role;
  if (data.isActive !== undefined) updates.isActive = data.isActive;
  if (data.password) updates.passwordHash = await hash(data.password, 12);

  const user = await prisma.user.update({
    where: { id },
    data: updates,
  });

  // Update territories if provided
  if (data.territoryIds !== undefined) {
    await prisma.userTerritory.deleteMany({ where: { userId: id } });
    if (data.territoryIds.length > 0) {
      await prisma.userTerritory.createMany({
        data: data.territoryIds.map((tid) => ({
          userId: id,
          territoryId: tid,
        })),
      });
    }
  }

  return user;
}

/**
 * Get system overview stats for admin
 */
export async function getSystemStats() {
  const [
    totalContacts,
    goldenRecords,
    enrichedContacts,
    scoredContacts,
    totalOrgs,
    totalProperties,
    totalImports,
    totalUsers,
    activeUsers,
    pendingDupes,
    totalValidations,
    totalTalkTracks,
    totalPdfs,
    contactsByStatus,
    contactsBySource,
    contactsByTerritory,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { isGoldenRecord: true } }),
    prisma.contact.count({ where: { enrichmentBrief: { not: null } } }),
    prisma.contact.count({ where: { lastScoredAt: { not: null } } }),
    prisma.organization.count(),
    prisma.property.count(),
    prisma.importBatch.count(),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.duplicateGroup.count({ where: { status: "PENDING" } }),
    prisma.validationResult.count(),
    prisma.talkTrack.count(),
    prisma.generatedPdf.count(),
    prisma.contact.groupBy({
      by: ["status"],
      where: { isGoldenRecord: true },
      _count: true,
    }),
    prisma.contact.groupBy({
      by: ["source"],
      _count: true,
    }),
    prisma.contact.groupBy({
      by: ["territoryId"],
      where: { isGoldenRecord: true, territoryId: { not: null } },
      _count: true,
    }),
  ]);

  return {
    totalContacts,
    goldenRecords,
    enrichedContacts,
    scoredContacts,
    totalOrgs,
    totalProperties,
    totalImports,
    totalUsers,
    activeUsers,
    pendingDupes,
    totalValidations,
    totalTalkTracks,
    totalPdfs,
    contactsByStatus: contactsByStatus.map((g) => ({
      status: g.status,
      count: g._count,
    })),
    contactsBySource: contactsBySource.map((g) => ({
      source: g.source,
      count: g._count,
    })),
    contactsByTerritory,
  };
}
