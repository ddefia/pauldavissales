import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// PUT /api/jobs/[id]/billing — replace a job's 3-month billing forecast.
// Body: { entries: [{ month: "YYYY-MM", amount: number }, ...] }
// Months are actual calendar months, never relative labels (whitepaper §7.1).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();

  const job = await prisma.job.findUnique({ where: { id }, select: { id: true } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const rawEntries: { month: string; amount: number }[] = Array.isArray(body.entries)
    ? body.entries
    : [];

  // Validate + de-dupe by month, keeping only real amounts.
  const byMonth = new Map<string, number>();
  for (const e of rawEntries) {
    const month = String(e?.month ?? "").trim();
    const amount = Number(e?.amount);
    if (!MONTH_RE.test(month)) {
      return NextResponse.json(
        { error: `Invalid month "${month}". Use YYYY-MM.` },
        { status: 400 }
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) continue;
    byMonth.set(month, amount);
  }

  // Replace this job's forecast wholesale (each PUT is the new truth for the job).
  await prisma.$transaction([
    prisma.jobBillingForecast.deleteMany({ where: { jobId: id } }),
    ...(byMonth.size > 0
      ? [
          prisma.jobBillingForecast.createMany({
            data: [...byMonth.entries()].map(([month, amount]) => ({
              jobId: id,
              month,
              amount,
            })),
          }),
        ]
      : []),
  ]);

  const forecasts = await prisma.jobBillingForecast.findMany({
    where: { jobId: id },
    orderBy: { month: "asc" },
  });

  return NextResponse.json({ data: forecasts });
}
