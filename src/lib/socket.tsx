"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { toast } from "sonner";

// ---------- shared client tag (per browser tab) ----------
export function getClientTag(): string {
  if (typeof window === "undefined") return "ssr";
  let tag = window.sessionStorage.getItem("gv-client-tag");
  if (!tag) {
    tag = Math.random().toString(36).slice(2, 10);
    window.sessionStorage.setItem("gv-client-tag", tag);
  }
  return tag;
}

// ---------- types ----------
export type LiveActivity = {
  id: string;
  scope: "user" | "community";
  gamer: string;
  kind: "session" | "finish" | "start" | "rate" | "track";
  game: { name: string; posterUrl: string | null; coverUrl: string | null };
  minutes?: number;
  rating?: number;
  ts: string;
  clientTag?: string | null;
};

export type TrendingItem = { rank: number; appId: number; name: string; players: number };

type LiveTotals = {
  gamesTracked: number;
  playing: number;
  finished: number;
  onHold: number;
  backlog: number;
  wishlist: number;
  dropped: number;
  totalHours: number;
  avgRating: number | null;
  favorites: number;
  completionRate: number;
};

type LiveState = {
  connected: boolean;
  presence: number;
  players: Record<string, number>;
  trending: TrendingItem[];
  activity: LiveActivity[];
  liveTotals: LiveTotals | null;
  live: (patch: Partial<Omit<LiveState, "live">>) => void;
};

export const useLive = create<LiveState>((set) => ({
  connected: false,
  presence: 0,
  players: {},
  trending: [],
  activity: [],
  liveTotals: null,
  live: (patch) => set(patch),
}));

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1200,
      timeout: 10000,
    });
    socketRef.current = s;
    const live = useLive.getState().live;
    const myTag = getClientTag();

    const invalidate = (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

    s.on("connect", () => live({ connected: true }));
    s.on("disconnect", () => live({ connected: false }));
    s.on("connect_error", () => live({ connected: false }));

    s.on("live:snapshot", (d: { presence?: number; players?: Record<string, number>; trending?: TrendingItem[]; stats?: LiveTotals; activity?: LiveActivity[] }) => {
      live({
        presence: d.presence ?? useLive.getState().presence,
        players: d.players ?? {},
        trending: d.trending ?? [],
        activity: d.activity ?? [],
        liveTotals: d.stats ?? useLive.getState().liveTotals,
      });
      if (d.stats) qc.setQueryData(["stats"], (old: { totals?: LiveTotals } | undefined) => (old ? { ...old, totals: d.stats } : old));
    });

    s.on("presence:update", (d: { online: number }) => live({ presence: d.online }));

    s.on("live:players", (d: { players: Record<string, number> }) => live({ players: d.players }));

    s.on("live:trending", (d: { trending: TrendingItem[] }) => live({ trending: d.trending }));

    s.on("stats:update", (d: { totals: LiveTotals }) => {
      live({ liveTotals: d.totals });
      qc.setQueryData(["stats"], (old: { totals?: LiveTotals } | undefined) => (old ? { ...old, totals: d.totals } : old));
    });

    s.on("activity:new", (ev: LiveActivity) => {
      live({ activity: [ev, ...useLive.getState().activity].slice(0, 40) });
      if (ev.scope === "user") {
        invalidate(["library", "stats", "facets"]);
        if (ev.clientTag && ev.clientTag !== myTag) {
          toast(`${describe(ev)}`, { description: "Synced from another tab" });
        }
      }
    });

    s.on("library:update", (d: { clientTag?: string | null }) => {
      if (d.clientTag && d.clientTag === myTag) return; // this tab already invalidated after its mutation
      invalidate(["library", "stats", "facets"]);
    });

    s.on("catalog:update", (d: { clientTag?: string | null }) => {
      if (d.clientTag && d.clientTag === myTag) return;
      invalidate(["games", "facets"]);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [qc]);

  return <>{children}</>;
}

// ---------- helpers ----------
export function describe(ev: LiveActivity): string {
  const g = ev.game.name;
  switch (ev.kind) {
    case "session":
      return `${ev.gamer} played ${g} for ${Math.round((ev.minutes ?? 0) / 6) / 10}h`;
    case "finish":
      return `${ev.gamer} finished ${g}${ev.rating ? ` · ${ev.rating}/10` : ""}`;
    case "start":
      return `${ev.gamer} started playing ${g}`;
    case "rate":
      return `${ev.gamer} rated ${g} ${ev.rating}/10`;
    case "track":
      return `${ev.gamer} added ${g} to the vault`;
    default:
      return `${ev.gamer} updated ${g}`;
  }
}
