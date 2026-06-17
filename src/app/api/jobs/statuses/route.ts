import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

// Sensible starting set if the franchise hasn't curated their own yet.
const DEFAULT_STATUSES = [
  "New / Intake",
  "Awaiting Adjuster",
  "Estimate Approved",
  "In Progress",
  "Awaiting Materials",
  "Scheduled",
  "Work Complete",
  "Awaiting Payment",
];

// GET /api/jobs/statuses — the custom job-status list (whitepaper §6.4).
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const options = await prisma.jobStatusOption.findMany({
    orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
  });

  return NextResponse.json({
    data: {
      statuses: options.length > 0 ? options.map((o) => o.value) : DEFAULT_STATUSES,
      isDefault: options.length === 0,
    },
  });
}

// PUT /api/jobs/statuses — replace the whole list. Body: { statuses: string[] }
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const incoming: string[] = Array.isArray(body.statuses) ? body.statuses : [];

  // Trim, drop blanks, de-dupe (case-insensitive), preserve order.
  const seen = new Set<string>();
  const statuses: string[] = [];
  for (const raw of incoming) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    statuses.push(value);
  }

  await prisma.$transaction([
    prisma.jobStatusOption.deleteMany({}),
    prisma.jobStatusOption.createMany({
      data: statuses.map((value, i) => ({ value, sortOrder: i })),
    }),
  ]);

  return NextResponse.json({ data: { statuses } });
}
