import ExcelJS from "exceljs";
import { Readable } from "stream";

// xlsx (SheetJS) has ESM compatibility issues in Next.js — use require()
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  sheetName?: string;
}

export interface ParseOptions {
  maxPreviewRows?: number;
  sheetIndex?: number;
}

/**
 * Detect if a buffer is actually an HTML file (common with .xls exports)
 * Many systems export HTML tables with a .xls extension.
 * These can be UTF-16 or UTF-8 encoded.
 */
function isHtmlFile(buffer: Buffer): boolean {
  // Check for UTF-16 BOM (FF FE) followed by HTML markers
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    // UTF-16 LE — convert first 200 bytes to check
    const snippet = buffer.subarray(0, 400).toString("utf16le").toLowerCase();
    return snippet.includes("<!doctype") || snippet.includes("<html") || snippet.includes("<table");
  }

  // Check for UTF-8 / ASCII HTML
  const snippet = buffer.subarray(0, 200).toString("utf8").toLowerCase();
  return snippet.includes("<!doctype") || snippet.includes("<html") || snippet.includes("<table");
}

/**
 * Convert buffer to UTF-8 string, handling UTF-16 encoding
 */
function bufferToUtf8(buffer: Buffer): string {
  // UTF-16 LE BOM
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le");
  }
  // UTF-16 BE BOM
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    // Swap bytes for LE decoding
    const swapped = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length - 1; i += 2) {
      swapped[i] = buffer[i + 1];
      swapped[i + 1] = buffer[i];
    }
    return swapped.toString("utf16le");
  }
  return buffer.toString("utf8");
}

/**
 * Parse HTML table content (for .xls files that are actually HTML)
 * Handles malformed HTML where <tr> tags may not have closing >,
 * e.g., <tr id='foo'<td>...</td></tr>
 */
function parseHtmlTable(
  buffer: Buffer,
  options: ParseOptions = {}
): ParsedFile {
  const html = bufferToUtf8(buffer);

  // Extract content between <tr...> and </tr>, being lenient with malformed <tr> tags
  // Some exports produce <tr id='x'<td> (missing closing >) so we match from <tr to </tr>
  const trRegex = /<tr[\s\S]*?<\/tr>/gi;
  const tdRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;

  const allRows: string[][] = [];
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[0]; // full match including <tr> and </tr>
    const cells: string[] = [];
    let tdMatch;

    // Reset regex for each row
    tdRegex.lastIndex = 0;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      // Strip HTML tags and decode entities
      const cellText = tdMatch[1]
        .replace(/<[^>]*>/g, "") // strip tags
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&#\d+;/g, "")
        .trim();
      cells.push(cellText);
    }

    if (cells.length > 0) {
      allRows.push(cells);
    }
  }

  if (allRows.length === 0) {
    throw new Error("No table data found in HTML file");
  }

  // First row is headers
  const headers = allRows[0].map((h) => h.trim()).filter(Boolean);
  const headerCount = headers.length;

  const maxRows = options.maxPreviewRows ?? Infinity;
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < allRows.length && rows.length < maxRows; i++) {
    const rowArray = allRows[i];
    const rowData: Record<string, string> = {};

    // Pad short rows to match header count
    headers.forEach((header, colIdx) => {
      rowData[header] = String(rowArray[colIdx] ?? "").trim();
    });

    // Only include rows with at least one non-empty value
    if (Object.values(rowData).some((v) => v !== "")) {
      rows.push(rowData);
    }
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
    sheetName: "Sheet1",
  };
}

export async function parseFile(
  buffer: Buffer,
  fileName: string,
  options: ParseOptions = {}
): Promise<ParsedFile> {
  const lower = fileName.toLowerCase();
  const isCSV = lower.endsWith(".csv");
  const isXLS = lower.endsWith(".xls") && !lower.endsWith(".xlsx");

  // Check if this is actually an HTML file disguised as .xls
  if (isHtmlFile(buffer)) {
    return parseHtmlTable(buffer, options);
  }

  // Use SheetJS for .xls files (old Excel binary format)
  if (isXLS) {
    return parseWithSheetJS(buffer, options);
  }

  // Use ExcelJS for .xlsx and .csv, with SheetJS fallback
  const workbook = new ExcelJS.Workbook();

  if (isCSV) {
    const stream = Readable.from(buffer);
    await workbook.csv.read(stream);
  } else {
    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      // ExcelJS failed — fall back to SheetJS (handles more formats)
      return parseWithSheetJS(buffer, options);
    }
  }

  const worksheet = workbook.worksheets[options.sheetIndex ?? 0];
  if (!worksheet) throw new Error("No worksheet found in file");

  const headers: string[] = [];
  const firstRow = worksheet.getRow(1);
  firstRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  const maxRows = options.maxPreviewRows ?? Infinity;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rows.length >= maxRows) return;

    const rowData: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        let value = cell.value;
        if (value instanceof Date) {
          value = value.toISOString();
        } else if (typeof value === "object" && value !== null) {
          // Handle rich text, hyperlinks, etc.
          value = (value as any).text ?? (value as any).result ?? String(value);
        }
        rowData[header] = String(value ?? "").trim();
      }
    });

    if (Object.values(rowData).some((v) => v !== "")) {
      rows.push(rowData);
    }
  });

  return {
    headers: headers.filter(Boolean),
    rows,
    totalRows: rows.length,
    sheetName: worksheet.name,
  };
}

/**
 * Parse .xls (legacy Excel) files using SheetJS
 */
function parseWithSheetJS(
  buffer: Buffer,
  options: ParseOptions = {}
): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetIndex = options.sheetIndex ?? 0;
  const sheetName = workbook.SheetNames[sheetIndex];

  if (!sheetName) throw new Error("No worksheet found in file");

  const worksheet = workbook.Sheets[sheetName];
  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
  });

  if (jsonData.length === 0) throw new Error("File is empty");

  // First row is headers
  const headers = (jsonData[0] as any[]).map((h) => String(h ?? "").trim()).filter(Boolean);

  const maxRows = options.maxPreviewRows ?? Infinity;
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < jsonData.length && rows.length < maxRows; i++) {
    const rowArray = jsonData[i] as any[];
    const rowData: Record<string, string> = {};

    headers.forEach((header, colIdx) => {
      let value = rowArray[colIdx];
      if (value instanceof Date) {
        value = value.toISOString();
      }
      rowData[header] = String(value ?? "").trim();
    });

    if (Object.values(rowData).some((v) => v !== "")) {
      rows.push(rowData);
    }
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
    sheetName,
  };
}
