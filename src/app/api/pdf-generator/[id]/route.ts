import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const pdf = await prisma.generatedPdf.findUnique({
    where: { id },
    include: {
      property: {
        select: { name: true, city: true, state: true },
      },
    },
  });

  if (!pdf) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  // Return the HTML content for rendering/printing
  if (format === "html") {
    try {
      const filePath = join(process.cwd(), pdf.filePath);
      const html = await readFile(filePath, "utf-8");
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html" },
      });
    } catch {
      return NextResponse.json(
        { error: "HTML file not found on disk" },
        { status: 404 }
      );
    }
  }

  // Return metadata
  return NextResponse.json({ data: pdf });
}
