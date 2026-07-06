import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

// PATCH /api/jobs/action-items/[id] — edit text or toggle open/done.
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

  const data: Record<string, unknown> = {};
  if (typeof body.text === "string") {
    const text = body.text.trim();
    if (!text) {
      return NextResponse.json({ error: "Text cannot be empty" }, { status: 400 });
    }
    data.text = text;
  }
  if (body.status !== undefined) {
    const status = body.status === "done" ? "done" : "open";
    data.status = status;
    data.completedAt = status === "done" ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const item = await prisma.jobActionItem.update({ where: { id }, data });
  return NextResponse.json({ data: item });
}

// DELETE /api/jobs/action-items/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.jobActionItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
