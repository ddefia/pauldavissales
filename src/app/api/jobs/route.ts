import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { serializeJob, JOB_RELATION_INCLUDE } from "@/modules/jobs/services/job-serialize";
import { ensureJobsSeeded } from "@/modules/jobs/services/job-seed";

// GET /api/jobs — list jobs for the Open Jobs page.
// Filters stack: ?pm=&office=&status=&view=open|closed|all&search=
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureJobsSeeded();

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
  if (search) {
    const term = { contains: search, mode: "insensitive" as const };
    where.OR = [{ customerName: term }, { jobNumber: term }, { pm: term }];
  }

  const jobs = await prisma.job.findMany({
    where,
    // Biggest jobs first; jobs with no estimate sink to the bottom (Postgres
    // would otherwise put NULLs first on a DESC sort).
    orderBy: [
      { currentEstimate: { sort: "desc", nulls: "last" } },
      { customerName: "asc" },
    ],
    include: JOB_RELATION_INCLUDE,
  });

  // "open" / "closed" is computed (struck-out OR off-export OR Closed status),
  // so filter on the serialized state rather than raw columns.
  let data = jobs.map(serializeJob);
  if (view === "open") data = data.filter((j) => j.isOpen);
  else if (view === "closed") data = data.filter((j) => !j.isOpen);

  return NextResponse.json({ data });
}
