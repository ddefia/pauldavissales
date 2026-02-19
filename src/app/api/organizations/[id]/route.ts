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

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      contacts: {
        where: { isGoldenRecord: true },
        select: {
          id: true, fullName: true, title: true, email: true, phone: true,
          status: true, dataQualityScore: true,
        },
      },
      managedProperties: {
        include: {
          property: {
            select: {
              id: true, name: true, propertyType: true, city: true,
              state: true, zipCode: true, unitCount: true,
            },
          },
        },
      },
    },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({ data: org });
}
