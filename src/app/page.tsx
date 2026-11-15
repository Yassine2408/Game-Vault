"use client";

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Gamepad2 } from "lucide-react";
import { useState } from "react";
import { LoadError } from "@/components/gaming/Bits";
import { NovaCompanion } from "@/components/gaming/Nova";
import { AppHeader } from "@/components/gaming/AppHeader";
import { DashboardView } from "@/components/gaming/DashboardView";
import { LibraryView } from "@/components/gaming/LibraryView";
import { DiscoverView } from "@/components/gaming/DiscoverView";
import { StatsView } from "@/components/gaming/StatsView";
import { DetailDialog } from "@/components/gaming/DetailDialog";
import { TrackDialog } from "@/components/gaming/TrackDialog";
import { QuickLogDialog } from "@/components/gaming/QuickLogDialog";
import { AuthScreen } from "@/components/gaming/AuthScreen";
import { useUI } from "@/lib/store";
import { api } from "@/lib/client";
import { LiveProvider } from "@/lib/socket";

export default function Home() {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: false } },
      })
  );

  return (
    <QueryClientProvider client={qc}>
      <LiveProvider>
        <MotionConfig reducedMotion="user">
          <AuthGate />
        </MotionConfig>
      </LiveProvider>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const authQ = useQuery({ queryKey: ["auth"], queryFn: api.me, staleTime: 60_000, retry: false });

  if (authQ.isLoading) return <Splash />;
  if (!authQ.data && authQ.isError) {
    return (
      <main className="mx-auto mt-24 w-full max-w-md px-4">
        <LoadError title="Couldn’t check your session" retry={() => void authQ.refetch()} busy={authQ.isFetching} />
      </main>
    );
  }
  if (!authQ.data?.user) return <AuthScreenShell />;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader user={authQ.data.user} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <AppViews />
      </main>

      <Footer />

      {/* dialogs */}
      <DialogsHost />
      <NovaCompanion key={authQ.data.user.id} userId={authQ.data.user.id} />
    </div>
  );
}

function AuthScreenShell() {
  const qc = useQueryClient();
  return <AuthScreen onAuthed={(user) => qc.setQueryData(["auth"], { user })} />;
}

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <motion.span
        animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-2xl shadow-violet-600/40"
      >
        <Gamepad2 className="h-8 w-8" />
      </motion.span>
      <p className="font-display text-lg font-bold tracking-tight">
        Game<span className="text-gradient">Vault</span>
      </p>
      <p className="text-xs text-muted-foreground">waking the vault…</p>
    </div>
  );
}

function AppViews() {
  const view = useUI((s) => s.view);
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {view === "dashboard" && <DashboardView />}
        {view === "library" && <LibraryView />}
        {view === "discover" && <DiscoverView />}
        {view === "stats" && <StatsView />}
      </motion.div>
    </AnimatePresence>
  );
}

function DialogsHost() {
  const { detailGame, trackTarget, quickLog } = useUI();
  const libraryQ = useQuery({ queryKey: ["library"], queryFn: api.library, select: (d) => d.items, enabled: !!detailGame });
  return (
    <>
      {detailGame && <DetailDialog library={libraryQ.data ?? []} />}
      {trackTarget && <TrackDialog />}
      {quickLog && <QuickLogDialog />}
    </>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-border/50 py-5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Gamepad2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-display font-bold text-foreground/80">GameVault</span>

        </div>
        <p className="text-[11px] text-muted-foreground">
          Game data via <a href="https://store.steampowered.com/" className="underline underline-offset-2">Steam</a>. Cover art belongs to its respective studios.
        </p>
      </div>
    </footer>
  );
}
