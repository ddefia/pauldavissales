import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const batch = await prisma.importBatch.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      _count: {
        select: {
          contacts: true,
          organizations: true,
          properties: true,
          importRows: true,
          importErrors: true,
        },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  return NextResponse.json({ data: batch });
}
