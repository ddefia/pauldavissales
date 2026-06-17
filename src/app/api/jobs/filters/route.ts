import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

// GET /api/jobs/filters — distinct PMs, offices and statuses across open jobs,
// to populate the Open Jobs filter dropdowns.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.job.findMany({
    where: { struckOut: false, closedFromExport: false },
    select: { pm: true, office: true, jobStatus: true },
  });

  const dedupe = (vals: (string | null)[]) =>
    [...new Set(vals.filter((v): v is string => !!v))].sort((a, b) =>
      a.localeCompare(b)
    );

  return NextResponse.json({
    data: {
      pms: dedupe(jobs.map((j) => j.pm)),
      offices: dedupe(jobs.map((j) => j.office)),
      statuses: dedupe(jobs.map((j) => j.jobStatus)),
    },
  });
}
