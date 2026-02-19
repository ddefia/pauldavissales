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
    include: {
      organization: true,
      territory: true,
      validationResults: { orderBy: { checkedAt: "desc" } },
      properties: {
        include: { property: true },
      },
      importBatch: {
        select: { id: true, fileName: true, source: true, createdAt: true },
      },
      duplicateGroup: {
        include: {
          contacts: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
      },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({ data: contact });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const allowedFields = [
    "firstName", "lastName", "prefix", "suffix", "title", "department",
    "email", "emailSecondary", "phone", "phoneSecondary", "phoneMobile",
    "addressLine1", "addressLine2", "city", "state", "zipCode", "county",
    "status",
  ];

  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (updates.firstName || updates.lastName) {
    const contact = await prisma.contact.findUnique({ where: { id } });
    if (contact) {
      updates.fullName = `${updates.firstName ?? contact.firstName} ${updates.lastName ?? contact.lastName}`;
    }
  }

  const updated = await prisma.contact.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({ data: updated });
}
