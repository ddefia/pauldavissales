import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import { query, queryOne, execute } from "@/lib/db";

// GET current/active weekly plan
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await queryOne(
    `SELECT * FROM "WeeklyPlan" WHERE status = 'active' ORDER BY "weekStart" DESC LIMIT 1`
  );
  return NextResponse.json({ data: plan });
}

// POST — create a new weekly plan
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const id = `clwk${body.weekNumber}_${Date.now()}`;

  // Mark existing active plans as completed
  await execute(`UPDATE "WeeklyPlan" SET status = 'completed', "updatedAt" = NOW() WHERE status = 'active'`);

  // Create new plan
  await execute(
    `INSERT INTO "WeeklyPlan" (
      id, "weekNumber", "weekStart", label, status,
      "targetCalls", "targetEmails", "targetVoicemails", "targetMeetings", "targetPdfs",
      "actualCalls", "actualEmails", "actualVoicemails", "actualMeetings", "actualPdfs",
      "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, 0, 0, 0, 0, 0, NOW(), NOW())`,
    [
      id,
      body.weekNumber,
      new Date(body.weekStart).toISOString(),
      body.label || `Week ${body.weekNumber} Playbook`,
      body.targetCalls ?? 50,
      body.targetEmails ?? 50,
      body.targetVoicemails ?? 100,
      body.targetMeetings ?? 5,
      body.targetPdfs ?? 50,
    ]
  );

  const plan = await queryOne(`SELECT * FROM "WeeklyPlan" WHERE id = $1`, [id]);
  return NextResponse.json({ data: plan }, { status: 201 });
}

// PATCH — update actuals on the active plan
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  for (const field of ["actualCalls", "actualEmails", "actualVoicemails", "actualMeetings", "actualPdfs", "notes"]) {
    if (body[field] !== undefined) {
      sets.push(`"${field}" = $${idx++}`);
      vals.push(body[field]);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  sets.push(`"updatedAt" = NOW()`);
  await execute(`UPDATE "WeeklyPlan" SET ${sets.join(", ")} WHERE status = 'active'`, vals);

  const plan = await queryOne(`SELECT * FROM "WeeklyPlan" WHERE status = 'active' LIMIT 1`);
  return NextResponse.json({ data: plan });
}
