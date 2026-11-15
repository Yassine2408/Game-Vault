"use client";

import { useState } from "react";
import { ArrowUpRight, Compass, Flag, Layers, Play, Shuffle, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api, type EntryDTO } from "@/lib/client";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GamePoster } from "./GamePoster";

const modes = [
  { id: "discover", label: "Discover", icon: Compass, explanation: "A top-rated game outside your library." },
  { id: "playing", label: "Resume", icon: Play, explanation: "A game you already have in progress." },
  { id: "backlog", label: "Backlog", icon: Layers, explanation: "A game you saved for later." },
  { id: "favorites", label: "Favorites", icon: Star, explanation: "A favorite worth another visit." },
] as const;

type Mode = (typeof modes)[number];

export function PlayNext({ entries, playing, backlog }: {
  entries: EntryDTO[];
  playing: EntryDTO[];
  backlog: EntryDTO[];
}) {
  const defaultMode = playing.length ? "playing" : backlog.length ? "backlog" : "discover";
  const [selection, setSelection] = useState<{ mode: Mode["id"]; index: number }>({ mode: defaultMode, index: 0 });
  const openDetail = useUI((state) => state.openDetail);
  const openTrack = useUI((state) => state.openTrack);
  const openQuickLog = useUI((state) => state.openQuickLog);
  const setView = useUI((state) => state.setView);
  const catalog = useQuery({
    queryKey: ["games", "play-next"],
    queryFn: () => api.games({ pageSize: 24, sort: "critic", lib: "out" }),
    enabled: selection.mode === "discover",
  });

  const shelves = {
    discover: [],
    playing,
    backlog,
    favorites: entries.filter((entry) => entry.favorite),
  };
  const mode = modes.find((item) => item.id === selection.mode) ?? modes[0];
  const shelf = shelves[mode.id];
  const catalogGames = catalog.data?.items ?? [];
  const count = mode.id === "discover" ? catalogGames.length : shelf.length;
  const index = count ? selection.index % count : 0;
  const entry = shelf[index];
  const game = mode.id === "discover" ? catalogGames[index] : entry?.game;
  const art = game?.heroUrl || game?.coverUrl || game?.posterUrl;
  const showEntryAction = entry && (entry.status === "PLAYING" || entry.status === "BACKLOG");
  const emptyTitle = {
    discover: "Find something new",
    playing: "Nothing in progress",
    backlog: "Your backlog is empty",
    favorites: "No favorites yet",
  }[mode.id];

  function chooseAnother() {
    if (count < 2) return;
    const offset = 1 + Math.floor(Math.random() * (count - 1));
    setSelection({ mode: mode.id, index: (index + offset) % count });
  }

  return (
    <section aria-labelledby="play-next-heading" className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#151225] text-white shadow-xl shadow-black/15">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
        <h1 id="play-next-heading" className="flex items-center gap-2.5 font-display text-lg font-bold">
          <Compass aria-hidden="true" className="size-5 text-violet-300" /> What to play next
        </h1>
        <div role="group" aria-label="Recommendation source" className="flex flex-wrap gap-1.5">
          {modes.map(({ id, label, icon: Icon }) => (
            <Button key={id} type="button" size="sm" variant="ghost" aria-pressed={mode.id === id}
              onClick={() => setSelection({ mode: id, index: 0 })}
              className={cn("min-h-9 rounded-full border border-transparent px-2.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white",
                mode.id === id && "border-violet-300/40 bg-violet-400/20 text-white")}>
              <Icon aria-hidden="true" className="size-3.5" /> {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div aria-hidden="true" className="relative order-first aspect-[2/1] overflow-hidden bg-gradient-to-br from-[#372458] via-[#211a39] to-[#10383a] sm:order-last sm:aspect-auto sm:min-h-72">
          {game && art ? (
            <GamePoster key={art} src={art} name={game.name} wide priority className="absolute inset-0 h-full w-full" />
          ) : (
            <mode.icon className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 text-violet-200/35" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#151225] via-transparent to-transparent sm:bg-gradient-to-r" />
          {game?.criticScore != null && (
            <span className="absolute right-4 top-4 rounded-lg border border-white/20 bg-black/70 px-2.5 py-1.5 text-xs font-semibold">
              {game.criticScore}/100 critic score
            </span>
          )}
        </div>
        <div className="relative z-10 flex min-w-0 flex-col justify-center gap-4 p-5 sm:p-8 lg:p-10">
          <div aria-live="polite" aria-atomic="true">
            {game && <p className="mb-2 text-xs font-semibold text-violet-200">{mode.explanation}</p>}
            <h2 className="break-words font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {game?.name ?? (catalog.isLoading && mode.id === "discover" ? "Finding a game…" : emptyTitle)}
            </h2>
            {game ? (
              <>
                {!!game.genres.length && <p className="mt-2 text-sm font-medium text-violet-100/90">{game.genres.slice(0, 3).map((genre) => genre.name).join(" · ")}</p>}
                {game.summary && <p className="mt-2 line-clamp-2 max-w-lg text-sm leading-relaxed text-zinc-300">{game.summary}</p>}
              </>
            ) : (
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-300">
                {mode.id === "discover" && catalog.isError ? "The catalog didn’t load. Try again." : {
                  discover: "Browse the catalog to find your next game.",
                  playing: "Set a game to Playing to see it here.",
                  backlog: "Save a game to your backlog to get a pick here.",
                  favorites: "Mark a game as a favorite to revisit it here.",
                }[mode.id]}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {game ? (
              <>
                <Button onClick={() => {
                  if (entry?.status === "PLAYING") openQuickLog(entry);
                  else if (entry?.status === "BACKLOG") openTrack(game, entry, "PLAYING");
                  else openDetail(game);
                }} className="min-h-10 rounded-xl bg-violet-200 px-4 font-bold text-violet-950 hover:bg-violet-100">
                  {entry?.status === "PLAYING" ? "Log a session" : entry?.status === "BACKLOG" ? "Start playing" : "View game"}
                  <ArrowUpRight aria-hidden="true" />
                </Button>
                {showEntryAction && (
                  <Button variant="ghost" onClick={() => openDetail(game)} className="min-h-10 rounded-xl text-zinc-200 hover:bg-white/10 hover:text-white">
                    Details
                  </Button>
                )}
                {count > 1 && (
                  <Button variant="ghost" onClick={chooseAnother} className="min-h-10 rounded-xl text-zinc-200 hover:bg-white/10 hover:text-white">
                    <Shuffle aria-hidden="true" /> Another pick
                  </Button>
                )}
              </>
            ) : mode.id === "discover" && catalog.isError ? (
              <Button onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>Retry catalog</Button>
            ) : (
              <Button onClick={() => setView(mode.id === "favorites" && entries.length ? "library" : "discover")}
                className="min-h-10 rounded-xl bg-violet-200 px-4 font-bold text-violet-950 hover:bg-violet-100">
                {mode.id === "favorites" && entries.length ? "Open library" : "Browse catalog"} <ArrowUpRight aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CompletionMilestone({ finished }: { finished: number }) {
  const target = [1, 5, 10, 25, 50].find((goal) => goal > finished) ?? (Math.floor(finished / 25) + 1) * 25;
  return (
    <section aria-labelledby="milestone-heading" className="glass grid gap-3 rounded-2xl px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-5 sm:px-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Flag aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 id="milestone-heading" className="font-display text-sm font-bold">Next completion milestone</h2>
          <p className="text-xs text-muted-foreground">{finished} of {target} games finished</p>
        </div>
      </div>
      <progress aria-labelledby="milestone-heading" value={finished} max={target} className="h-2 w-full overflow-hidden rounded-full bg-muted text-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary" />
    </section>
  );
}
