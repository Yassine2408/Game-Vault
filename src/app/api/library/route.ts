import { NextRequest, NextResponse } from "next/server";
import { EntryStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, getSessionGamerName } from "@/lib/auth";
import { entryInclude, toEntryDTO } from "@/lib/dto";
import { notifyActivity, notifyLibraryUpdate, clientTagFrom } from "@/lib/realtime-server";

export const dynamic = "force-dynamic";

const entryInput = z.object({
  gameId: z.string().min(1),
  status: z.enum(["PLAYING", "COMPLETED", "ON_HOLD", "BACKLOG", "WISHLIST", "DROPPED"]),
  rating: z.number().int().min(0).max(10).nullable().optional(),
  hoursPlayed: z.number().min(0).max(20000).optional(),
  startDate: z.string().datetime().nullable().optional(),
  finishDate: z.string().datetime().nullable().optional(),
  favorite: z.boolean().optional(),
  notes: z.string().max(3000).nullable().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const entries = await db.libraryEntry.findMany({
    where: { userId: user.id },
    include: entryInclude,
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ items: entries.map(toEntryDTO) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = entryInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  const d = parsed.data;

  const now = new Date();
  const data = {
    status: d.status as EntryStatus,
    rating: d.rating ?? null,
    hoursPlayed: d.hoursPlayed ?? 0,
    startDate: d.startDate ? new Date(d.startDate) : d.status === "PLAYING" ? now : null,
    finishDate: d.finishDate ? new Date(d.finishDate) : d.status === "COMPLETED" ? now : null,
    favorite: d.favorite ?? false,
    notes: d.notes ?? null,
  };

  const entry = await db.libraryEntry.upsert({
    where: { userId_gameId: { userId: user.id, gameId: d.gameId } },
    update: data,
    create: { userId: user.id, gameId: d.gameId, ...data },
    include: entryInclude,
  });
  const dto = toEntryDTO(entry);

  // realtime broadcast — attribute the action to the signed-in gamer
  const clientTag = clientTagFrom(req);
  const kind = d.status === "PLAYING" ? "start" : d.status === "COMPLETED" ? "finish" : "track";
  const gamer = await getSessionGamerName(user.id);
  await Promise.all([
    notifyActivity({ gamer, kind, game: dto.game, rating: dto.rating, clientTag }),
    notifyLibraryUpdate(clientTag),
  ]);

  return NextResponse.json({ entry: dto }, { status: 201 });
}
