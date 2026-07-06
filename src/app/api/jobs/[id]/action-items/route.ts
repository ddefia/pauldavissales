import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

// POST /api/jobs/[id]/action-items — add an action item to a job (the inline
// "+" on the Open Jobs row).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();
  const text = (body.text ?? "").trim();

  if (!text) {
    return NextResponse.json({ error: "Action item text is required" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id }, select: { id: true } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const item = await prisma.jobActionItem.create({
    data: { jobId: id, text, createdById: session.user.id ?? null },
  });

  return NextResponse.json({ data: item }, { status: 201 });
}
