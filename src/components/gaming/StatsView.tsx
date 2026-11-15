"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  Pie,
  PieChart,
} from "recharts";
import { Trophy, Star, CheckCircle2, Clock, Target, Heart, Layers, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { AnimatedNumber, LoadError, SectionTitle, StatCard } from "./Bits";
import { GamePoster } from "./GamePoster";
import { STATUS_CONFIG } from "@/lib/status";
import { EntryStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<EntryStatus, string> = {
  PLAYING: "#a78bfa", // violet-400
  COMPLETED: "#34d399", // emerald-400
  ON_HOLD: "#fbbf24", // amber-400
  BACKLOG: "#a1a1aa", // zinc-400
  WISHLIST: "#e879f9", // fuchsia-400
  DROPPED: "#fb7185", // rose-400
};

function ChartTooltip({ active, payload, label, unit = "" }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 font-display font-bold text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="font-semibold text-foreground">
            {p.value}
            {unit}
          </span>
        </p>
      ))}
    </div>
  );
}

export function StatsView() {
  const statsQ = useQuery({ queryKey: ["stats"], queryFn: api.stats });

  if (statsQ.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }
  const stats = statsQ.data;
  if (!stats) {
    return <LoadError title="Couldn’t load your stats" retry={() => void statsQ.refetch()} busy={statsQ.isFetching} />;
  }
  const t = stats.totals;

  const statusData = (["PLAYING", "COMPLETED", "ON_HOLD", "BACKLOG", "WISHLIST", "DROPPED"] as EntryStatus[])
    .map((s) => ({ name: STATUS_CONFIG[s].label, value: t[s === "PLAYING" ? "playing" : s === "COMPLETED" ? "finished" : s === "ON_HOLD" ? "onHold" : s === "BACKLOG" ? "backlog" : s === "WISHLIST" ? "wishlist" : "dropped"] as number, status: s }))
    .filter((d) => d.value > 0);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Stats & insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">The story of your gaming life, in numbers.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Games tracked" value={t.gamesTracked} icon={Layers} accent="bg-violet-500/15 text-violet-300" delay={0} />
        <StatCard label="Finished" value={t.finished} icon={CheckCircle2} accent="bg-emerald-500/15 text-emerald-300" delay={0.06} />
        <StatCard label="Hours logged" value={t.totalHours} icon={Clock} accent="bg-amber-500/15 text-amber-300" delay={0.12} />
        <StatCard label="Completion rate" value={t.completionRate} suffix="%" icon={Target} accent="bg-fuchsia-500/15 text-fuchsia-300" delay={0.18} />
        <StatCard label="Average score" value={t.avgRating ?? 0} icon={Star} accent="bg-amber-500/15 text-amber-300" delay={0.24} />
        <StatCard label="Favorites" value={t.favorites} icon={Heart} accent="bg-rose-500/15 text-rose-300" delay={0.3} />
        <StatCard label="Backlog" value={t.backlog} icon={Layers} accent="bg-zinc-500/15 text-zinc-300" delay={0.36} />
        <StatCard label="Playing now" value={t.playing} icon={Loader2} accent="bg-violet-500/15 text-violet-300" delay={0.42} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* finishes per month */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4 sm:p-5">
          <SectionTitle title="Games finished per month" sub="Last 12 months" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.finishesPerMonth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={46} dy={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit=" finished" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#34d399" maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* hours per month */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass rounded-2xl p-4 sm:p-5">
          <SectionTitle title="Hours played per month" sub="From your logged sessions" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.hoursPerMonth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="hoursFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={46} dy={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit=" h" />} cursor={{ stroke: "var(--border)" }} />
                <Area type="monotone" dataKey="hours" stroke="#a78bfa" strokeWidth={2.5} fill="url(#hoursFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* status donut */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="glass rounded-2xl p-4 sm:p-5">
          <SectionTitle title="Library breakdown" sub="Where your games live" />
          <div className="flex items-center gap-4">
            <div className="h-56 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                    {statusData.map((d) => (
                      <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2">
              {statusData.map((d) => (
                <li key={d.status} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[d.status] }} />
                  <span className="font-semibold">{d.name}</span>
                  <span className="text-muted-foreground">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* top genres */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="glass rounded-2xl p-4 sm:p-5">
          <SectionTitle title="Top genres you play" sub="Across everything you've tracked" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topGenres} layout="vertical" margin={{ top: 0, right: 12, left: 26, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="genre" width={86} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit=" games" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#e879f9" maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* top rated */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4 sm:p-5">
          <SectionTitle title="Hall of fame" sub="Your highest-rated games" />
          <div className="space-y-2">
            {stats.topRated.slice(0, 8).map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <span className={cn("font-display text-sm font-bold", i === 0 ? "text-amber-300" : "text-muted-foreground")}>#{i + 1}</span>
                <GamePoster src={e.game.posterUrl} name={e.game.name} className="h-11 w-8 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold">{e.game.name}</p>
                  <p className="text-[11px] text-muted-foreground">{Math.round(e.hoursPlayed)}h played</p>
                </div>
                <div className="flex items-center gap-1 font-display text-sm font-bold text-amber-300">
                  <Trophy className={cn("h-3.5 w-3.5", i === 0 ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground")} />
                  {e.rating}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* rating distribution */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass rounded-2xl p-4 sm:p-5">
          <SectionTitle title="How you score" sub="Rating distribution (1-10)" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.ratingDist} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="rating" tickLine={false} axisLine={false} unit="/10" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit=" games" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={30}>
                  {stats.ratingDist.map((d) => (
                    <Cell key={d.rating} fill={d.rating >= 9 ? "#fbbf24" : d.rating >= 7 ? "#e879f9" : d.rating >= 5 ? "#a78bfa" : "#fb7185"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
