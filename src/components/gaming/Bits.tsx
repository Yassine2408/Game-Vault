"use client";

import { motion } from "framer-motion";
import { Star, Heart, CheckCircle2, Gamepad2, PauseCircle, Layers, XCircle, type LucideIcon } from "lucide-react";
import { EntryStatus } from "@prisma/client";
import { STATUS_CONFIG } from "@/lib/status";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { Gamepad2, CheckCircle2, PauseCircle, Layers, Heart, XCircle };

export function StatusBadge({ status, className, withDot = true }: { status: EntryStatus; className?: string; withDot?: boolean }) {
  const c = STATUS_CONFIG[status];
  const Icon = ICONS[c.icon];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        c.bg,
        c.border,
        c.color,
        className
      )}
    >
      {withDot && <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />}
      {Icon && <Icon className="h-3 w-3" />}
      {c.label}
    </span>
  );
}

export function CriticScore({ score, className }: { score: number | null; className?: string }) {
  if (score == null) return null;
  const tone = score >= 85 ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30" : score >= 70 ? "bg-amber-500/20 text-amber-300 border-amber-400/30" : "bg-rose-500/20 text-rose-300 border-rose-400/30";
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-display text-[11px] font-bold", tone, className)}
      title={`Metacritic score: ${score}`}
    >
      {score}
    </span>
  );
}

export function RatingStars({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <span className="inline-flex items-center gap-0.5" title={rating != null ? `${rating}/10` : "Not rated"}>
      {rating == null ? (
        <span className="text-xs text-muted-foreground">Not rated</span>
      ) : (
        <>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={cn(
                s,
                rating >= i * 2 ? "fill-amber-400 text-amber-400" : rating >= i * 2 - 1 ? "fill-amber-400/50 text-amber-400/50" : "text-zinc-600"
              )}
            />
          ))}
          <span className="ml-1 font-display text-xs font-semibold text-amber-300">{rating}/10</span>
        </>
      )}
    </span>
  );
}

export function FavHeart({ active }: { active: boolean }) {
  return (
    <Heart className={cn("h-3.5 w-3.5", active ? "fill-rose-400 text-rose-400" : "text-zinc-500")} />
  );
}

/* Pulsing dot used on every live surface */
export function LiveDot({ active = true, className }: { active?: boolean; className?: string }) {
  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      {active && (
        <motion.span
          animate={{ scale: [1, 1.9], opacity: [0.7, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
        />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", active ? "bg-emerald-400" : "bg-zinc-500")} />
    </span>
  );
}

/* Animated counter for stat cards */
export function AnimatedNumber({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const fmt = (n: number) => (n % 1 !== 0 ? n.toFixed(1) : String(Math.round(n)));
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className={cn("font-display tabular-nums", className)}
    >
      {fmt(value)}
      {suffix}
    </motion.span>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  accent,
  delay = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  accent: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-2xl p-4 sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", accent)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2">
        <AnimatedNumber value={value} suffix={suffix} className="text-3xl font-bold tracking-tight text-foreground" />
      </div>
    </motion.div>
  );
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadError({ title, retry, busy }: { title: string; retry: () => void; busy: boolean }) {
  return (
    <div role="alert" className="glass space-y-3 rounded-2xl p-6 text-center">
      <p className="font-semibold">{title}</p>
      <button type="button" onClick={retry} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
        {busy ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, sub, action }: { icon: LucideIcon; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </span>
      <div>
        <p className="font-display font-semibold text-foreground">{title}</p>
        {sub && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
