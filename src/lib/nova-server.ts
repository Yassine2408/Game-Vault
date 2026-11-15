import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { db } from "@/lib/db";
import { novaAction, type NovaMode } from "./nova";

const planClaims = z.object({
  sub: z.string(), jti: z.uuid(), entryId: z.string(),
  date: z.iso.date(), version: z.iso.datetime(), action: novaAction,
});

function signingKey() {
  if (!process.env.AUTH_SECRET) throw new Error("Session signing is not configured");
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

export async function signNovaPlan(claims: z.infer<typeof planClaims>) {
  return new SignJWT(claims).setProtectedHeader({ alg: "HS256" })
    .setIssuer("gamevault-nova").setAudience("nova-apply").setIssuedAt()
    .setExpirationTime("10m").sign(signingKey());
}

export async function verifyNovaPlan(token: string, userId: string) {
  try {
    const result = await jwtVerify(token, signingKey(), {
      issuer: "gamevault-nova", audience: "nova-apply", subject: userId, algorithms: ["HS256"],
    });
    return planClaims.parse(result.payload);
  } catch {
    return null;
  }
}

export async function loadNovaVault(userId: string) {
  const [entries, sessions] = await Promise.all([
    db.libraryEntry.findMany({
      where: { userId }, orderBy: { updatedAt: "desc" }, take: 150,
      select: {
        id: true, status: true, rating: true, hoursPlayed: true, favorite: true,
        startDate: true, finishDate: true, updatedAt: true,
        game: { select: { name: true, criticScore: true, genres: { select: { genre: { select: { name: true } } } } } },
      },
    }),
    db.playSession.findMany({
      where: { userId }, orderBy: { playedOn: "desc" }, take: 20,
      select: { minutes: true, playedOn: true, game: { select: { name: true } } },
    }),
  ]);
  return { entries, sessions };
}

type Vault = Awaited<ReturnType<typeof loadNovaVault>>;
const normalize = (name: string) => name.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export async function proposeNovaAction(message: string, vault: Vault, userId: string, today: string) {
  const log = message.match(/^(?:please\s+)?(?:log|played|record)\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|h|m)\s+(?:on\s+|of\s+)?(.+?)\s*[.!]?$/i);
  const finish = message.match(/^(?:please\s+)?(?:i\s+)?(?:finished|completed|beat|mark as completed)\s+(.+?)\s*[.!]?$/i);
  if (!log && !finish) return null;
  let title = (log?.[3] ?? finish?.[1] ?? "").trim();
  const score = finish ? title.match(/[,\s]+(\d+)\s*\/\s*10$/) : null;
  if (score) title = title.slice(0, score.index).trim();
  const dateSuffix = title.match(/\s+(today|yesterday|last night|\d{4}-\d{2}-\d{2})$/i);
  if (dateSuffix) title = title.slice(0, dateSuffix.index).trim();
  const relative = dateSuffix?.[1]?.toLowerCase();
  const date = relative === "yesterday" || relative === "last night"
    ? new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10)
    : relative && relative !== "today" ? relative : today;

  const action = novaAction.safeParse(log
    ? { kind: "session", minutes: Math.round(Number(log[1]) * (/^h/i.test(log[2]) ? 60 : 1)) }
    : { kind: "finish", rating: score ? Number(score[1]) : undefined });
  if (!action.success || !z.iso.date().safeParse(date).success || date > today) {
    return { text: "Use 1–1,440 minutes, a date no later than today, and a whole-number rating from 0 to 10." };
  }
  const query = normalize(title);
  const exact = vault.entries.filter((entry) => normalize(entry.game.name) === query);
  const matches = exact.length ? exact : vault.entries.filter((entry) => query.length >= 3 && normalize(entry.game.name).includes(query));
  if (matches.length !== 1) {
    return { text: matches.length ? `Which game did you mean? Try the full title: ${matches.slice(0, 5).map((entry) => entry.game.name).join(", ")}.`
      : `I couldn’t find “${title}” in your library. Track it in Discover first, then try again.` };
  }
  const entry = matches[0];
  const token = await signNovaPlan({
    sub: userId, jti: crypto.randomUUID(), entryId: entry.id,
    version: entry.updatedAt.toISOString(), date, action: action.data,
  });
  return { text: "Here’s the update I understood. Review it and click Apply to save it.",
    plan: { ...action.data, game: entry.game.name, date, token } };
}

export function localNovaAnswer(mode: NovaMode, prompt: string, vault: Vault) {
  const { entries, sessions } = vault;
  if (entries.length === 0) return "Track a game or log a session to give Nova something to analyze.";
  const backlog = entries.filter((entry) => entry.status === "BACKLOG")
    .sort((a, b) => (b.game.criticScore ?? -1) - (a.game.criticScore ?? -1));
  const next = backlog[0] ?? entries.find((entry) => entry.status === "PLAYING");
  const mostPlayed = [...entries].sort((a, b) => b.hoursPlayed - a.hoursPlayed)[0];
  const mostRecent = sessions[0];
  const finished = entries.filter((entry) => entry.status === "COMPLETED").length;
  const time = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
  const score = (entry: Vault["entries"][number]) => entry.game.criticScore == null
    ? "No Metacritic score recorded" : `Metacritic ${entry.game.criticScore}/100`;
  const quest = next
    ? `Next quest: ${next.game.name}. ${score(next)}. ${next.status === "BACKLOG" ? "It’s the highest-scored game in your backlog." : "You already have it in progress."}`
    : "Next quest: save a game to your backlog to get a pick.";
  const pattern = mostRecent
    ? `Latest session: ${mostRecent.minutes} minutes in ${mostRecent.game.name} on ${mostRecent.playedOn.toISOString().slice(0, 10)}.`
    : "No sessions logged yet.";
  if (mode === "briefing") {
    return `${pattern}\n\n${finished} completed · ${backlog.length} in your backlog.\n\n${quest}`;
  }
  if (mode === "dna" || /persona|gamer dna|strongest traits/i.test(prompt)) {
    const genres = new Map<string, number>();
    for (const entry of entries) for (const { genre } of entry.game.genres) genres.set(genre.name, (genres.get(genre.name) ?? 0) + 1);
    const [genre, count] = [...genres].sort((a, b) => b[1] - a[1])[0] ?? [];
    const favorite = entries.filter((entry) => entry.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    return [
      genre ? `The ${genre} Explorer` : "The Vault Explorer",
      genre ? `Genre affinity: ${count} tracked ${genre} ${count === 1 ? "game" : "games"}.` : "Your vault is still taking shape.",
      mostPlayed.hoursPlayed > 0 ? `Time invested: ${time.format(mostPlayed.hoursPlayed)} hours in ${mostPlayed.game.name}, your most-played tracked game.` : pattern,
      favorite ? `Your top rating: ${favorite.game.name} at ${favorite.rating}/10.` : `${finished} finished out of ${entries.length} recently updated games.`,
    ].join("\n\n");
  }
  if (/recen(t|tly)|patterns|briefing|sessions/i.test(prompt)) return `${pattern}\n\n${quest}`;
  const found = [...entries].sort((a, b) => b.game.name.length - a.game.name.length)
    .find((entry) => normalize(entry.game.name).length >= 3 && normalize(prompt).includes(normalize(entry.game.name)));
  if (found) {
    return `${found.game.name} is ${found.status.toLowerCase().replaceAll("_", " ")} in your vault. You’ve logged ${time.format(found.hoursPlayed)} hours. ${score(found)}.${found.rating != null ? ` Your rating is ${found.rating}/10.` : ""}${found.finishDate ? ` Finished on ${found.finishDate.toISOString().slice(0, 10)}.` : ""}`;
  }
  if (/play next|backlog|recommend|next quest/i.test(prompt)) return backlog.length > 1
    ? `${quest}\n\nAlso in your backlog: ${backlog.slice(1, 4).map((entry) => `${entry.game.name} (${score(entry)})`).join(", ")}.`
    : quest;
  return `I can summarize your vault, check a tracked game, pick from your backlog, or prepare an update.\n\n${quest}`;
}
