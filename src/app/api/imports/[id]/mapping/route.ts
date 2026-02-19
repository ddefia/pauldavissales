import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

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
  const { mapping } = body;

  if (!mapping || typeof mapping !== "object") {
    return NextResponse.json(
      { error: "Invalid mapping format" },
      { status: 400 }
    );
  }

  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  await prisma.importBatch.update({
    where: { id },
    data: {
      columnMapping: mapping,
      status: "MAPPING_COMPLETE",
    },
  });

  return NextResponse.json({ success: true });
}
