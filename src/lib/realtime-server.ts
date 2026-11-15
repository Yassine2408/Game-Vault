import type { NextRequest } from "next/server";

/**
 * Server-side helper to push realtime events to the socket.io service
 * (mini-services/realtime-service on port 3003). Fire-and-forget: if the
 * realtime service is down, API responses must still succeed.
 */
const RT_NOTIFY_URL = process.env.REALTIME_URL || "http://127.0.0.1:3003/__notify";

export function clientTagFrom(req: NextRequest): string | null {
  return req.headers.get("x-client-tag");
}

export async function notifyRealtime(payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(RT_NOTIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // realtime service unavailable — never block the API response
  }
}

type ActivityGame = { name: string; posterUrl: string | null; coverUrl: string | null };

export function notifyActivity(
  opts: {
    gamer?: string;
    kind: "session" | "finish" | "start" | "rate" | "track";
    game: ActivityGame;
    minutes?: number;
    rating?: number | null;
    clientTag?: string | null;
  }
) {
  return notifyRealtime({
    kind: "activity",
    clientTag: opts.clientTag ?? null,
    activity: {
      scope: "user",
      gamer: opts.gamer ?? "You",
      kind: opts.kind,
      game: opts.game,
      minutes: opts.minutes,
      rating: opts.rating ?? undefined,
      ts: new Date().toISOString(),
    },
  });
}

export function notifyLibraryUpdate(clientTag?: string | null) {
  return notifyRealtime({ kind: "library", clientTag: clientTag ?? null });
}

export function notifyCatalogUpdate(clientTag?: string | null) {
  return notifyRealtime({ kind: "catalog", clientTag: clientTag ?? null });
}
