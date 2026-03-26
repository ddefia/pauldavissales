import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  mapApolloColumns,
  importApolloEnrichment,
} from "@/modules/enrichment/services/apollo-csv-importer";

// Use dynamic import for xlsx to avoid ESM issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "File must be CSV or XLSX" },
        { status: 400 }
      );
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse CSV/XLSX → rows
    let rawRows: Record<string, string>[];

    if (fileName.endsWith(".csv")) {
      const text = buffer.toString("utf-8");
      const workbook = XLSX.read(text, { type: "string" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } else {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    }

    if (!rawRows.length) {
      return NextResponse.json(
        { error: "File is empty or could not be parsed" },
        { status: 400 }
      );
    }

    // Check for required Apollo columns
    const headers = Object.keys(rawRows[0]);
    const requiredColumns = ["Email", "First Name", "Last Name"];
    const missingColumns = requiredColumns.filter(
      (col) => !headers.includes(col)
    );
    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required Apollo columns: ${missingColumns.join(", ")}`,
          hint: "Make sure this is an Apollo contacts export CSV",
        },
        { status: 400 }
      );
    }

    // Map Apollo columns → our fields
    const apolloRows = mapApolloColumns(rawRows);

    // Run the enrichment import
    const result = await importApolloEnrichment(apolloRows);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Apollo Import API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
