"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  X,
  Gamepad2,
  Play,
  Pause,
  Plus,
  Trash2,
  Timer,
  Star,
  CalendarDays,
  Clock,
  CheckCircle2,
  Pencil,
  ExternalLink,
  ImageOff,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUI } from "@/lib/store";
import { api, type EntryDTO } from "@/lib/client";
import { STATUS_CONFIG } from "@/lib/status";
import { GamePoster } from "./GamePoster";
import { CriticScore, RatingStars, StatusBadge } from "./Bits";
import { cn } from "@/lib/utils";
import { EntryStatus } from "@prisma/client";

export function DetailDialog({ library }: { library: EntryDTO[] }) {
  const { detailGame, closeDetail, openTrack, openQuickLog } = useUI();
  const qc = useQueryClient();
  const [hero, setHero] = useState<string | null>(null);

  const game = detailGame;
  const entry = useMemo(() => library.find((e) => e.game.id === game?.id) ?? null, [library, game]);
  const shots = game?.screenshots ?? [];
  const backdrop = hero ?? game?.heroUrl ?? game?.coverUrl ?? shots[0] ?? null;

  const remove = useMutation({
    mutationFn: () => api.deleteEntry(entry!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["facets"] });
      qc.invalidateQueries({ queryKey: ["games"] });
      toast.success(`${game?.name} removed from your library`);
      closeDetail();
    },
    onError: (err: Error) => toast.error("Couldn't remove", { description: err.message }),
  });

  const quickAdd = useMutation({
    mutationFn: async (status: EntryStatus) => {
      const res = entry
        ? await api.updateEntry(entry.id, { status, finishDate: status === "COMPLETED" ? new Date().toISOString() : undefined })
        : await api.track({ gameId: game!.id, status, finishDate: status === "COMPLETED" ? new Date().toISOString() : null });
      return { ...res, status };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["facets"] });
      qc.invalidateQueries({ queryKey: ["games"] });
      toast.success(`${game!.name} — moved to ${STATUS_CONFIG[res.status].label}`);
      closeDetail();
    },
    onError: (err: Error) => toast.error("Couldn't update", { description: err.message }),
  });

  if (!game) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && closeDetail()}>
      <DialogContent className="max-h-[94vh] gap-0 overflow-hidden border-border bg-popover/95 p-0 sm:max-w-3xl">
        <div className="relative">
          {/* hero backdrop */}
          <div className="relative h-44 w-full overflow-hidden sm:h-56">
            {backdrop ? (
              <img src={backdrop} alt={`${game.name} artwork`} className="h-full w-full object-cover" />
            ) : (
              <GamePoster src={null} name={game.name} wide className="h-full w-full" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-popover via-popover/40 to-transparent" />
          </div>
          <DialogHeader className="absolute inset-x-0 bottom-0 z-10 space-y-0 px-5 pb-1 sm:px-7">
            <DialogDescription asChild>
              <div className="flex items-center gap-2">
                <CriticScore score={game.criticScore} />
                {game.releaseDate && (
                  <span className="text-xs font-medium text-white/70">
                    Released {format(new Date(game.releaseDate), "MMM d, yyyy")}
                  </span>
                )}
                {entry && <StatusBadge status={entry.status} />}
              </div>
            </DialogDescription>
            <DialogTitle className="font-display text-2xl font-bold tracking-tight text-white drop-shadow-md">
              {game.name}
            </DialogTitle>
          </DialogHeader>
          <button
            onClick={closeDetail}
            className="absolute right-4 top-4 z-20 rounded-full bg-black/40 p-1.5 text-white/80 backdrop-blur transition hover:bg-black/60 hover:text-white"
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[62vh] space-y-5 overflow-y-auto px-5 pb-6 sm:px-7">
          <div className="flex gap-4">
            <GamePoster
              src={game.posterUrl}
              name={game.name}
              className="mt-[-28px] h-36 w-24 shrink-0 rounded-xl border border-border/60 shadow-2xl"
            />
            <div className="min-w-0 flex-1 space-y-2.5 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {game.genres.slice(0, 5).map((g) => (
                  <Badge key={g.slug} variant="secondary" className="rounded-full bg-primary/15 text-[11px] font-medium text-primary">
                    {g.name}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {game.developer && (
                  <span>
                    Developed by <span className="font-semibold text-foreground/80">{game.developer}</span>
                    {game.publisher && game.publisher !== game.developer ? ` · Published by ${game.publisher}` : ""}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {game.platforms.map((p) => (
                  <span key={p.slug} className="rounded-md bg-muted px-1.5 py-0.5 font-medium">
                    {p.name}
                  </span>
                ))}
                {game.tags.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-md bg-muted/60 px-1.5 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {game.summary && <p className="text-sm leading-relaxed text-muted-foreground">{game.summary}</p>}

          {shots.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Screenshots</p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {shots.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setHero(s)}
                    className={cn(
                      "relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border transition-all hover:ring-2 hover:ring-primary/60",
                      backdrop === s ? "border-primary/70 ring-2 ring-primary/50" : "border-border/50"
                    )}
                  >
                    <img src={s} alt={`${game.name} screenshot ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* library entry panel */}
          {entry ? (
            <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Gamepad2 className="h-4 w-4 text-primary" /> In your library
                </p>
                <StatusBadge status={entry.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="rounded-xl bg-muted/40 px-3 py-2">
                  <p className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3 w-3" /> Started</p>
                  <p className="mt-0.5 font-semibold">{entry.startDate ? format(new Date(entry.startDate), "MMM d, yyyy") : "—"}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2">
                  <p className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> Finished</p>
                  <p className="mt-0.5 font-semibold">{entry.finishDate ? format(new Date(entry.finishDate), "MMM d, yyyy") : "—"}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2">
                  <p className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> Playtime</p>
                  <p className="mt-0.5 font-semibold">{entry.hoursPlayed ? `${Math.round(entry.hoursPlayed * 10) / 10}h` : "—"}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2">
                  <p className="flex items-center gap-1 text-muted-foreground"><Star className="h-3 w-3" /> Score</p>
                  <p className="mt-0.5 font-semibold">{entry.rating != null ? `${entry.rating}/10` : "Not rated"}</p>
                </div>
              </div>
              {entry.notes && (
                <p className="mt-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs italic leading-relaxed text-muted-foreground">
                  “{entry.notes}”
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openTrack(game, entry)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit entry
                </Button>
                {entry.status !== "WISHLIST" && (
                  <Button size="sm" variant="outline" onClick={() => openQuickLog(entry)}>
                    <Timer className="mr-1.5 h-3.5 w-3.5" /> Log session
                  </Button>
                )}
                {entry.status === "PLAYING" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                    onClick={() => quickAdd.mutate("COMPLETED")}
                    disabled={quickAdd.isPending}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark finished
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
              <p className="mb-3 text-sm font-semibold">Not in your library yet</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500"
                  onClick={() => openTrack(game, null)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Track this game
                </Button>
                <Button size="sm" variant="outline" onClick={() => quickAdd.mutate("PLAYING")} disabled={quickAdd.isPending}>
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Playing now
                </Button>
                <Button size="sm" variant="outline" onClick={() => quickAdd.mutate("BACKLOG")} disabled={quickAdd.isPending}>
                  <Pause className="mr-1.5 h-3.5 w-3.5" /> Backlog
                </Button>
                <Button size="sm" variant="outline" onClick={() => quickAdd.mutate("WISHLIST")} disabled={quickAdd.isPending}>
                  <Star className="mr-1.5 h-3.5 w-3.5" /> Wishlist
                </Button>
              </div>
            </div>
          )}

          {game.source === "steam" && game.steamAppId && (
            <a
              href={`https://store.steampowered.com/app/${game.steamAppId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              View on Steam <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
