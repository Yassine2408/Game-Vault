import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { verifyNovaPlan } from "@/lib/nova-server";
import { clientTagFrom, notifyLibraryUpdate } from "@/lib/realtime-server";

const input = z.object({ token: z.string().min(1).max(4000) });

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = input.safeParse(await req.json().catch(() => null));
  const plan = body.success ? await verifyNovaPlan(body.data.token, user.id) : null;
  if (!plan) return Response.json({ error: "This plan is invalid or expired. Ask Nova for a new one." }, { status: 400 });

  const { action } = plan;
  const when = new Date(plan.date + "T12:00:00Z");
  const result = await db.$transaction(async (tx) => {
    const entry = await tx.libraryEntry.findFirst({ where: { id: plan.entryId, userId: user.id } });
    if (!entry) return null;
    const where = { id: entry.id, userId: user.id, updatedAt: new Date(plan.version) };
    if (action.kind === "session") {
      const saved = await tx.playSession.findUnique({ where: { id: plan.jti }, select: { id: true } });
      if (saved) return { entry, changed: false };
      const update = await tx.libraryEntry.updateMany({ where, data: {
        hoursPlayed: { increment: action.minutes / 60 },
        startDate: entry.startDate ?? when,
        status: entry.status === "BACKLOG" || entry.status === "WISHLIST" ? "PLAYING" : entry.status,
      } });
      if (!update.count) return await tx.playSession.findUnique({ where: { id: plan.jti }, select: { id: true } })
        ? { entry, changed: false } : null;
      await tx.playSession.create({ data: {
        id: plan.jti, entryId: entry.id, gameId: entry.gameId, userId: user.id, minutes: action.minutes, playedOn: when,
      } });
      return { entry, changed: true };
    }

    if (entry.status === "COMPLETED" && entry.finishDate?.toISOString() === when.toISOString()
      && (action.rating === undefined || action.rating === entry.rating)) return { entry, changed: false };
    const update = await tx.libraryEntry.updateMany({ where, data: {
      status: "COMPLETED", finishDate: when, rating: action.rating,
    } });
    return update.count ? { entry, changed: true } : null;
  });

  if (!result) return Response.json({ error: "This library entry changed. Ask Nova for a fresh plan." }, { status: 409 });
  if (result.changed) await notifyLibraryUpdate(clientTagFrom(req));
  return Response.json({ ok: true, changed: result.changed });
}
