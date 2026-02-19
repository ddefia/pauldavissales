import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const page = parseInt(sp.get("page") ?? "1");
  const pageSize = parseInt(sp.get("pageSize") ?? "25");
  const search = sp.get("search");
  const territoryId = sp.get("territoryId");
  const propertyType = sp.get("propertyType");

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { addressLine1: { contains: search, mode: "insensitive" } },
    ];
  }
  if (territoryId) where.territoryId = territoryId;
  if (propertyType) where.propertyType = propertyType;

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        territory: { select: { id: true, name: true } },
        _count: { select: { contacts: true, organizations: true } },
      },
    }),
    prisma.property.count({ where }),
  ]);

  return NextResponse.json({
    data: properties,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
