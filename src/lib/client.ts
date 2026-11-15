"use client";

import type { GameDTO, EntryDTO } from "./dto";
import type { EntryStatus } from "@prisma/client";
export type { EntryDTO, GameDTO } from "./dto";
import { getClientTag } from "./socket";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const mutHeaders = (): HeadersInit => ({ "Content-Type": "application/json", "x-client-tag": getClientTag() });

export type GamesResponse = { items: GameDTO[]; total: number; page: number; pageSize: number };
export type FacetsResponse = {
  totalGames: number;
  genres: { name: string; slug: string; count: number }[];
  platforms: { name: string; slug: string; count: number }[];
  statusCounts: { status: EntryStatus; count: number }[];
};
export type StatsResponse = {
  totals: {
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
  finishesPerMonth: { month: string; count: number }[];
  hoursPerMonth: { month: string; hours: number }[];
  topGenres: { genre: string; count: number }[];
  ratingDist: { rating: number; count: number }[];
  topRated: EntryDTO[];
  activity: (
    | { type: "session"; date: string; game: { name: string; posterUrl: string | null; coverUrl: string | null }; minutes: number }
    | { type: "finish"; date: string; game: { name: string; posterUrl: string | null; coverUrl: string | null }; rating: number | null; hours: number }
  )[];
};

export type TrackInput = {
  gameId: string;
  status: EntryStatus;
  rating?: number | null;
  hoursPlayed?: number;
  startDate?: string | null;
  finishDate?: string | null;
  favorite?: boolean;
  notes?: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  accent: string;
  createdAt: string;
};

export type SteamSearchItem = {
  appId: number;
  name: string;
  image: string | null;
  metascore: number | null;
  inVault: boolean;
};

export const api = {
  // ---- auth ----
  me: () =>
    fetch("/api/auth/me").then((response) =>
      response.status === 401 ? { user: null } : json<{ user: AuthUser | null }>(response)
    ),
  login: (identifier: string, password: string) =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    }).then(json<{ user: AuthUser }>),
  register: (input: { username: string; email: string; password: string; displayName?: string }) =>
    fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then(json<{ user: AuthUser }>),
  logout: () => fetch("/api/auth/logout", { method: "POST" }).then(json<{ ok: boolean }>),

  // ---- catalog & library ----
  games: (params: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => sp.set(k, String(v)));
    return fetch(`/api/games?${sp.toString()}`).then(json<GamesResponse>);
  },
  steamSearch: (q: string) => fetch(`/api/steam/search?q=${encodeURIComponent(q)}`).then(json<{ items: SteamSearchItem[] }>),
  steamImport: (appId: number, track?: string | null) =>
    fetch("/api/steam/import", {
      method: "POST",
      headers: mutHeaders(),
      body: JSON.stringify({ appId, track: track ?? null }),
    }).then(json<{ game: GameDTO; entry: EntryDTO | null }>),
  facets: () => fetch("/api/facets").then(json<FacetsResponse>),
  library: () => fetch("/api/library").then(json<{ items: EntryDTO[] }>),
  track: (input: TrackInput) =>
    fetch("/api/library", { method: "POST", headers: mutHeaders(), body: JSON.stringify(input) }).then(
      json<{ entry: EntryDTO }>
    ),
  updateEntry: (id: string, patch: Partial<TrackInput>) =>
    fetch(`/api/library/${id}`, { method: "PATCH", headers: mutHeaders(), body: JSON.stringify(patch) }).then(
      json<{ entry: EntryDTO }>
    ),
  deleteEntry: (id: string) => fetch(`/api/library/${id}`, { method: "DELETE", headers: mutHeaders() }).then(json<{ ok: boolean }>),
  logSession: (entryId: string, minutes: number, playedOn?: string) =>
    fetch(`/api/library/${entryId}/sessions`, {
      method: "POST",
      headers: mutHeaders(),
      body: JSON.stringify({ minutes, playedOn }),
    }).then(json<{ entry: EntryDTO }>),
  stats: () => fetch("/api/stats").then(json<StatsResponse>),
};
