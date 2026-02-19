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

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      territory: true,
      contacts: {
        include: {
          contact: {
            select: {
              id: true, fullName: true, title: true, email: true,
              phone: true, status: true,
            },
          },
        },
      },
      organizations: {
        include: {
          organization: {
            select: { id: true, name: true, orgType: true, phone: true },
          },
        },
      },
    },
  });

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json({ data: property });
}
