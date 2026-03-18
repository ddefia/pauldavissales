import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";

// City → [lat, lng] lookup for South Florida
const CITY_COORDS: Record<string, [number, number]> = {
  "West Palm Beach": [26.7153, -80.0534],
  "Palm Beach": [26.7056, -80.0364],
  "Palm Beach Gardens": [26.8234, -80.1387],
  "Jupiter": [26.9342, -80.0942],
  "Tequesta": [26.9687, -80.1081],
  "Juno Beach": [26.8798, -80.0534],
  "Lake Worth": [26.6168, -80.0571],
  "Lake Worth Beach": [26.6168, -80.0571],
  "Boynton Beach": [26.5254, -80.0662],
  "Delray Beach": [26.4615, -80.0728],
  "Boca Raton": [26.3683, -80.1289],
  "Lantana": [26.5868, -80.052],
  "Riviera Beach": [26.7754, -80.0581],
  "Royal Palm Beach": [26.7084, -80.2306],
  "Wellington": [26.6618, -80.2414],
  "Greenacres": [26.6276, -80.1353],
  "Stuart": [27.1975, -80.2531],
  "Palm City": [27.167, -80.2664],
  "Jensen Beach": [27.2544, -80.2292],
  "Hobe Sound": [27.0595, -80.1363],
  "Port St. Lucie": [27.273, -80.3582],
  "Port Saint Lucie": [27.273, -80.3582],
  "Fort Pierce": [27.4467, -80.3256],
  "Tradition": [27.2534, -80.3954],
  "Vero Beach": [27.6386, -80.3973],
  "Sebastian": [27.8164, -80.4708],
  "Indian River Shores": [27.7175, -80.3789],
  "North Palm Beach": [26.8176, -80.0819],
  "Hypoluxo": [26.5568, -80.0498],
  "Ocean Ridge": [26.5268, -80.0487],
  "Manalapan": [26.5768, -80.0409],
  "Gulf Stream": [26.4868, -80.0454],
  "Highland Beach": [26.3968, -80.0654],
  "Hutchinson Island": [27.33, -80.22],
  "Singer Island": [26.7878, -80.0351],
  "Loxahatchee": [26.7484, -80.2806],
  "Belle Glade": [26.6848, -80.6676],
  "Pahokee": [26.8208, -80.6651],
  "Indiantown": [27.0268, -80.4856],
};

/**
 * GET /api/contacts/map — Returns contacts grouped by city with coordinates
 * for map display. Includes org info and counts.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const territory = searchParams.get("territory") || "";

  const where: any = {
    isGoldenRecord: true,
    lastName: { not: "" },
  };

  if (territory) {
    where.territory = { name: territory };
  }

  // Get contacts with city info
  const contacts = await prisma.contact.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      title: true,
      email: true,
      city: true,
      status: true,
      compositeScore: true,
      organization: { select: { id: true, name: true, orgType: true } },
      territory: { select: { name: true } },
    },
  });

  // Group by city
  const cityGroups: Record<
    string,
    {
      city: string;
      lat: number;
      lng: number;
      territory: string;
      contactCount: number;
      orgCount: number;
      avgScore: number | null;
      contacts: {
        id: string;
        fullName: string;
        title: string | null;
        email: string | null;
        orgName: string | null;
        orgType: string | null;
        score: number | null;
      }[];
      orgs: { id: string; name: string; orgType: string | null }[];
    }
  > = {};

  contacts.forEach((c) => {
    if (!c.city) return;
    const cityKey = c.city.trim();
    const coords = CITY_COORDS[cityKey];
    if (!coords) return;

    if (!cityGroups[cityKey]) {
      cityGroups[cityKey] = {
        city: cityKey,
        lat: coords[0],
        lng: coords[1],
        territory: c.territory?.name || "Unknown",
        contactCount: 0,
        orgCount: 0,
        avgScore: null,
        contacts: [],
        orgs: [],
      };
    }

    const group = cityGroups[cityKey];
    group.contactCount++;
    group.contacts.push({
      id: c.id,
      fullName: c.fullName,
      title: c.title,
      email: c.email,
      orgName: c.organization?.name || null,
      orgType: c.organization?.orgType || null,
      score: c.compositeScore,
    });

    // Track unique orgs
    if (c.organization && !group.orgs.find((o) => o.id === c.organization!.id)) {
      group.orgs.push({
        id: c.organization.id,
        name: c.organization.name,
        orgType: c.organization.orgType,
      });
    }
  });

  // Calculate avg scores and org counts
  Object.values(cityGroups).forEach((g) => {
    g.orgCount = g.orgs.length;
    const scored = g.contacts.filter((c) => c.score != null);
    if (scored.length > 0) {
      g.avgScore = Math.round(
        scored.reduce((sum, c) => sum + (c.score || 0), 0) / scored.length
      );
    }
    // Limit contacts in response to top 10 per city (for popup display)
    if (g.contacts.length > 10) {
      g.contacts = g.contacts
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 10);
    }
  });

  const cities = Object.values(cityGroups).sort(
    (a, b) => b.contactCount - a.contactCount
  );

  return NextResponse.json({
    data: {
      cities,
      totalContacts: contacts.length,
      totalCities: cities.length,
    },
  });
}
