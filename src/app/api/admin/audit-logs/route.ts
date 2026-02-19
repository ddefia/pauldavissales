import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import { getAuditLogs, getAuditSummary } from "@/modules/admin/services/audit-logger";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const summary = searchParams.get("summary");

  // Return summary stats
  if (summary === "true") {
    const days = parseInt(searchParams.get("days") ?? "30");
    const summaryData = await getAuditSummary(days);
    return NextResponse.json({ data: summaryData });
  }

  // Return paginated logs
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const userId = searchParams.get("userId") ?? undefined;
  const entityType = searchParams.get("entityType") ?? undefined;
  const action = searchParams.get("action") ?? undefined;

  const result = await getAuditLogs({
    userId,
    entityType,
    action,
    page,
    limit,
  });

  return NextResponse.json({
    data: {
      logs: result.logs,
      total: result.total,
      page,
      pages: Math.ceil(result.total / limit),
    },
  });
}
