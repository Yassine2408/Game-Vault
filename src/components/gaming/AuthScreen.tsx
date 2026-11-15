"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Gamepad2, Mail, User, Lock, Trophy, BookmarkCheck, Timer, Sparkles,
  Eye, EyeOff, ArrowRight, Zap, ShieldCheck, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import type { AuthUser } from "@/lib/client";
import { useLive } from "@/lib/socket";
import { GamePoster } from "./GamePoster";
import { LiveDot } from "./Bits";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/*  Left hero — brand, features, floating poster collage, live pulse  */
/* ------------------------------------------------------------------ */

type CollageGame = { id: string; name: string; posterUrl: string | null; coverUrl: string | null };

function PosterRow({ items, tilt, duration, reverse, baseDelay }: { items: CollageGame[]; tilt: number; duration: number; reverse?: boolean; baseDelay: number }) {
  return (
    <motion.div
      animate={{ x: reverse ? ["-4%", "4%", "-4%"] : ["4%", "-4%", "4%"], y: tilt ? [0, -8, 0] : [0, 8, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      className="flex gap-3"
      style={{ rotate: tilt }}
    >
      {items.map((g, i) => (
        <motion.div
          key={g.id}
          initial={{ opacity: 0, scale: 0.8, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: baseDelay + i * 0.08, duration: 0.6, ease: EASE }}
          className="w-[104px] shrink-0 sm:w-[124px]"
        >
          <div className="overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/50">
            <GamePoster src={g.posterUrl ?? g.coverUrl} name={g.name} className="aspect-[3/4] w-full" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function FloatingPosters() {
  const gamesQ = useQuery({
    queryKey: ["auth-collage"],
    queryFn: () => api.games({ pageSize: 14, sort: "critic" }),
    staleTime: 60_000,
  });
  const games = (gamesQ.data?.items ?? []) as CollageGame[];
  const rowA = games.slice(0, 7);
  const rowB = games.slice(7, 14);

  if (!games.length) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="pointer-events-none relative space-y-4 overflow-hidden py-6 [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
      <PosterRow items={rowA} tilt={-2.5} duration={9} baseDelay={0.25} />
      <PosterRow items={rowB} tilt={2} duration={11} reverse baseDelay={0.55} />
    </div>
  );
}

function HeroPanel() {
  const { connected, presence, activity, trending } = useLive();

  return (
    <div className="relative hidden min-w-0 flex-col justify-center gap-8 pr-10 lg:flex">
      {/* glow blobs */}
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-64 w-64 rounded-full bg-fuchsia-600/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300">
          <Sparkles className="h-3.5 w-3.5" />
          Live data · real-time sync · Steam powered
        </span>
        <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl">
          Every game you play.
          <br />
          <span className="text-gradient">One vault. One story.</span>
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
          Mark what you've <span className="font-semibold text-emerald-300">finished</span> and when, track what you're{" "}
          <span className="font-semibold text-violet-300">playing right now</span>, log sessions, rate games and watch your
          gaming life unfold — with live player counts pushed straight to your screen.
        </p>

        <ul className="mt-7 space-y-3.5">
          {[
            { icon: BookmarkCheck, color: "bg-emerald-500/15 text-emerald-300", title: "Finish & date it", sub: "Completion dates, ratings, favorites, notes" },
            { icon: Timer, color: "bg-violet-500/15 text-violet-300", title: "Sessions & playtime", sub: "Log every session, hours add up automatically" },
            { icon: Trophy, color: "bg-amber-500/15 text-amber-300", title: "Live Steam pulse", sub: "Concurrent players & trending charts, streaming in" },
          ].map((f, i) => (
            <motion.li
              key={f.title}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: EASE }}
              className="flex items-center gap-3.5"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", f.color)}>
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.sub}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      <FloatingPosters />

      {/* live pulse strip */}
      <div className="relative flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
          <LiveDot active={connected} />
          {connected ? `${presence} gamers online` : "connecting to live service…"}
        </span>
        {trending[0] && (
          <span className="inline-flex max-w-[280px] items-center gap-1.5 truncate rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 shrink-0 text-amber-400" />
            <span className="truncate">
              #1 now: <span className="font-semibold text-foreground">{trending[0].name}</span>
              <span className="ml-1 text-emerald-400">{trending[0].players.toLocaleString("en-US")} playing</span>
            </span>
          </span>
        )}
        {activity[0] && (
          <motion.span
            key={activity[0].id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden max-w-[260px] truncate rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground xl:inline-block"
          >
            {activity[0].gamer} {activity[0].kind === "finish" ? "finished" : activity[0].kind === "start" ? "started" : "played"}{" "}
            <span className="font-semibold text-foreground">{activity[0].game.name}</span>
          </motion.span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Right panel — the auth card                                       */
/* ------------------------------------------------------------------ */

function pwStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; tone: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  const meta = [
    { label: "Too weak", tone: "bg-rose-500" },
    { label: "Weak", tone: "bg-rose-400" },
    { label: "Okay", tone: "bg-amber-400" },
    { label: "Good", tone: "bg-emerald-400" },
    { label: "Strong", tone: "bg-emerald-400" },
  ][s];
  return { score: s as 0 | 1 | 2 | 3 | 4, label: meta.label, tone: meta.tone };
}

function Field({
  icon: Icon,
  label,
  error,
  children,
}: {
  icon: typeof Mail;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-1 text-[11px] font-medium text-rose-400">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-border/70 bg-muted/30 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-500/25";

function AuthCard({ onAuthed }: { onAuthed: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<null | "login" | "register">(null);
  const [formError, setFormError] = useState<string | null>(null);

  // login fields
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // register fields
  const [rUsername, setRUsername] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rDisplayName, setRDisplayName] = useState("");
  const [rPassword, setRPassword] = useState("");

  const strength = useMemo(() => pwStrength(rPassword), [rPassword]);

  const validateRegister = (): string | null => {
    if (rUsername.length < 3 || rUsername.length > 20) return "Username must be 3–20 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(rUsername)) return "Username: only letters, numbers and underscores";
    if (!/^\S+@\S+\.\S+$/.test(rEmail)) return "Enter a valid email address";
    if (rPassword.length < 8) return "Password must be at least 8 characters";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (mode === "login") {
        if (!identifier.trim()) return setFormError("Enter your email or username");
        if (!password) return setFormError("Enter your password");
        setBusy("login");
        const { user } = await api.login(identifier.trim(), password);
        onAuthed(user);
        toast(`Welcome back, ${user.displayName}`, { description: "Your vault is live and synced." });
      } else {
        const err = validateRegister();
        if (err) return setFormError(err);
        setBusy("register");
        const { user } = await api.register({
          username: rUsername.trim(),
          email: rEmail.trim(),
          password: rPassword,
          displayName: rDisplayName.trim() || undefined,
        });
        onAuthed(user);
        toast(`Vault created — welcome, ${user.displayName}!`, { description: "Start tracking your first game now." });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };



  const switchMode = (m: Mode) => {
    setMode(m);
    setFormError(null);
  };

  return (
    <div className="glass relative w-full max-w-md rounded-3xl p-6 shadow-2xl shadow-black/40 sm:p-8">
      {/* brand (mobile) */}
      <div className="mb-6 flex items-center gap-3 lg:hidden">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30">
          <Gamepad2 className="h-5 w-5" />
        </span>
        <span className="font-display text-xl font-bold tracking-tight">
          Game<span className="text-gradient">Vault</span>
        </span>
      </div>

      {/* tabs */}
      <div className="relative mb-6 grid grid-cols-2 rounded-xl border border-border/60 bg-muted/20 p-1">
        {(["login", "register"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={cn(
              "relative z-10 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              mode === m ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {mode === m && (
              <motion.span
                layoutId="auth-tab"
                className="absolute inset-0 -z-10 rounded-lg bg-primary/20 shadow-inner"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, x: mode === "login" ? -16 : 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: mode === "login" ? 16 : -16 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          <h2 className="font-display text-2xl font-bold tracking-tight">
            {mode === "login" ? "Back to the vault" : "Forge your vault"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to your gaming journal — everything is waiting."
              : "One account, every game you'll ever finish."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {mode === "login" ? (
              <>
                <Field icon={User} label="Email or username">
                  <input
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="gamer@gamevault.app"
                    className={inputCls}
                  />
                </Field>
                <Field icon={Lock} label="Password">
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field icon={User} label="Username">
                    <input
                      type="text"
                      autoComplete="username"
                      value={rUsername}
                      onChange={(e) => setRUsername(e.target.value.replace(/\s/g, ""))}
                      placeholder="nightowl_77"
                      className={inputCls}
                    />
                  </Field>
                  <Field icon={Sparkles} label="Display name">
                    <input
                      type="text"
                      autoComplete="nickname"
                      value={rDisplayName}
                      onChange={(e) => setRDisplayName(e.target.value)}
                      placeholder="Night Owl"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field icon={Mail} label="Email">
                  <input
                    type="email"
                    autoComplete="email"
                    value={rEmail}
                    onChange={(e) => setREmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls}
                  />
                </Field>
                <Field icon={Lock} label="Password">
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      value={rPassword}
                      onChange={(e) => setRPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                {rPassword && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={cn("h-1 flex-1 rounded-full transition-colors", i < strength.score ? strength.tone : "bg-muted")}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground">{strength.label}</span>
                  </motion.div>
                )}
              </>
            )}

            <AnimatePresence>
              {formError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs font-medium text-rose-300"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {formError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              disabled={busy !== null}
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-sm font-bold text-white shadow-lg shadow-violet-600/30 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy === "login" || busy === "register" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Sign in" : "Create my vault"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </motion.button>
          </form>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Passwords hashed with bcrypt · sessions in httpOnly cookies · data on PostgreSQL
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function AuthScreen({ onAuthed }: { onAuthed: (u: AuthUser) => void }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      {/* animated aurora background */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ x: [0, 60, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-violet-700/25 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -70, 0], y: [0, 50, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-24 top-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-700/20 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-emerald-600/15 blur-3xl"
        />
        {/* grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <HeroPanel />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex min-w-0 justify-center lg:justify-end"
        >
          <AuthCard onAuthed={onAuthed} />
        </motion.div>
      </div>
    </div>
  );
}
