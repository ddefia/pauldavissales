import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { serializeJob, JOB_RELATION_INCLUDE } from "@/modules/jobs/services/job-serialize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      ...JOB_RELATION_INCLUDE,
      revisions: { orderBy: { changedAt: "desc" } },
    },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { ...serializeJob(job), revisions: job.revisions } });
}

// PATCH — edit MANUAL (Layer B) fields only. Locked fields create a logged
// revision (who/when/old→new) rather than silently overwriting (whitepaper §4.4).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  const revisions: {
    jobId: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    changedById: string | null;
  }[] = [];

  const logChange = (field: string, oldVal: unknown, newVal: unknown) => {
    revisions.push({
      jobId: id,
      field,
      oldValue: oldVal == null ? null : String(oldVal),
      newValue: newVal == null ? null : String(newVal),
      changedById: session.user.id ?? null,
    });
  };

  // ── Locked, revision-logged fields ──
  if (body.targetMargin !== undefined) {
    const next = body.targetMargin === null ? null : Number(body.targetMargin);
    if (next !== job.targetMargin) {
      logChange("targetMargin", job.targetMargin, next);
      data.targetMargin = next;
    }
  }
  if (body.targetMarginUnit !== undefined) {
    data.targetMarginUnit = body.targetMarginUnit;
  }
  if (body.targetCompletionDate !== undefined) {
    const next = body.targetCompletionDate
      ? new Date(body.targetCompletionDate)
      : null;
    const prevIso = job.targetCompletionDate?.toISOString() ?? null;
    const nextIso = next?.toISOString() ?? null;
    if (prevIso !== nextIso) {
      logChange("targetCompletionDate", prevIso, nextIso);
      data.targetCompletionDate = next;
    }
  }
  if (body.committedEstimate !== undefined) {
    const next =
      body.committedEstimate === null ? null : Number(body.committedEstimate);
    if (next !== job.committedEstimate) {
      logChange("committedEstimate", job.committedEstimate, next);
      data.committedEstimate = next;
      if (next != null && job.committedEstimateAt == null) {
        data.committedEstimateAt = new Date();
      }
    }
  }

  // ── Strike-out / reopen (soft state, never a hard delete — OD-3) ──
  if (body.struckOut !== undefined) {
    data.struckOut = !!body.struckOut;
    data.struckOutAt = body.struckOut ? new Date() : null;
  }
  if (body.reopen === true) {
    data.struckOut = false;
    data.struckOutAt = null;
    data.closedFromExport = false;
    data.closedFromExportAt = null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  if (revisions.length > 0) {
    await prisma.jobFieldRevision.createMany({ data: revisions });
  }

  const updated = await prisma.job.update({
    where: { id },
    data,
    include: JOB_RELATION_INCLUDE,
  });

  return NextResponse.json({ data: serializeJob(updated) });
}
