import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";

// Allow large file uploads (100MB)
export const maxDuration = 300; // 5 minutes for large files

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

  const [batches, total] = await Promise.all([
    prisma.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { uploadedBy: { select: { name: true, email: true } } },
    }),
    prisma.importBatch.count(),
  ]);

  return NextResponse.json({
    data: batches,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const source = formData.get("source") as string;
  const sourceLabel = (formData.get("sourceLabel") as string) || null;

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

  if (!["ALN_DATA", "LUXOR", "MANUAL"].includes(source)) {
    return NextResponse.json(
      { error: "Invalid source. Must be ALN_DATA, LUXOR, or MANUAL" },
      { status: 400 }
    );
  }

  // Store file
  const uploadDir = join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });
  const fileId = nanoid();
  const ext = file.name.substring(file.name.lastIndexOf("."));
  const storedName = `${fileId}${ext}`;
  const filePath = join(uploadDir, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const batch = await prisma.importBatch.create({
    data: {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      filePath,
      source: source as any,
      sourceLabel,
      status: "UPLOADED",
      uploadedById: session.user.id,
    },
  });

  return NextResponse.json({ data: batch }, { status: 201 });
}
