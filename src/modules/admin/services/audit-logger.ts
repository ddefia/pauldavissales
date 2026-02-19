import prisma from "@/lib/prisma";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "IMPORT"
  | "MERGE"
  | "VALIDATE"
  | "ENRICH"
  | "SCORE"
  | "GENERATE_PDF"
  | "GENERATE_TALK_TRACK"
  | "FIND_LEAD"
  | "LOGIN"
  | "SETTINGS_CHANGE";

export type AuditEntityType =
  | "contact"
  | "organization"
  | "property"
  | "import_batch"
  | "duplicate_group"
  | "user"
  | "talk_track"
  | "generated_pdf"
  | "system";

/**
 * Logs an audit event for governance tracking
 */
export async function logAudit(params: {
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  details?: Record<string, any>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details ?? undefined,
    },
  });
}

/**
 * Get audit log entries with filtering
 */
export async function getAuditLogs(params: {
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}): Promise<{ logs: any[]; total: number }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.userId) where.userId = params.userId;
  if (params.entityType) where.entityType = params.entityType;
  if (params.entityId) where.entityId = params.entityId;
  if (params.action) where.action = params.action;
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = params.startDate;
    if (params.endDate) where.createdAt.lte = params.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

/**
 * Get audit summary stats
 */
export async function getAuditSummary(days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [byAction, byUser, byEntity, totalCount] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ["action"],
      where: { createdAt: { gte: since } },
      _count: true,
      orderBy: { _count: { action: "desc" } },
    }),
    prisma.auditLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 10,
    }),
    prisma.auditLog.groupBy({
      by: ["entityType"],
      where: { createdAt: { gte: since } },
      _count: true,
      orderBy: { _count: { entityType: "desc" } },
    }),
    prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
  ]);

  return { byAction, byUser, byEntity, totalCount, period: `${days} days` };
}
