"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Gamepad2, LayoutDashboard, Library, Compass, BarChart3, Search, Moon, Sun, LogOut, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUI, type View } from "@/lib/store";
import { useLive } from "@/lib/socket";
import { api, type AuthUser } from "@/lib/client";
import { LiveDot } from "./Bits";
import { cn } from "@/lib/utils";

const NAV: { key: View; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "library", label: "Library", icon: Library },
  { key: "discover", label: "Discover", icon: Compass },
  { key: "stats", label: "Stats", icon: BarChart3 },
];

const ACCENT_BG: Record<string, string> = {
  violet: "from-violet-600 to-fuchsia-600",
  emerald: "from-emerald-600 to-teal-600",
  amber: "from-amber-500 to-orange-600",
  rose: "from-rose-600 to-pink-600",
  cyan: "from-teal-500 to-cyan-600",
};

function UserMenu({ user }: { user: AuthUser }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      await api.logout();
      qc.setQueryData(["auth"], { user: null });
      qc.removeQueries({ queryKey: ["library"] });
      qc.removeQueries({ queryKey: ["stats"] });
      qc.removeQueries({ queryKey: ["facets"] });
      qc.removeQueries({ queryKey: ["games"] });
      useUI.setState({ view: "dashboard", discoverQuery: "", detailGame: null, trackTarget: null, quickLog: null });
      toast("Signed out", { description: "See you at the next save point." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t sign out");
    } finally {
      setBusy(false);
    }
  };

  const initial = (user.displayName || user.username)[0]?.toUpperCase() ?? "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 py-1 pl-1 pr-2.5 transition-colors hover:bg-muted/50"
          aria-label="Account menu"
        >
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white",
              ACCENT_BG[user.accent] ?? ACCENT_BG.violet
            )}
          >
            {initial}
          </span>
          <span className="hidden max-w-[120px] truncate text-xs font-semibold sm:block">{user.displayName}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-display font-bold">{user.displayName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">@{user.username}</span>
          <span className="truncate text-[11px] font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} disabled={busy} className="text-rose-400 focus:text-rose-300">
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LivePill() {
  const { connected, presence } = useLive();
  return (
    <span
      className={cn(
        "hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold sm:inline-flex",
        connected ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-border/60 bg-muted/30 text-muted-foreground"
      )}
      title={connected ? "Realtime connection active" : "Connecting to realtime service…"}
    >
      <LiveDot active={connected} />
      {connected ? `${presence} online` : "connecting…"}
    </span>
  );
}

export function AppHeader({ user }: { user: AuthUser }) {
  const { view, setView, setDiscoverQuery } = useUI();
  const [q, setQ] = useState("");
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* brand */}
        <button onClick={() => setView("dashboard")} className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30">
            <Gamepad2 className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Game<span className="text-gradient">Vault</span>
          </span>
        </button>

        {/* nav */}
        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {NAV.map((n) => {
            const active = view === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-primary/15"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <n.icon className={cn("relative h-4 w-4", active && "text-primary")} />
                <span className="relative">{n.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          <LivePill />
          {/* global search → discover */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setDiscoverQuery(q);
              setView("discover");
            }}
            className="relative min-w-0"
          >
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search games..."
              className="h-9 w-full min-w-0 border-border/60 bg-muted/30 pl-8 text-sm sm:w-40 lg:w-52"
              aria-label="Search games"
            />
          </form>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </Button>
          <UserMenu user={user} />
        </div>
      </div>

      {/* mobile nav */}
      <nav className="no-scrollbar flex gap-1 overflow-x-auto px-4 pb-2 md:hidden" aria-label="Mobile navigation">
        {NAV.map((n) => {
          const active = view === n.key;
          return (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
                aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                active ? "bg-primary/15 text-primary" : "text-muted-foreground"
              )}
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
