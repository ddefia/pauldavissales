import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

const DRIFT_THRESHOLD = 0.05; // estimate drifted down >5% from commitment

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

// GET /api/jobs/dashboard — the at-a-glance numbers (whitepaper §6.1).
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const openJobs = await prisma.job.findMany({
    where: { struckOut: false, closedFromExport: false },
    include: { billingForecasts: true },
  });

  // ── Cash-flow forecast: sum every open job's billing forecast by month ──
  const monthTotals = new Map<string, number>();
  for (const job of openJobs) {
    for (const f of job.billingForecasts) {
      monthTotals.set(f.month, (monthTotals.get(f.month) ?? 0) + f.amount);
    }
  }
  const cashFlow = [...monthTotals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amount]) => ({ month, label: monthLabel(month), amount }));

  // ── Open job stats ──
  let committedTotal = 0;
  let currentTotal = 0;
  for (const job of openJobs) {
    if (job.committedEstimate != null) committedTotal += job.committedEstimate;
    if (job.currentEstimate != null) currentTotal += job.currentEstimate;
  }
  const variance = currentTotal - committedTotal;
  const variancePct = committedTotal ? (variance / committedTotal) * 100 : null;

  // ── # of jobs by status ──
  const statusCounts = new Map<string, number>();
  for (const job of openJobs) {
    const key = job.jobStatus || "No status";
    statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
  }
  const byStatus = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // ── Optional segmentation by PM / office ──
  const pmAgg = new Map<string, { count: number; currentTotal: number }>();
  const officeAgg = new Map<string, { count: number; currentTotal: number }>();
  for (const job of openJobs) {
    const pm = job.pm || "Unassigned";
    const office = job.office || "No office";
    const p = pmAgg.get(pm) ?? { count: 0, currentTotal: 0 };
    p.count++;
    p.currentTotal += job.currentEstimate ?? 0;
    pmAgg.set(pm, p);
    const o = officeAgg.get(office) ?? { count: 0, currentTotal: 0 };
    o.count++;
    o.currentTotal += job.currentEstimate ?? 0;
    officeAgg.set(office, o);
  }
  const byPm = [...pmAgg.entries()]
    .map(([pm, v]) => ({ pm, ...v }))
    .sort((a, b) => b.currentTotal - a.currentTotal);
  const byOffice = [...officeAgg.entries()]
    .map(([office, v]) => ({ office, ...v }))
    .sort((a, b) => b.currentTotal - a.currentTotal);

  // ── Alerts (whitepaper §7.4): past target date, and estimate drift ──
  const now = new Date();
  const pastDue = openJobs
    .filter((j) => j.targetCompletionDate && j.targetCompletionDate < now)
    .map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      customerName: j.customerName,
      pm: j.pm,
      targetCompletionDate: j.targetCompletionDate,
    }));
  const drift = openJobs
    .filter(
      (j) =>
        j.committedEstimate != null &&
        j.committedEstimate > 0 &&
        j.currentEstimate != null &&
        j.currentEstimate < j.committedEstimate * (1 - DRIFT_THRESHOLD)
    )
    .map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      customerName: j.customerName,
      pm: j.pm,
      committedEstimate: j.committedEstimate,
      currentEstimate: j.currentEstimate,
      variance: (j.currentEstimate ?? 0) - (j.committedEstimate ?? 0),
    }));

  return NextResponse.json({
    data: {
      openCount: openJobs.length,
      committedTotal,
      currentTotal,
      variance,
      variancePct,
      cashFlow,
      byStatus,
      byPm,
      byOffice,
      alerts: { pastDue, drift },
    },
  });
}
