"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { format } from "date-fns";
import { ArrowUpRight, Check, ChevronRight, Dna, LoaderCircle, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { readLines, type NovaEvent, type NovaMode, type NovaPlan } from "@/lib/nova";
import { getClientTag } from "@/lib/socket";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; text: string; plan?: NovaPlan; notice?: string; id: string };
const useNova = create<{ open: boolean; draft: string; show: (draft: string) => void; close: () => void }>((set) => ({
  open: false, draft: "", show: (draft) => set({ open: true, draft }), close: () => set({ open: false }),
}));

async function askNova(mode: NovaMode, messages: Pick<Message, "role" | "text">[], onEvent: (event: NovaEvent) => void, signal: AbortSignal) {
  const res = await fetch("/api/nova", {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, today: format(new Date(), "yyyy-MM-dd"), messages }),
  });
  if (!res.ok || !res.body) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error ?? "Nova couldn’t respond. Try again.");
  }
  for await (const line of readLines(res.body)) if (line) onEvent(JSON.parse(line) as NovaEvent);
}

function refreshVault(query: QueryClient) {
  return Promise.all(["library", "stats", "games", "facets"].map((key) => query.invalidateQueries({ queryKey: [key] })));
}

function PlanCard({ plan, onSaved }: { plan: NovaPlan; onSaved: () => void }) {
  const query = useQueryClient();
  const [status, setStatus] = useState<"review" | "saving" | "saved" | "dismissed">("review");
  const [error, setError] = useState("");
  const saving = useRef(false);
  async function apply() {
    if (saving.current || status !== "review") return;
    saving.current = true;
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/nova/apply", {
        method: "POST", headers: { "Content-Type": "application/json", "x-client-tag": getClientTag() },
        body: JSON.stringify({ token: plan.token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn’t apply this plan.");
      }
      setStatus("saved");
      onSaved();
      await refreshVault(query);
    } catch (err) {
      setStatus("review");
      setError(err instanceof Error ? err.message : "Couldn’t apply this plan.");
    } finally {
      saving.current = false;
    }
  }
  const date = format(new Date(plan.date + "T12:00:00"), "MMM d, yyyy");
  if (status === "dismissed") return <p className="text-xs text-muted-foreground">Plan dismissed</p>;
  return (
    <div className="rounded-xl border border-primary/35 bg-primary/10 p-3">
      <p className="font-semibold">{plan.kind === "session" ? `Log ${plan.minutes} minutes` : "Mark as completed"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{plan.game} · {date}{plan.kind === "finish" && plan.rating !== undefined ? ` · ${plan.rating}/10` : ""}</p>
      {status === "saved" ? (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-xs font-semibold"><Check className="size-4" /> Saved to your vault</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={status === "saving"} onClick={() => void apply()}>{status === "saving" ? "Saving…" : "Apply"}</Button>
          <Button size="sm" variant="ghost" disabled={status === "saving"} onClick={() => setStatus("dismissed")}>Dismiss</Button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs">{error}</p>}
    </div>
  );
}

export function NovaCompanion({ userId }: { userId: string }) {
  const query = useQueryClient();
  const channel = useRef<BroadcastChannel>(null);
  const { open, draft, show, close } = useNova();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setText(draft); }, [open, draft]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const sync = new BroadcastChannel(`gamevault:nova:${userId}`);
    sync.onmessage = (event) => { if (event.data === "saved") void refreshVault(query); };
    channel.current = sync;
    return () => { channel.current = null; sync.close(); };
  }, [query, userId]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages, open]);
  useEffect(() => () => { active.current?.abort(); close(); }, [close]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = text.trim();
    if (!prompt || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const user: Message = { id: crypto.randomUUID(), role: "user", text: prompt };
    const reply: Message = { id: crypto.randomUUID(), role: "assistant", text: "" };
    const history = [...messages.filter((item) => item.text && !item.notice), user]
      .slice(-10).map((item) => ({ role: item.role, text: item.text.slice(0, 2500) }));
    setMessages((items) => [...items, user, reply]);
    setText("");
    setBusy(true);
    function update(patch: (message: Message) => Message) {
      setMessages((items) => items.map((item) => item.id === reply.id ? patch(item) : item));
    }
    try {
      await askNova("chat", history, (event) => update((item) => {
        switch (event.type) {
          case "plan": return { ...item, plan: event.plan };
          case "notice": return { ...item, notice: event.text };
          case "text": return { ...item, text: item.text + event.text };
        }
      }), controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) update((item) => ({ ...item, notice: error instanceof Error ? error.message : "Nova couldn’t respond." }));
    } finally {
      active.current = null;
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => next ? show("") : close()}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Open Nova companion" className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full border border-violet-200/50 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-700 text-white shadow-[0_0_28px_#a855f799] transition motion-safe:hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 sm:bottom-7 sm:right-7">
          <Sparkles aria-hidden="true" className="size-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="grid h-[min(660px,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-3xl p-0 sm:left-auto sm:right-6 sm:max-w-md sm:translate-x-0">
        <header className="border-b border-border bg-primary/10 px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 font-display text-xl"><Sparkles aria-hidden="true" className="size-5 text-primary" /> Nova</DialogTitle>
          <DialogDescription className="mt-1 text-xs">Ask about your vault or propose an update.</DialogDescription>
        </header>
        <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-4" aria-label="Nova conversation">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">What are we playing next?</p>
              {["What should I play next?", "Log 90 minutes on Hades II today", "Finished Elden Ring last night, 9/10"].map((prompt) => (
                <button key={prompt} type="button" onClick={() => setText(prompt)} className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left text-xs hover:bg-muted">
                  {prompt}<ChevronRight aria-hidden="true" className="size-4 shrink-0" />
                </button>
              ))}
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id} className={cn("max-w-[93%] space-y-2 rounded-2xl px-3 py-2.5 text-sm", message.role === "user" ? "ml-auto bg-primary/15" : "bg-muted/60")}>
              <p className="text-[11px] font-bold text-muted-foreground">{message.role === "user" ? "You" : "Nova"}</p>
              {message.text && <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>}
              {message.notice && <p role="status" className="text-xs text-muted-foreground">{message.notice}</p>}
              {message.plan && <PlanCard plan={message.plan} onSaved={() => channel.current?.postMessage("saved")} />}
              {!message.text && !message.notice && busy && <p role="status" className="text-xs text-muted-foreground">Thinking…</p>}
            </div>
          ))}
          <div ref={bottom} />
        </div>
        <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-border p-4">
          <Input aria-label="Message Nova" placeholder="Ask Nova about your vault…" value={text} maxLength={2500} onChange={(event) => setText(event.target.value)} className="min-w-0" />
          <Button type="submit" aria-label="Send message" size="icon" disabled={busy || !text.trim()}>
            {busy ? <LoaderCircle className="motion-safe:animate-spin" /> : <Send />}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NovaInsight({ mode }: { mode: "briefing" | "dna" }) {
  const show = useNova((state) => state.show);
  const [response, setResponse] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController>(null);
  useEffect(() => () => active.current?.abort(), []);
  const briefing = mode === "briefing";
  const Icon = briefing ? Sparkles : Dna;

  async function generate() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setNotice("");
    setResponse("");
    try {
      await askNova(mode, [], (event) => {
        if (event.type === "text") setResponse((current) => current + event.text);
        if (event.type === "notice") setNotice(event.text);
      }, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Nova couldn’t respond.");
    } finally {
      active.current = null;
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
          <div>
            <h2 className="font-display text-lg font-bold">{briefing ? "Vault Mind" : "Gamer DNA"}</h2>
            <p className="text-xs text-muted-foreground">{briefing ? "Your daily briefing and next quest." : "Your gaming persona, based on what you actually play."}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void generate()}>
          {busy ? <><LoaderCircle className="motion-safe:animate-spin" /> Analyzing…</> : response ? "Refresh" : briefing ? "Get briefing" : "Analyze my vault"}
        </Button>
      </div>
      {response && <p className="mt-4 max-w-3xl whitespace-pre-wrap break-words text-sm leading-relaxed">{response}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-muted-foreground">{notice}</p>}
      <Button size="sm" variant="ghost" className="mt-3" onClick={() => show(briefing
        ? "Look at my recent play patterns and suggest my next quest. Explain why it fits."
        : "What is my gaming persona? Cite games from my vault and explain my strongest traits.")}>
        Deep dive with Nova <ArrowUpRight aria-hidden="true" />
      </Button>
    </section>
  );
}
