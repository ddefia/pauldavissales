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
    const metadata = pdf.metadata as any;
    const html = metadata?.htmlContent;
    if (html) {
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html" },
      });
    }
    return NextResponse.json(
      { error: "HTML content not available" },
      { status: 404 }
    );
  }

  // Return metadata
  return NextResponse.json({ data: pdf });
}
