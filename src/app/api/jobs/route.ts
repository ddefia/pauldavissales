import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { serializeJob, JOB_RELATION_INCLUDE } from "@/modules/jobs/services/job-serialize";

// GET /api/jobs — list jobs for the Open Jobs page.
// Filters stack: ?pm=&office=&status=&view=open|closed|all&search=
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const pm = sp.get("pm");
  const office = sp.get("office");
  const status = sp.get("status");
  const view = sp.get("view") ?? "open";
  const search = sp.get("search");

  const where: Record<string, unknown> = {};
  if (pm) where.pm = pm;
  if (office) where.office = office;
  if (status) where.jobStatus = status;

  // "open" = not struck out AND still in the export. Filters stack on top.
  if (view === "open") {
    where.struckOut = false;
    where.closedFromExport = false;
  } else if (view === "closed") {
    where.OR = [{ struckOut: true }, { closedFromExport: true }];
  }

  if (search) {
    const term = { contains: search, mode: "insensitive" as const };
    const searchOr = [
      { customerName: term },
      { jobNumber: term },
      { pm: term },
    ];
    // Don't clobber the closed-view OR; AND them together.
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ currentEstimate: "desc" }, { customerName: "asc" }],
    include: JOB_RELATION_INCLUDE,
  });

  return NextResponse.json({ data: jobs.map(serializeJob) });
}
