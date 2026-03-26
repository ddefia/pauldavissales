import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import {
  generateProspectPdf,
  listGeneratedPdfs,
} from "@/modules/pdf-generator/services/pdf-generator";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.contactId || !body.propertyId) {
    return NextResponse.json(
      { error: "Provide contactId and propertyId" },
      { status: 400 }
    );
  }

  try {
    const result = await generateProspectPdf(body.contactId, body.propertyId);
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId") ?? undefined;
  const contactId = searchParams.get("contactId") ?? undefined;

  const pdfs = await listGeneratedPdfs({ propertyId, contactId });
  return NextResponse.json({ data: pdfs });
}
