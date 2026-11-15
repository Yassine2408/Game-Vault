import { NextRequest, NextResponse } from "next/server";
import { EntryStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, getSessionGamerName } from "@/lib/auth";
import { entryInclude, toEntryDTO } from "@/lib/dto";
import { notifyActivity, notifyLibraryUpdate, clientTagFrom } from "@/lib/realtime-server";

export const dynamic = "force-dynamic";

const patchInput = z.object({
  status: z.enum(["PLAYING", "COMPLETED", "ON_HOLD", "BACKLOG", "WISHLIST", "DROPPED"]).optional(),
  rating: z.number().int().min(0).max(10).nullable().optional(),
  hoursPlayed: z.number().min(0).max(20000).optional(),
  startDate: z.string().datetime().nullable().optional(),
  finishDate: z.string().datetime().nullable().optional(),
  favorite: z.boolean().optional(),
  notes: z.string().max(3000).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  const d = parsed.data;

  const existing = await db.libraryEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const data: Record<string, unknown> = { ...d };
  if (d.startDate !== undefined) data.startDate = d.startDate ? new Date(d.startDate) : null;
  if (d.finishDate !== undefined) data.finishDate = d.finishDate ? new Date(d.finishDate) : null;
  if (d.status === "COMPLETED" && !existing.finishDate && data.finishDate === undefined && d.finishDate !== null) {
    data.finishDate = new Date();
  }
  if (d.status === "PLAYING" && !existing.startDate && data.startDate === undefined) {
    data.startDate = new Date();
  }

  const entry = await db.libraryEntry.update({ where: { id }, data, include: entryInclude });
  const dto = toEntryDTO(entry);

  // realtime broadcast — activity when the status itself changed
  const clientTag = clientTagFrom(req);
  if (d.status && d.status !== existing.status) {
    const kind = d.status === "COMPLETED" ? "finish" : d.status === "PLAYING" ? "start" : "track";
    const gamer = await getSessionGamerName(user.id);
    await notifyActivity({ gamer, kind, game: dto.game, rating: dto.rating, clientTag });
  }
  await notifyLibraryUpdate(clientTag);

  return NextResponse.json({ entry: dto });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await db.libraryEntry.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  await db.playSession.deleteMany({ where: { entryId: id } });
  await db.libraryEntry.delete({ where: { id } });
  await notifyLibraryUpdate(clientTagFrom(req));
  return NextResponse.json({ ok: true });
}
