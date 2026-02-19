import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import { listUsers, createUser } from "@/modules/admin/services/user-manager";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await listUsers();
  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.email || !body.name || !body.password || !body.role) {
    return NextResponse.json(
      { error: "Provide email, name, password, and role" },
      { status: 400 }
    );
  }

  if (!["ADMIN", "MANAGER", "REP"].includes(body.role)) {
    return NextResponse.json(
      { error: "Role must be ADMIN, MANAGER, or REP" },
      { status: 400 }
    );
  }

  try {
    const user = await createUser({
      email: body.email,
      name: body.name,
      password: body.password,
      role: body.role,
      territoryIds: body.territoryIds,
    });

    return NextResponse.json({
      data: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "A user with that email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create user" },
      { status: 500 }
    );
  }
}
