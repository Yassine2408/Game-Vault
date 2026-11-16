import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { loadNovaVault, localNovaAnswer, proposeNovaAction } from "@/lib/nova-server";
import { streamNovaGateway } from "@/lib/nova-gateway";
import type { NovaEvent } from "@/lib/nova";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const input = z.object({
  mode: z.enum(["chat", "briefing", "dna"]),
  today: z.iso.date(),
  allowExternalAi: z.literal(true).optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(2500),
  })).max(10),
});
const limits = new Map<string, { until: number; count: number }>();

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const result = input.safeParse(await req.json().catch(() => null));
  if (!result.success) return Response.json({ error: "Invalid Nova request" }, { status: 400 });
  const { mode, today, messages, allowExternalAi } = result.data;
  const latest = messages.at(-1);
  if (mode === "chat" && latest?.role !== "user") return Response.json({ error: "Enter a message" }, { status: 400 });
  if (Math.abs(Date.parse(today + "T12:00:00Z") - Date.now()) > 48 * 3600000) {
    return Response.json({ error: "Set your device date and try again" }, { status: 400 });
  }

  const now = Date.now();
  for (const [key, limit] of limits) if (limit.until <= now) limits.delete(key);
  const limit = limits.get(user.id) ?? { until: now + 60000, count: 0 };
  if (limit.count >= 8) return Response.json({ error: "Nova is taking a short break. Try again in a minute." }, { status: 429 });
  limit.count++;
  limits.set(user.id, limit);

  const vault = await loadNovaVault(user.id);
  const proposal = mode === "chat" && latest ? await proposeNovaAction(latest.text, vault, user.id, today) : null;
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: NovaEvent) => {
        if (!cancelled && !req.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      async function sendLocal() {
        const answer = localNovaAnswer(mode, latest?.text ?? "", vault);
        for (const chunk of answer.match(/[\s\S]{1,28}/g) ?? []) {
          if (cancelled || req.signal.aborted) return;
          send({ type: "text", text: chunk });
          await new Promise((resolve) => setTimeout(resolve, 18));
        }
      }
      try {
        if (proposal) {
          send({ type: "text", text: proposal.text });
          if (proposal.plan) send({ type: "plan", plan: proposal.plan });
          return;
        }
        if (!vault.entries.length && mode !== "chat") {
          send({ type: "notice", text: "Track a game or log a session to give Nova something to analyze." });
          return;
        }
        if (allowExternalAi === true) {
          let received = false;
          try {
            for await (const text of streamNovaGateway(req, mode, messages, vault, today)) {
              received = true;
              send({ type: "text", text });
            }
            if (received) return;
          } catch (error) {
            if (cancelled || req.signal.aborted) return;
            const code = error instanceof Error && /^gateway-[a-z0-9-]+$/.test(error.message) ? error.message : "gateway-interrupted";
            console.warn("Nova gateway:", code);
            if (received) {
              send({ type: "notice", text: "The AI response was interrupted. Try again." });
              return;
            }
          }
          send({ type: "notice", text: "External AI is unavailable. Here’s an answer from GameVault’s built-in rules." });
        }
        await sendLocal();
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
