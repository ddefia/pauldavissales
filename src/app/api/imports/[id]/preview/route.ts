import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { parseFile } from "@/modules/ingest/services/file-parser";
import { autoDetectMapping } from "@/modules/ingest/services/column-mapper";
import { readFile } from "fs/promises";

export async function POST(
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
  });

  if (!batch) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  try {
    const fileBuffer = await readFile(batch.filePath);
    const parsed = await parseFile(fileBuffer, batch.fileName, {
      maxPreviewRows: 5,
    });

    const suggestedMapping = autoDetectMapping(parsed.headers, parsed.rows);

    // Update batch with detected columns
    await prisma.importBatch.update({
      where: { id },
      data: {
        status: "AWAITING_MAPPING",
        detectedColumns: parsed.headers,
        totalRows: parsed.totalRows,
        parsingStartedAt: new Date(),
      },
    });

    return NextResponse.json({
      headers: parsed.headers,
      sampleRows: parsed.rows,
      totalRows: parsed.totalRows,
      suggestedMapping,
      sheetName: parsed.sheetName,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file" },
      { status: 400 }
    );
  }
}
