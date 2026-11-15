"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Search, Timer, Pencil, Trash2, MoreVertical, CheckCircle2, LayoutGrid, List, Gamepad2, Star } from "lucide-react";
import type { EntryStatus } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUI } from "@/lib/store";
import { api, type EntryDTO } from "@/lib/client";
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/status";
import { GamePoster } from "./GamePoster";
import { CriticScore, EmptyState, LoadError, RatingStars, StatusBadge } from "./Bits";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function EntryCard({ entry, delay, view }: { entry: EntryDTO; delay: number; view: "grid" | "list" }) {
  const { openDetail, openTrack, openQuickLog } = useUI();
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => api.deleteEntry(entry.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`${entry.game.name} removed`);
    },
    onError: (err: Error) => toast.error("Couldn't remove", { description: err.message }),
  });

  const meta =
    entry.status === "COMPLETED" && entry.finishDate
      ? `Finished ${format(new Date(entry.finishDate), "MMM d, yyyy")}`
      : entry.startDate
        ? `Started ${format(new Date(entry.startDate), "MMM d, yyyy")}`
        : "Not started yet";

  if (view === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.35 }}
        className="glass group flex items-center gap-3 rounded-2xl p-2.5 transition hover:border-primary/30"
      >
        <button onClick={() => openDetail(entry.game)} className="shrink-0">
          <GamePoster src={entry.game.posterUrl} name={entry.game.name} className="h-16 w-12 rounded-lg" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button onClick={() => openDetail(entry.game)} className="line-clamp-1 text-left text-sm font-semibold hover:text-primary">
              {entry.game.name}
            </button>
            <CriticScore score={entry.game.criticScore} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{meta}</span>
            <span>·</span>
            <span>{Math.round(entry.hoursPlayed * 10) / 10}h</span>
            {entry.rating != null && (
              <>
                <span>·</span>
                <RatingStars rating={entry.rating} />
              </>
            )}
          </div>
        </div>
        <StatusBadge status={entry.status} className="hidden min-[420px]:inline-flex" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${entry.game.name}`} className="h-8 w-8 text-muted-foreground">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-border bg-popover">
            <DropdownMenuItem onClick={() => openTrack(entry.game, entry)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit entry
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openQuickLog(entry)}>
              <Timer className="mr-2 h-3.5 w-3.5" /> Log session
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => del.mutate()} className="text-rose-400 focus:text-rose-300">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove from library
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="group glass relative overflow-hidden rounded-2xl"
    >
      <GamePoster src={entry.game.posterUrl} name={entry.game.name} className="aspect-[3/4] w-full" />
      <button type="button" aria-label={`View ${entry.game.name}`} onClick={() => openDetail(entry.game)}
        className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-2">
        <StatusBadge status={entry.status} />
        {entry.hoursPlayed > 0 && <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-amber-200">
          {Math.round(entry.hoursPlayed * 10) / 10}h
        </span>}
      </div>
      {entry.favorite && (
        <span className="pointer-events-none absolute right-2 top-9 z-10 rounded-full bg-black/70 p-1" aria-label="Favorite" role="img">
          <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/65 to-transparent p-3 pt-8">
        <p className="line-clamp-1 font-display text-sm font-bold text-white drop-shadow">{entry.game.name}</p>
        <p className="text-[11px] text-white/70">{meta}</p>
        <div className="mt-1.5 flex items-center gap-2 [&>button]:pointer-events-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-white/20 bg-black/40 px-2 text-[11px] text-white backdrop-blur hover:bg-black/60"
            onClick={(e) => {
              e.stopPropagation();
              openTrack(entry.game, entry);
            }}
          >
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-white/20 bg-black/40 px-2 text-[11px] text-white backdrop-blur hover:bg-black/60"
            onClick={(e) => {
              e.stopPropagation();
              openQuickLog(entry);
            }}
          >
            <Timer className="mr-1 h-3 w-3" /> Log
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function LibraryView() {
  const [filter, setFilter] = useState<EntryStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("recent");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const setViewInApp = useUI((state) => state.setView);
  const libraryQ = useQuery({ queryKey: ["library"], queryFn: api.library, select: (d) => d.items });

  const entries = useMemo(() => {
    const items = libraryQ.data ?? [];
    const query = q.trim().toLowerCase();
    return items
      .filter((entry) => filter === "ALL" || entry.status === filter)
      .filter((entry) => !favoritesOnly || entry.favorite)
      .filter((entry) => entry.game.name.toLowerCase().includes(query))
      .sort((a, b) => {
        switch (sort) {
          case "title": return a.game.name.localeCompare(b.game.name);
          case "hours": return b.hoursPlayed - a.hoursPlayed;
          case "rating": return (b.rating ?? -1) - (a.rating ?? -1);
          default: return b.updatedAt.localeCompare(a.updatedAt);
        }
      });
  }, [libraryQ.data, filter, q, sort, favoritesOnly]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: libraryQ.data?.length ?? 0 };
    (libraryQ.data ?? []).forEach((e) => (c[e.status] = (c[e.status] || 0) + 1));
    return c;
  }, [libraryQ.data]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">My library</h1>
        {libraryQ.data && <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
          {entries.length} of {libraryQ.data.length} games
        </p>}
      </div>

      {/* status shelves */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {(["ALL", ...STATUS_ORDER] as const).map((s) => {
          const active = filter === s;
          const label = s === "ALL" ? "All" : STATUS_CONFIG[s].label;
          const dot = s === "ALL" ? "bg-violet-400" : STATUS_CONFIG[s].dot;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={active}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                active
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
              {label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-primary/20" : "bg-muted")}>
                {counts[s] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search your library" placeholder="Search your library…" className="pl-9" />
        </div>
        <select aria-label="Sort games" value={sort} onChange={(event) => setSort(event.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
          <option value="recent">Recently updated</option>
          <option value="title">Title A–Z</option>
          <option value="hours">Most played</option>
          <option value="rating">Highest rated</option>
        </select>
        <Button variant={favoritesOnly ? "default" : "outline"} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
          <Star className="h-4 w-4" /> Favorites
        </Button>
        <div className="ml-auto flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", view === "grid" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
            onClick={() => setView("grid")}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", view === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
            onClick={() => setView("list")}
            aria-label="List view"
            aria-pressed={view === "list"}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {libraryQ.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : !libraryQ.data && libraryQ.isError ? (
        <LoadError title="Couldn’t load your library" retry={() => void libraryQ.refetch()} busy={libraryQ.isFetching} />
      ) : entries.length === 0 ? (
        libraryQ.data?.length ? (
          <EmptyState icon={Gamepad2} title="No games match your filters" action={
            <Button variant="outline" onClick={() => {
              setFilter("ALL");
              setQ("");
              setFavoritesOnly(false);
            }}>Clear filters</Button>
          } />
        ) : (
          <EmptyState icon={Gamepad2} title="Your library is empty" action={
            <Button onClick={() => setViewInApp("discover")}>Find a game</Button>
          } />
        )
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {entries.map((e, i) => (
            <EntryCard key={e.id} entry={e} delay={Math.min(i * 0.035, 0.5)} view="grid" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <EntryCard key={e.id} entry={e} delay={Math.min(i * 0.025, 0.4)} view="list" />
          ))}
        </div>
      )}

      {/* finished highlight — "ended games" calendar strip */}
      {filter === "COMPLETED" && entries.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Completion timeline
          </p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {[...entries]
              .filter((e) => e.finishDate)
              .sort((a, b) => new Date(b.finishDate!).getTime() - new Date(a.finishDate!).getTime())
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() => useUI.getState().openDetail(e.game)}
                  className="flex w-28 shrink-0 flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-muted/20 p-2 text-center transition hover:border-emerald-400/40"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    {format(new Date(e.finishDate!), "MMM d, yyyy")}
                  </span>
                  <GamePoster src={e.game.posterUrl} name={e.game.name} className="h-14 w-10 rounded-md" />
                  <span className="line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">{e.game.name}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
