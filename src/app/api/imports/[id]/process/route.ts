import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { processImport } from "@/modules/ingest/services/import-processor";

// Allow long processing time for large files (10 minutes)
export const maxDuration = 600;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  if (batch.status !== "MAPPING_COMPLETE") {
    return NextResponse.json(
      { error: `Cannot process import with status: ${batch.status}` },
      { status: 400 }
    );
  }

  // Run processing (this could be moved to a background job for very large files)
  try {
    await processImport(id);
    const updated = await prisma.importBatch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            contacts: true,
            organizations: true,
            properties: true,
            importErrors: true,
          },
        },
      },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}
