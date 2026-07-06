import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import { seedBuiltInJobs, BUILT_IN_JOB_COUNT } from "@/modules/jobs/services/job-seed";

export const maxDuration = 120;

// GET /api/jobs/seed — how many jobs are baked into the app.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ data: { builtInCount: BUILT_IN_JOB_COUNT } });
}

// POST /api/jobs/seed — load the built-in jobs (inserts any that are missing).
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await seedBuiltInJobs();
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Seed failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
