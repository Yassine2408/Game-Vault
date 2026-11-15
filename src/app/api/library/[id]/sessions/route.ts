import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, getSessionGamerName } from "@/lib/auth";
import { entryInclude, toEntryDTO } from "@/lib/dto";
import { notifyActivity, notifyLibraryUpdate, clientTagFrom } from "@/lib/realtime-server";

export const dynamic = "force-dynamic";

const sessionInput = z.object({
  minutes: z.number().int().min(1).max(1440),
  playedOn: z.string().datetime().optional(),
  note: z.string().max(300).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = sessionInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  const { minutes, playedOn, note } = parsed.data;

  const entry = await db.libraryEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== user.id) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const when = playedOn ? new Date(playedOn) : new Date();

  await db.playSession.create({
    data: { userId: user.id, gameId: entry.gameId, entryId: entry.id, minutes, playedOn: when, note: note ?? null },
  });

  const updated = await db.libraryEntry.update({
    where: { id },
    data: {
      hoursPlayed: { increment: minutes / 60 },
      startDate: entry.startDate ?? when,
      status: entry.status === "BACKLOG" || entry.status === "WISHLIST" ? "PLAYING" : entry.status,
    },
    include: entryInclude,
  });
  const dto = toEntryDTO(updated);

  // realtime broadcast
  const clientTag = clientTagFrom(req);
  const gamer = await getSessionGamerName(user.id);
  await Promise.all([
    notifyActivity({ gamer, kind: "session", game: dto.game, minutes, clientTag }),
    notifyLibraryUpdate(clientTag),
  ]);

  return NextResponse.json({ entry: dto }, { status: 201 });
}
