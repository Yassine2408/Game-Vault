import { z } from "zod";

export const novaAction = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("session"), minutes: z.number().int().min(1).max(1440) }),
  z.object({ kind: z.literal("finish"), rating: z.number().int().min(0).max(10).optional() }),
]);

export type NovaPlan = z.infer<typeof novaAction> & { game: string; date: string; token: string };
export type NovaMode = "chat" | "briefing" | "dna";
export type NovaEvent =
  | { type: "text"; text: string }
  | { type: "plan"; plan: NovaPlan }
  | { type: "notice"; text: string };

export async function* readLines(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) yield line.replace(/\r$/, "");
      if (done) {
        if (pending) yield pending;
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
