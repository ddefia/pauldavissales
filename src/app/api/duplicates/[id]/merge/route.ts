import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { mergeContacts } from "@/modules/ingest/services/deduplicator";

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
  const { winnerId } = body;

  if (!winnerId) {
    return NextResponse.json({ error: "winnerId is required" }, { status: 400 });
  }

  const group = await prisma.duplicateGroup.findUnique({
    where: { id },
    include: { contacts: { select: { id: true } } },
  });

  if (!group) {
    return NextResponse.json({ error: "Duplicate group not found" }, { status: 404 });
  }

  if (!group.contacts.some((c) => c.id === winnerId)) {
    return NextResponse.json(
      { error: "Winner must be a contact in this duplicate group" },
      { status: 400 }
    );
  }

  await mergeContacts(id, winnerId, session.user.id);

  return NextResponse.json({ success: true });
}
