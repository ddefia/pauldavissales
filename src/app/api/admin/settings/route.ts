import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import { getSystemStats } from "@/modules/admin/services/user-manager";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [stats, territories] = await Promise.all([
    getSystemStats(),
    prisma.territory.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        zipCodes: true,
        counties: true,
        _count: { select: { contacts: true, properties: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    data: {
      stats,
      territories,
    },
  });
}
