import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { gameInclude, toGameDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() || "";
  const genre = sp.get("genre") || "";
  const platform = sp.get("platform") || "";
  const lib = sp.get("lib") || ""; // "in" | "out" | ""
  const sort = sp.get("sort") || "critic";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const pageSize = Math.min(60, Math.max(6, parseInt(sp.get("pageSize") || "24", 10)));

  const where: Record<string, unknown> = {};
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" as const } }, { developer: { contains: q, mode: "insensitive" as const } }];
  if (genre) where.genres = { some: { genre: { name: genre } } };
  if (platform) where.platforms = { some: { platform: { name: platform } } };
  // "in/out of my vault" is per-user; the catalog itself is global
  const user = await getSessionUser();
  if (lib === "in") where.entries = { some: { userId: user?.id ?? "-" } };
  if (lib === "out") where.entries = user ? { none: { userId: user.id } } : {};

  const orderBy =
    sort === "name"
      ? { name: "asc" as const }
      : sort === "release"
        ? { releaseDate: { sort: "desc" as const, nulls: "last" as const } }
        : sort === "recent"
          ? { createdAt: "desc" as const }
          : { criticScore: { sort: "desc" as const, nulls: "last" as const } };

  const [rows, total] = await Promise.all([
    db.game.findMany({ where, orderBy, include: gameInclude, skip: (page - 1) * pageSize, take: pageSize }),
    db.game.count({ where }),
  ]);

  return NextResponse.json({ items: rows.map((g) => toGameDTO(g, user?.id)), total, page, pageSize });
}
