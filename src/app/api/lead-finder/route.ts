import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import { findLeads, importFoundLead } from "@/modules/lead-finder/services/lead-finder";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Import a specific found lead into the database
  if (body.importLead) {
    try {
      const contactId = await importFoundLead(body.importLead);
      return NextResponse.json({ data: { contactId, imported: true } });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Import failed" },
        { status: 500 }
      );
    }
  }

  // Search for new leads
  if (!body.query) {
    return NextResponse.json(
      { error: "Provide a query describing the type of leads you want" },
      { status: 400 }
    );
  }

  try {
    const result = await findLeads({
      query: body.query,
      territory: body.territory,
      orgType: body.orgType,
      propertyType: body.propertyType,
      limit: body.limit ?? 10,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lead search failed" },
      { status: 500 }
    );
  }
}
