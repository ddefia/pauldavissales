import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";
import prisma from "@/lib/prisma";
import { generateTalkTrack } from "@/modules/talk-tracks/services/talk-track-generator";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.contactId) {
    return NextResponse.json(
      { error: "Provide contactId" },
      { status: 400 }
    );
  }

  try {
    const talkTrack = await generateTalkTrack(body.contactId);
    return NextResponse.json({ data: talkTrack });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Talk track generation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId");

  if (contactId) {
    // Get talk track for a specific contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { talkTrackId: true },
    });

    if (!contact?.talkTrackId) {
      return NextResponse.json({ data: null });
    }

    const talkTrack = await prisma.talkTrack.findUnique({
      where: { id: contact.talkTrackId },
      select: {
        id: true,
        name: true,
        content: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: talkTrack });
  }

  // List recent talk tracks
  const talkTracks = await prisma.talkTrack.findMany({
    where: { category: "personalized", isActive: true },
    select: {
      id: true,
      name: true,
      segment: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: talkTracks });
}
