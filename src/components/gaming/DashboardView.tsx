"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Gamepad2,
  CheckCircle2,
  Clock,
  Layers,
  Play,
  Check,
  Timer,
  ArrowRight,
  Star,
  Radio,
  Plus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useUI } from "@/lib/store";
import { api, type EntryDTO, type StatsResponse } from "@/lib/client";
import { useLive, type LiveActivity } from "@/lib/socket";
import { GamePoster } from "./GamePoster";
import { CompletionMilestone, PlayNext } from "./PlayNext";
import { AnimatedNumber, CriticScore, EmptyState, LoadError, LiveDot, RatingStars, SectionTitle, StatCard, StatusBadge } from "./Bits";

const KIND_ICON = {
  session: Timer,
  finish: CheckCircle2,
  start: Play,
  rate: Star,
  track: Plus,
} as const;
const KIND_COLOR = {
  session: "text-violet-400",
  finish: "text-emerald-400",
  start: "text-sky-400",
  rate: "text-amber-400",
  track: "text-fuchsia-400",
} as const;

function ContinuePlayingCard({ entry, delay }: { entry: EntryDTO; delay: number }) {
  const { openQuickLog, openTrack, openDetail } = useUI();
  const last = entry.lastSession;
  const players = useLive((s) => s.players);
  const livePlayers = entry.game.steamAppId ? players[String(entry.game.steamAppId)] : undefined;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="group glass relative w-56 shrink-0 cursor-pointer overflow-hidden rounded-2xl sm:w-64"
      onClick={() => openDetail(entry.game)}
    >
      <GamePoster src={entry.game.posterUrl} name={entry.game.name} className="h-32 w-full" wide />
      <div className="absolute inset-x-0 top-0 flex justify-between p-2.5">
        <StatusBadge status={entry.status} />
        <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-violet-200 backdrop-blur">
          {Math.round(entry.hoursPlayed * 10) / 10}h
        </span>
      </div>
      {livePlayers != null && (
        <div className="absolute left-2.5 top-[101px] flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-black/55 px-2 py-0.5 backdrop-blur">
          <LiveDot />
          <span className="text-[10px] font-bold text-emerald-300 tabular-nums">{livePlayers.toLocaleString("en-US")}</span>
          <span className="text-[9px] text-emerald-200/80">in-game now</span>
        </div>
      )}
      <div className="p-3">
        <p className="line-clamp-1 font-display text-sm font-bold tracking-tight">{entry.game.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {last ? `Last played ${formatDistanceToNow(new Date(last.playedOn), { addSuffix: true })}` : "No sessions yet"}
        </p>
        <div className="mt-2.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 border-violet-400/40 bg-violet-500/10 px-2 text-[11px] text-violet-200 hover:bg-violet-500/20"
            onClick={() => openQuickLog(entry)}
          >
            <Timer className="mr-1 h-3 w-3" /> Log
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 border-emerald-400/40 bg-emerald-500/10 px-2 text-[11px] text-emerald-200 hover:bg-emerald-500/20"
            onClick={() => openTrack(entry.game, entry)}
          >
            <Check className="mr-1 h-3 w-3" /> Finish
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* Steam global most-played chart, pushed live by the realtime service */
function SteamTrending() {
  const trending = useLive((s) => s.trending);
  if (!trending.length) return null;
  const max = trending[0]?.players ?? 1;

  return (
    <section>
      <SectionTitle
        title="Steam top played — right now"
        sub="Live concurrent-player chart, straight from Steam"
        action={
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
            <LiveDot /> live chart
          </span>
        }
      />
      <div className="glass rounded-2xl p-3 sm:p-4">
        <div className="space-y-2">
          {trending.slice(0, 8).map((t, i) => (
            <motion.div
              key={t.appId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              className="flex items-center gap-2.5"
            >
              <span className="w-5 shrink-0 text-right font-display text-xs font-bold text-muted-foreground">{t.rank}</span>
              <span className="w-36 shrink-0 truncate text-xs font-semibold sm:w-44" title={t.name}>
                {t.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(6, (t.players / max) * 100)}%` }}
                  transition={{ delay: i * 0.05 + 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                />
              </div>
              <AnimatedNumber value={t.players} className="w-20 shrink-0 text-right text-[11px] font-bold text-foreground/80" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Unified live pulse: socket events + persisted activity */
function LivePulse({ dbActivity }: { dbActivity: StatsResponse["activity"] }) {
  const liveItems = useLive((s) => s.activity);

  const items = useMemo(() => {
    const mapped: LiveActivity[] = dbActivity.map((a, i) => ({
      id: `db-${i}-${a.date}`,
      scope: "user",
      gamer: "You",
      kind: a.type === "session" ? "session" : "finish",
      game: a.game,
      minutes: a.type === "session" ? a.minutes : undefined,
      rating: a.type === "finish" ? a.rating ?? undefined : undefined,
      ts: a.date,
    }));
    const all = [...liveItems, ...mapped];
    const seen = new Set<string>();
    return all
      .filter((a) => {
        const key = `${a.kind}:${a.game.name}:${a.ts.slice(0, 16)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 14);
  }, [liveItems, dbActivity]);

  return (
    <section>
      <SectionTitle
        title="Live pulse"
        sub="Sessions, finishes and ratings — as they happen"
        action={
          <LiveBadge />
        }
      />
      <div className="glass max-h-96 space-y-1 overflow-y-auto rounded-2xl p-2.5">
        <AnimatePresence initial={false}>
          {items.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-muted/40"
              >
                <GamePoster
                  src={a.game.posterUrl ?? a.game.coverUrl}
                  name={a.game.name}
                  className="h-10 w-7 shrink-0 rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{a.gamer === "You" ? "You" : a.gamer}</span>{" "}
                    {a.kind === "session" && <>played <span className="font-semibold text-foreground">{a.game.name}</span> · {Math.round((a.minutes ?? 0) / 60 * 10) / 10}h</>}
                    {a.kind === "finish" && <>finished <span className="font-semibold text-foreground">{a.game.name}</span>{a.rating != null ? ` · ${a.rating}/10` : ""}</>}
                    {a.kind === "start" && <>started <span className="font-semibold text-foreground">{a.game.name}</span></>}
                    {a.kind === "rate" && <>rated <span className="font-semibold text-foreground">{a.game.name}</span> {a.rating}/10</>}
                    {a.kind === "track" && <>added <span className="font-semibold text-foreground">{a.game.name}</span> to the vault</>}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80">{formatDistanceToNow(new Date(a.ts), { addSuffix: true })}</p>
                </div>
                {a.scope === "community" && <span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">live</span>}
                <Icon className={`h-4 w-4 shrink-0 ${KIND_COLOR[a.kind]}`} />
              </motion.div>
            );
          })}
        </AnimatePresence>
        {items.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Waiting for activity…</p>}
      </div>
    </section>
  );
}

function LiveBadge() {
  const connected = useLive((s) => s.connected);
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
      <Radio className="h-3 w-3" /> {connected ? "streaming" : "reconnecting"}
    </span>
  );
}

export function DashboardView() {
  const setView = useUI((state) => state.setView);
  const openDetail = useUI((state) => state.openDetail);
  const openTrack = useUI((state) => state.openTrack);
  const libraryQ = useQuery({ queryKey: ["library"], queryFn: api.library, select: (d) => d.items });
  const statsQ = useQuery({ queryKey: ["stats"], queryFn: api.stats });


  if (libraryQ.isLoading || statsQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (!libraryQ.data || !statsQ.data) {
    return (
      <LoadError title="Couldn’t load your dashboard" busy={libraryQ.isFetching || statsQ.isFetching} retry={() => {
        if (!libraryQ.data) void libraryQ.refetch();
        if (!statsQ.data) void statsQ.refetch();
      }} />
    );
  }

  const entries = libraryQ.data;
  const stats = statsQ.data;
  const playing = entries.filter((e) => e.status === "PLAYING").sort((a, b) => {
    const ta = a.lastSession ? new Date(a.lastSession.playedOn).getTime() : 0;
    const tb = b.lastSession ? new Date(b.lastSession.playedOn).getTime() : 0;
    return tb - ta;
  });
  const finished = entries
    .filter((e) => e.status === "COMPLETED" && e.finishDate)
    .sort((a, b) => new Date(b.finishDate!).getTime() - new Date(a.finishDate!).getTime());
  const backlog = entries.filter((entry) => entry.status === "BACKLOG");
  const backlogCands = [...backlog]
    .sort((a, b) => (b.game.criticScore ?? -1) - (a.game.criticScore ?? -1))
    .slice(0, 4);
  return (
    <div className="space-y-7">
      <PlayNext entries={entries} playing={playing} backlog={backlog} />

      {/* stat strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Playing now" value={stats.totals.playing} icon={Play} accent="bg-violet-500/15 text-violet-300" delay={0} />
        <StatCard label="Finished" value={stats.totals.finished} icon={CheckCircle2} accent="bg-emerald-500/15 text-emerald-300" delay={0.06} />
        <StatCard label="Hours logged" value={stats.totals.totalHours} icon={Clock} accent="bg-amber-500/15 text-amber-300" delay={0.12} />
        <StatCard label="Backlog size" value={stats.totals.backlog} icon={Layers} accent="bg-fuchsia-500/15 text-fuchsia-300" delay={0.18} />
      </div>

      <CompletionMilestone finished={stats.totals.finished} />

      {/* continue playing (with live Steam player counts) */}
      <section>
        <SectionTitle
          title="Continue playing"
          sub="Jump back in — player counts update live every minute"
          action={
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setView("library")}>
              Library <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          }
        />
        {playing.length === 0 ? (
          <EmptyState
            icon={Gamepad2}
            title="No games in progress"
            sub="Discover something new or pull a game out of the backlog."
            action={
              <Button size="sm" onClick={() => setView("discover")} variant="outline">
                Browse catalog
              </Button>
            }
          />
        ) : (
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {playing.map((e, i) => (
              <ContinuePlayingCard key={e.id} entry={e} delay={i * 0.07} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-7 lg:grid-cols-5">
        {/* left column */}
        <div className="space-y-7 lg:col-span-3">
          <section>
            <SectionTitle title="Recently finished" sub="Games you ended, with the exact dates" />
            {finished.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing finished yet" sub="When you complete a game, it lands here with the date." />
            ) : (
              <div className="space-y-2.5">
                {finished.slice(0, 6).map((e, i) => (
                  <motion.button
                    key={e.id}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.4 }}
                    onClick={() => openDetail(e.game)}
                    className="glass group flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-all hover:border-primary/40 hover:bg-muted/40"
                  >
                    <GamePoster src={e.game.posterUrl} name={e.game.name} className="h-16 w-11 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="line-clamp-1 text-sm font-semibold">{e.game.name}</p>
                        <CriticScore score={e.game.criticScore} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Finished {format(new Date(e.finishDate!), "MMM d, yyyy")} · {Math.round(e.hoursPlayed)}h
                        {e.rating != null ? ` · scored ${e.rating}/10` : ""}
                      </p>
                    </div>
                    {e.favorite && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                    <RatingStars rating={e.rating} />
                  </motion.button>
                ))}
              </div>
            )}
          </section>
          <SteamTrending />
        </div>

        {/* right column */}
        <div className="space-y-7 lg:col-span-2">
          <section>
            <SectionTitle
              title="Next up"
              sub="Highest critic scores in your backlog"
            />
            {backlogCands.length === 0 ? (
              <EmptyState icon={Layers} title="Backlog is empty" sub="Nice focus. Add games you plan to play." />
            ) : (
              <div className="space-y-2">
                {backlogCands.map((e, i) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    className="glass flex items-center gap-3 rounded-xl p-2"
                  >
                    <GamePoster src={e.game.posterUrl} name={e.game.name} className="h-12 w-9 shrink-0 rounded-md" />
                    <button className="min-w-0 flex-1 text-left" onClick={() => openDetail(e.game)}>
                      <p className="line-clamp-1 text-sm font-semibold">{e.game.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {e.game.genres.slice(0, 2).map((g) => g.name).join(" · ")}
                      </p>
                    </button>
                    <CriticScore score={e.game.criticScore} />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-violet-400/40 bg-violet-500/10 px-2 text-[11px] text-violet-200 hover:bg-violet-500/20"
                      onClick={() => openTrack(e.game, e, "PLAYING")}
                    >
                      <Play className="mr-1 h-3 w-3" /> Start
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          <LivePulse dbActivity={stats?.activity ?? []} />
        </div>
      </div>
    </div>
  );
}
