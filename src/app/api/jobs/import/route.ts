import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import {
  processJobImport,
  JobImportError,
} from "@/modules/jobs/services/job-import";

// Large RMS exports can take a moment to upsert row-by-row.
export const maxDuration = 300;

// POST /api/jobs/import — upload an RMS export and UPSERT it (whitepaper §4.3).
// The file is parsed in-memory; nothing is wiped and no manual data is touched.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const validExtensions = [".xlsx", ".xls", ".csv"];
  const hasValidExt = validExtensions.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );
  if (!hasValidExt) {
    return NextResponse.json(
      { error: "Invalid file type. Upload .xlsx, .xls, or .csv" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processJobImport(
      buffer,
      file.name,
      file.size,
      session.user.id
    );
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof JobImportError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Job import failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
