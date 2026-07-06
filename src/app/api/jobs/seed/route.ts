import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import {
  seedBuiltInJobs,
  removeJobsOutsideBuiltIn,
  BUILT_IN_JOB_COUNT,
} from "@/modules/jobs/services/job-seed";

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

// DELETE /api/jobs/seed — make the built-in dataset the only data: remove jobs
// whose job number is NOT in it (e.g. old test uploads), then load any missing
// built-in jobs. Explicit, user-confirmed action.
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const removed = await removeJobsOutsideBuiltIn();
    const seeded = await seedBuiltInJobs();
    return NextResponse.json({ data: { removed, inserted: seeded.inserted } });
  } catch (err) {
    console.error("Reset failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      { status: 500 }
    );
  }
}
