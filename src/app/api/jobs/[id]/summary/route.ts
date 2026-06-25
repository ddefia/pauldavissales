import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import { generateJobSummary } from "@/modules/jobs/services/job-summary";

export const maxDuration = 60;

// POST /api/jobs/[id]/summary — generate (and cache) an AI summary of the job.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const summary = await generateJobSummary(id);
    return NextResponse.json({ data: { summary } });
  } catch (err) {
    console.error("Job summary failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Summary failed" },
      { status: 500 }
    );
  }
}
