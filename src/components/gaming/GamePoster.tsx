"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-violet-600/60 via-fuchsia-600/40 to-purple-800/60",
  "from-emerald-600/50 via-teal-600/40 to-emerald-800/60",
  "from-amber-500/50 via-orange-600/40 to-rose-800/50",
  "from-fuchsia-600/50 via-pink-600/40 to-violet-800/60",
  "from-teal-500/50 via-emerald-600/40 to-cyan-800/60",
  "from-rose-600/50 via-red-600/40 to-orange-800/50",
];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const initials = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

export function GamePoster({
  src,
  name,
  className,
  wide = false,
  priority = false,
}: {
  src?: string | null;
  name: string;
  className?: string;
  wide?: boolean;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const g = GRADIENTS[hashStr(name) % GRADIENTS.length];
  const showImg = src && !failed;

  return (
    <div className={cn("relative overflow-hidden bg-zinc-900/60", className)}>
      {/* fallback / placeholder layer */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-gradient-to-br transition-opacity",
          g,
          loaded ? "opacity-0" : "opacity-100"
        )}
      >
        {wide ? (
          <div className="flex flex-col items-center gap-1.5 px-3 text-center">
            <span className="font-display text-3xl font-bold tracking-tight text-white/90">{initials(name)}</span>
            <span className="line-clamp-2 text-[11px] font-medium leading-tight text-white/70">{name}</span>
          </div>
        ) : (
          <span className="font-display text-4xl font-bold tracking-tight text-white/85">{initials(name)}</span>
        )}
      </div>
      {showImg && (
        <img
          src={src}
          alt={`${name} cover art`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-transform duration-500",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
      {/* subtle bottom scrim for text legibility */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
    </div>
  );
}

export function MotionCard({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
