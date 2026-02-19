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
  const status = sp.get("status");
  const search = sp.get("search");
  const territoryId = sp.get("territoryId");
  const goldenOnly = sp.get("goldenOnly") !== "false";

  const where: any = {};
  if (goldenOnly) where.isGoldenRecord = true;
  if (status) where.status = status;
  if (territoryId) where.territoryId = territoryId;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
      { organization: { name: { contains: search, mode: "insensitive" } } },
      { city: { contains: search, mode: "insensitive" } },
    ];
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        organization: { select: { id: true, name: true, orgType: true } },
        territory: { select: { id: true, name: true } },
        _count: { select: { validationResults: true, properties: true } },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({
    data: contacts,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
