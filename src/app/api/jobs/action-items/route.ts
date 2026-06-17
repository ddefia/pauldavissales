import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

// GET /api/jobs/action-items — every action item grouped under its job, for the
// Action Tasks page. Optional ?pm= and ?status=open|done filters. Closed/struck
// jobs are excluded so the to-do layer reflects live work.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const pm = sp.get("pm");
  const status = sp.get("status"); // "open" | "done" | null (all)

  const jobs = await prisma.job.findMany({
    where: {
      struckOut: false,
      closedFromExport: false,
      ...(pm ? { pm } : {}),
      actionItems: status ? { some: { status } } : { some: {} },
    },
    orderBy: [{ pm: "asc" }, { customerName: "asc" }],
    select: {
      id: true,
      jobNumber: true,
      customerName: true,
      pm: true,
      office: true,
      rmsUrl: true,
      actionItems: {
        where: status ? { status } : {},
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Drop jobs whose items all filtered out.
  const groups = jobs.filter((j) => j.actionItems.length > 0);

  return NextResponse.json({ data: groups });
}
