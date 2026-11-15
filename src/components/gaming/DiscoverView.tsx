"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Check,
  Plus,
  Play,
  Heart,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { EntryStatus } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUI } from "@/lib/store";
import { api, type GameDTO, type SteamSearchItem } from "@/lib/client";
import { GamePoster } from "./GamePoster";
import { CriticScore, EmptyState, LiveDot, LoadError } from "./Bits";
import { cn } from "@/lib/utils";

/* ---------- LIVE Steam search results (real-time store search) ---------- */
function SteamCard({ item, delay }: { item: SteamSearchItem; delay: number }) {
  const { openTrack } = useUI();
  const qc = useQueryClient();
  const [imported, setImported] = useState<GameDTO | null>(null);
  const isIn = item.inVault || !!imported;

  const doImport = useMutation({
    mutationFn: () => api.steamImport(item.appId),
    onSuccess: (res) => {
      setImported(res.game);
      qc.invalidateQueries({ queryKey: ["games"] });
      qc.invalidateQueries({ queryKey: ["facets"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`${res.game.name} imported from Steam`, { description: "Live data pulled just now — you can track it" });
    },
    onError: (err: Error) => toast.error("Import failed", { description: err.message }),
  });

  const track = useMutation({
    mutationFn: async (status: EntryStatus) => {
      const res = await api.track({ gameId: imported!.id, status, finishDate: status === "COMPLETED" ? new Date().toISOString() : null });
      return { ...res, status };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["games"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["facets"] });
      toast.success(`${res.entry.game.name} → ${res.status.toLowerCase().replace("_", " ")}`);
    },
    onError: (err: Error) => toast.error("Couldn't add", { description: err.message }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="glass overflow-hidden rounded-2xl"
    >
      <div className="relative h-24 w-full overflow-hidden bg-zinc-900/60">
        {item.image ? (
          <img src={item.image} alt={`${item.name} cover`} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-2xl font-bold text-white/70">?</div>
        )}
        {item.metascore != null && (
          <span className="absolute left-2 top-2 rounded-md border border-emerald-400/30 bg-emerald-500/25 px-1.5 py-0.5 font-display text-[11px] font-bold text-emerald-200 backdrop-blur">
            {item.metascore}
          </span>
        )}
        {isIn && (
          <span className="absolute right-2 top-2 rounded-full border border-emerald-400/30 bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-200 backdrop-blur">
            in vault
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-1 font-display text-sm font-bold" title={item.name}>{item.name}</p>
        {!imported ? (
          <Button
            size="sm"
            className="mt-2 h-8 w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs text-white hover:from-violet-500 hover:to-fuchsia-500"
            disabled={doImport.isPending}
            onClick={() => doImport.mutate()}
          >
            {doImport.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
            Pull from Steam
          </Button>
        ) : (
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 flex-1 border-violet-400/40 bg-violet-500/10 px-1 text-[11px] text-violet-200" onClick={() => track.mutate("PLAYING")}>
              <Play className="mr-0.5 h-3 w-3" /> Play
            </Button>
            <Button size="sm" variant="outline" className="h-7 flex-1 border-zinc-400/30 bg-zinc-500/10 px-1 text-[11px] text-zinc-200" onClick={() => track.mutate("BACKLOG")}>
              Backlog
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-8 border-fuchsia-400/40 bg-fuchsia-500/10 px-0 text-fuchsia-200" onClick={() => track.mutate("WISHLIST")} aria-label="Add to wishlist">
              <Heart className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-8 border-border/60 px-0 text-muted-foreground" onClick={() => openTrack(imported, null)} aria-label="Open details">
              <SlidersHorizontal className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SteamLiveResults({ query }: { query: string }) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const searchQ = useQuery({
    queryKey: ["steam-search", debounced],
    queryFn: () => api.steamSearch(debounced),
    enabled: debounced.trim().length >= 2,
    placeholderData: keepPreviousData,
  });

  if (debounced.trim().length < 2) {
    return <EmptyState icon={Search} title="Search the live Steam store" sub="Type at least 2 characters — results come straight from Steam in real time." />;
  }
  if (searchQ.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!searchQ.data && searchQ.isError) {
    return <LoadError title="Couldn’t reach Steam search" retry={() => void searchQ.refetch()} busy={searchQ.isFetching} />;
  }
  if (!searchQ.data?.items.length) {
    return <EmptyState icon={Search} title="Nothing found on Steam" sub="Try another spelling or a shorter query." />;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {searchQ.data.items.map((it, i) => (
        <SteamCard key={it.appId} item={it} delay={Math.min(i * 0.03, 0.4)} />
      ))}
    </div>
  );
}

function GameCard({ game, delay, inLibrary }: { game: GameDTO; delay: number; inLibrary: boolean }) {
  const { openDetail, openTrack } = useUI();
  const qc = useQueryClient();

  const quick = useMutation({
    mutationFn: async (status: EntryStatus) => {
      const res = await api.track({ gameId: game.id, status, finishDate: status === "COMPLETED" ? new Date().toISOString() : null });
      return { ...res, status };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["games"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["facets"] });
      toast.success(`${game.name} → ${res.status.toLowerCase().replace("_", " ")}`);
    },
    onError: (err: Error) => toast.error("Couldn't add", { description: err.message }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5 }}
      className="group glass relative overflow-hidden rounded-2xl"
    >
      <button onClick={() => openDetail(game)} className="block w-full text-left">
        <GamePoster src={game.posterUrl} name={game.name} className="aspect-[3/4] w-full" />
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-2">
          <CriticScore score={game.criticScore} className="shadow-md" />
          {inLibrary && (
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-200 backdrop-blur">
              <Check className="h-2.5 w-2.5" /> tracked
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <p className="line-clamp-2 font-display text-sm font-bold leading-tight text-white drop-shadow">{game.name}</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-white/60">
            {game.genres.slice(0, 3).map((g) => g.name).join(" · ")}
          </p>
        </div>
      </button>
      {/* hover quick actions */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex translate-y-full gap-1.5 bg-gradient-to-t from-black/85 via-black/60 to-transparent p-3 pt-8 transition-transform duration-300 group-hover:translate-y-0">
        <Button
          size="sm"
          className="h-7 flex-1 border-violet-400/40 bg-violet-500/30 px-2 text-[11px] text-violet-100 backdrop-blur hover:bg-violet-500/50"
          onClick={(e) => {
            e.stopPropagation();
            quick.mutate("PLAYING");
          }}
        >
          <Play className="mr-1 h-3 w-3" /> Playing
        </Button>
        <Button
          size="sm"
          className="h-7 flex-1 border-white/10 bg-white/15 px-2 text-[11px] text-white backdrop-blur hover:bg-white/25"
          onClick={(e) => {
            e.stopPropagation();
            openTrack(game, null);
          }}
        >
          <Plus className="mr-1 h-3 w-3" /> Details
        </Button>
        <Button
          size="sm"
          className="h-7 w-7 border-fuchsia-400/40 bg-fuchsia-500/25 px-0 text-fuchsia-100 backdrop-blur hover:bg-fuchsia-500/45"
          onClick={(e) => {
            e.stopPropagation();
            quick.mutate("WISHLIST");
          }}
          aria-label="Add to wishlist"
        >
          <Heart className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}

export function DiscoverView() {
  const { discoverQuery, setDiscoverQuery } = useUI();
  const [input, setInput] = useState(discoverQuery);
  const [source, setSource] = useState<"catalog" | "steam">("catalog");
  const [genre, setGenre] = useState("");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState("critic");
  const [lib, setLib] = useState<"" | "in" | "out">("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDiscoverQuery(input);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [input, setDiscoverQuery]);

  const facetsQ = useQuery({ queryKey: ["facets"], queryFn: api.facets });
  const libraryQ = useQuery({ queryKey: ["library"], queryFn: api.library, select: (d) => d.items });

  const gamesQ = useQuery({
    queryKey: ["games", { q: discoverQuery, genre, platform, sort, lib, page }],
    queryFn: () => api.games({ q: discoverQuery, genre, platform, sort, lib, page, pageSize: 24 }),
    placeholderData: keepPreviousData,
  });

  const trackedIds = useMemo(() => new Set((libraryQ.data ?? []).map((e) => e.game.id)), [libraryQ.data]);
  const total = gamesQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (gamesQ.data?.pageSize ?? 24)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Discover</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {source === "catalog"
              ? `Search the catalog — ${facetsQ.data?.totalGames ?? "…"} games with real Steam data. Quick-add to Playing, Backlog or Wishlist.`
              : "Search the live Steam store — fresh results pulled from Steam in real time, then import them into your vault."}
          </p>
        </div>
        <div className="flex items-center rounded-full border border-border/60 bg-muted/30 p-1">
          <button
            onClick={() => setSource("catalog")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              source === "catalog" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Vault catalog
          </button>
          <button
            onClick={() => setSource("steam")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              source === "steam" ? "bg-emerald-500/15 text-emerald-300" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LiveDot active={source === "steam"} /> Steam live
          </button>
        </div>
      </div>

      {/* search + filters */}
      <div className="glass sticky top-16 z-30 space-y-3 rounded-2xl p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={source === "steam" ? "Search the live Steam store — e.g. Palworld, Cuphead..." : "Search by name or developer — e.g. Elden, Hades, FromSoftware..."}
            className="border-border/70 bg-background/50 pl-9 text-sm"
          />
        </div>
        {source === "catalog" && (
        <div className="flex flex-wrap items-center gap-2">
          {/* genre chips */}
          <div className="no-scrollbar flex max-w-full flex-1 gap-1.5 overflow-x-auto">
            <button
              onClick={() => {
                setGenre("");
                setPage(1);
              }}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                genre === "" ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:bg-muted/40"
              )}
            >
              All genres
            </button>
            {(facetsQ.data?.genres ?? []).slice(0, 14).map((g) => (
              <button
                key={g.slug}
                onClick={() => {
                  setGenre(g.name === genre ? "" : g.name);
                  setPage(1);
                }}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                  genre === g.name ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:bg-muted/40"
                )}
              >
                {g.name} <span className="text-[10px] opacity-60">{g.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={platform || "all"}
              onValueChange={(v) => {
                setPlatform(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover max-h-72">
                <SelectItem value="all" className="text-xs">All platforms</SelectItem>
                {(facetsQ.data?.platforms ?? []).map((p) => (
                  <SelectItem key={p.slug} value={p.name} className="text-xs">
                    {p.name} ({p.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SlidersHorizontal className="mr-1 h-3 w-3 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover">
                <SelectItem value="critic" className="text-xs">Top rated</SelectItem>
                <SelectItem value="release" className="text-xs">Newest</SelectItem>
                <SelectItem value="recent" className="text-xs">Recently added</SelectItem>
                <SelectItem value="name" className="text-xs">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lib || "any"} onValueChange={(v) => { setLib(v === "any" ? "" : (v as "in" | "out")); setPage(1); }}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover">
                <SelectItem value="any" className="text-xs">All games</SelectItem>
                <SelectItem value="out" className="text-xs">Not tracked</SelectItem>
                <SelectItem value="in" className="text-xs">In library</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        )}
      </div>

      {/* results */}
      {source === "steam" ? (
        <SteamLiveResults query={input} />
      ) : gamesQ.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : !gamesQ.data && gamesQ.isError ? (
        <LoadError title="Couldn’t load the catalog" retry={() => void gamesQ.refetch()} busy={gamesQ.isFetching} />
      ) : gamesQ.isFetching && !gamesQ.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (gamesQ.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={Gamepad2} title="No games found" sub="Try a different search, genre or platform." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {gamesQ.data!.items.map((g, i) => (
              <GameCard key={g.id} game={g} delay={Math.min(i * 0.03, 0.4)} inLibrary={trackedIds.has(g.id)} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-border/60"
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Prev
              </Button>
              <span className="font-display text-sm font-semibold text-muted-foreground">
                Page {page} of {totalPages} · {total} games
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="border-border/60"
              >
                Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
