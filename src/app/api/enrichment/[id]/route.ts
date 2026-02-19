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

  const contact = await prisma.contact.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      title: true,
      email: true,
      status: true,
      enrichmentBrief: true,
      painTriggers: true,
      personalizationHooks: true,
      lastEnrichedAt: true,
      organization: { select: { name: true, orgType: true } },
      properties: {
        include: {
          property: {
            select: {
              name: true,
              propertyType: true,
              city: true,
              unitCount: true,
            },
          },
        },
      },
      territory: { select: { name: true } },
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  let parsedBrief = null;
  if (contact.enrichmentBrief) {
    try {
      parsedBrief = JSON.parse(contact.enrichmentBrief);
    } catch {
      parsedBrief = contact.enrichmentBrief;
    }
  }

  return NextResponse.json({
    data: {
      ...contact,
      enrichmentBrief: parsedBrief,
    },
  });
}
