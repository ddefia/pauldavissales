import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

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

  // Allow dismissing a duplicate group
  if (body.status === "DISMISSED") {
    await prisma.duplicateGroup.update({
      where: { id },
      data: { status: "DISMISSED", resolvedAt: new Date(), mergedById: session.user.id },
    });

    // Unlink contacts from the group
    await prisma.contact.updateMany({
      where: { duplicateGroupId: id },
      data: { duplicateGroupId: null },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid update" }, { status: 400 });
}
