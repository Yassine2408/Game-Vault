/**
 * GameVault Realtime Service
 * - socket.io hub (port 3003) for all live updates
 * - Polls the Next.js API for tracked games + stats totals
 * - Polls Steam public endpoints for REAL live data:
 *     - concurrent players per tracked game (every 60s)
 *     - global most-played chart (every 5 min)
 * - Community pulse: simulated gamers generate a live activity stream
 * - Internal HTTP notify endpoint so Next.js API routes can broadcast instantly
 */
import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 3003;
const NEXT_BASE = "http://127.0.0.1:3000";

// ---------- types ----------
type TrackedGame = {
  id: string;
  name: string;
  steamAppId: number | null;
  posterUrl: string | null;
  coverUrl: string | null;
  status: string;
  lastSessionAt: string | null;
};

type Totals = {
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

type ActivityKind = "session" | "finish" | "start" | "rate" | "track";

type ActivityEvent = {
  id: string;
  scope: "user" | "community";
  gamer: string;
  kind: ActivityKind;
  game: { name: string; posterUrl: string | null; coverUrl: string | null };
  minutes?: number;
  rating?: number;
  ts: string;
};

type TrendingItem = { rank: number; appId: number; name: string; players: number };

// ---------- state ----------
let totals: Totals | null = null;
let trackedGames: TrackedGame[] = [];
const playersMap = new Map<number, number>();
const nameCache = new Map<number, string>(); // appId -> name (Steam, immutable)
let trending: TrendingItem[] = [];
let recentActivity: ActivityEvent[] = []; // community pulse history (max 40)
const realSockets = new Set<string>();
const gamersOnline = new Set<string>();
let nextInternalRefresh: ReturnType<typeof setTimeout> | null = null;

// ---------- helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10);

async function fetchJson<T>(url: string, timeoutMs = 7000): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const fmt = (n: number) => n.toLocaleString("en-US");

// ---------- Steam live data ----------
async function fetchCurrentPlayers(appId: number): Promise<number | null> {
  const d = await fetchJson<{ response: { player_count: number; result: number } }>(
    `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`
  );
  return d?.response?.result === 1 ? d.response.player_count : null;
}

async function resolveNames(appIds: number[]): Promise<void> {
  const missing = appIds.filter((id) => !nameCache.has(id)).slice(0, 10);
  if (!missing.length) return;
  const results = await Promise.all(
    missing.map(async (id) => {
      const d = await fetchJson<Record<string, { success: boolean; data?: { name?: string } }>>(
        `https://store.steampowered.com/api/appdetails?appids=${id}&l=en&filters=basic`,
        8000
      );
      return [id, d?.[id]?.success && d[id].data?.name ? d[id].data!.name! : null] as const;
    })
  );
  for (const [id, name] of results) if (name) nameCache.set(id, name);
}

async function pollTrending(): Promise<void> {
  const d = await fetchJson<{ response: { ranks: { rank: number; appid: number; peak_in_game: number }[] } }>(
    "https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/"
  );
  const ranks = d?.response?.ranks?.slice(0, 14);
  if (!ranks?.length) return;
  await resolveNames(ranks.map((r) => r.appid));
  trending = ranks.map((r) => ({
    rank: r.rank,
    appId: r.appid,
    name: nameCache.get(r.appid) ?? `App ${r.appid}`,
    players: r.peak_in_game,
  }));
  io.emit("live:trending", { trending, ts: new Date().toISOString() });
  console.log(`[trending] pushed ${trending.length} games (top: ${trending[0]?.name} ${fmt(trending[0]?.players ?? 0)})`);
}

async function pollLiveData(): Promise<void> {
  const d = await fetchJson<{ totals: Totals; games: TrackedGame[] }>(`${NEXT_BASE}/api/internal/live-data`, 6000);
  if (!d) return;
  totals = d.totals;
  trackedGames = d.games ?? [];

  // concurrent players for tracked games — prioritize PLAYING / active statuses
  const statusRank = (s: string) => (s === "PLAYING" ? 0 : s === "BACKLOG" || s === "ON_HOLD" ? 1 : s === "DROPPED" ? 2 : 3);
  const sortedGames = [...trackedGames].sort((a, b) => statusRank(a.status) - statusRank(b.status));
  const appIds = [...new Set(sortedGames.map((g) => g.steamAppId).filter((x): x is number => !!x))].slice(0, 16);
  const results = await Promise.all(
    appIds.map(async (id) => [id, await fetchCurrentPlayers(id)] as const)
  );
  let changed = false;
  for (const [id, count] of results) {
    if (count != null) {
      if (playersMap.get(id) !== count) changed = true;
      playersMap.set(id, count);
    }
  }
  const players: Record<string, number> = {};
  playersMap.forEach((v, k) => (players[String(k)] = v));
  io.emit("live:players", { players, ts: new Date().toISOString() });

  io.emit("stats:update", { totals, ts: new Date().toISOString() });

  const inGame = [...playersMap.values()].reduce((a, b) => a + b, 0);
  console.log(
    `[poll] totals: ${totals?.gamesTracked} tracked / ${totals?.finished} finished · players: ${appIds.length} games · ${fmt(inGame)} in-game now${changed ? " (changed)" : ""}`
  );
}

function refreshSoon(): void {
  if (nextInternalRefresh) clearTimeout(nextInternalRefresh);
  nextInternalRefresh = setTimeout(() => {
    nextInternalRefresh = null;
    pollLiveData().catch(() => {});
  }, 1200);
}

// ---------- community pulse ----------
const PERSONAS = [
  "NightOwl_77", "PixelReaper", "Nova_Cutz", "GhostOfTsushi", "LatteLoadout",
  "VoidRunner", "CptBacklog", "SprintQueen", "Q3_Fragger", "MoonlitMage",
  "TurboSnail", "WishlisterX",
];

function personaOnlineTick(): void {
  // rotate 4..8 personas "online"
  const target = 4 + Math.floor(Math.random() * 5);
  while (gamersOnline.size > target) {
    const arr = [...gamersOnline];
    gamersOnline.delete(arr[Math.floor(Math.random() * arr.length)]);
  }
  while (gamersOnline.size < target) {
    const p = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
    if (!gamersOnline.has(p)) gamersOnline.add(p);
  }
  broadcastPresence();
}

function broadcastPresence(): void {
  io.emit("presence:update", { online: realSockets.size + gamersOnline.size, ts: new Date().toISOString() });
}

function pushActivity(ev: ActivityEvent): void {
  if (ev.scope === "community") {
    recentActivity = [ev, ...recentActivity].slice(0, 40);
  }
  io.emit("activity:new", ev);
}

function communityTick(): void {
  personaOnlineTick();
  const pool = trackedGames.length
    ? trackedGames
    : trending.slice(0, 10).map((t) => ({ id: String(t.appId), name: t.name, posterUrl: null, coverUrl: null, steamAppId: t.appId, status: "", lastSessionAt: null }));
  if (!pool.length) return;
  const game = pool[Math.floor(Math.random() * pool.length)];
  const gamer = [...gamersOnline][Math.floor(Math.random() * gamersOnline.size)] ?? PERSONAS[0];

  const roll = Math.random();
  let ev: ActivityEvent;
  const ts = new Date().toISOString();
  if (roll < 0.58) {
    ev = { id: uid(), scope: "community", gamer, kind: "session", game, minutes: 20 + Math.floor(Math.random() * 150), ts };
  } else if (roll < 0.74) {
    ev = { id: uid(), scope: "community", gamer, kind: "finish", game, rating: 6 + Math.floor(Math.random() * 5), ts };
  } else if (roll < 0.86) {
    ev = { id: uid(), scope: "community", gamer, kind: "start", game, ts };
  } else {
    ev = { id: uid(), scope: "community", gamer, kind: "rate", game, rating: 5 + Math.floor(Math.random() * 6), ts };
  }
  pushActivity(ev);
  scheduleCommunityTick();
}

let communityTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleCommunityTick(): void {
  if (communityTimer) clearTimeout(communityTimer);
  communityTimer = setTimeout(communityTick, 16_000 + Math.floor(Math.random() * 22_000));
}

// ---------- socket.io + internal HTTP ----------
const httpServer = createServer((req, res) => {
  // internal notify endpoint used by Next.js API routes (server-to-server)
  if (req.method === "POST" && (req.url === "/__notify" || req.url?.startsWith("/__notify?"))) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(204).end();
      try {
        const msg = JSON.parse(body || "{}") as {
          kind?: string;
          activity?: Omit<ActivityEvent, "id">;
          clientTag?: string | null;
        };
        if (msg.kind === "activity" && msg.activity?.game?.name) {
          pushActivity({ ...msg.activity, id: uid() } as ActivityEvent);
          console.log(`[notify] activity: ${msg.activity.gamer} ${msg.activity.kind} ${msg.activity.game.name}`);
        } else if (msg.kind === "library") {
          io.emit("library:update", { clientTag: msg.clientTag ?? null, ts: new Date().toISOString() });
          console.log(`[notify] library update (tag: ${msg.clientTag ?? "none"})`);
        } else if (msg.kind === "catalog") {
          io.emit("catalog:update", { clientTag: msg.clientTag ?? null, ts: new Date().toISOString() });
          console.log(`[notify] catalog update`);
        }
        refreshSoon();
      } catch (e) {
        console.error("[notify] bad payload", e);
      }
    });
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, clients: realSockets.size, ts: new Date().toISOString() }));
    return;
  }
  res.writeHead(404).end();
});

const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  realSockets.add(socket.id);
  broadcastPresence();
  console.log(`[socket] connected ${socket.id} (real clients: ${realSockets.size})`);

  // immediate snapshot so the UI is live within ~1s of load
  const players: Record<string, number> = {};
  playersMap.forEach((v, k) => (players[String(k)] = v));
  socket.emit("live:snapshot", {
    presence: realSockets.size + gamersOnline.size,
    players,
    trending,
    stats: totals,
    activity: recentActivity.slice(0, 16),
    ts: new Date().toISOString(),
  });

  socket.on("ping-live", (cb?: (t: number) => void) => {
    if (typeof cb === "function") cb(Date.now());
  });

  socket.on("disconnect", () => {
    realSockets.delete(socket.id);
    broadcastPresence();
    console.log(`[socket] disconnected ${socket.id} (real clients: ${realSockets.size})`);
  });

  socket.on("error", (e) => console.error(`[socket] error ${socket.id}:`, e));
});

// ---------- boot ----------
httpServer.listen(PORT, () => {
  console.log(`GameVault realtime service running on port ${PORT}`);
  pollLiveData().catch(() => {});
  pollTrending().catch(() => {});
  personaOnlineTick();
  scheduleCommunityTick();
});

setInterval(() => pollLiveData().catch(() => {}), 60_000);
setInterval(() => pollTrending().catch(() => {}), 5 * 60_000);

process.on("SIGTERM", () => {
  console.log("SIGTERM — shutting down realtime service");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});
