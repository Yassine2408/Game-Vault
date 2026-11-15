import type { EntryStatus } from "@prisma/client";

export const STATUS_ORDER: EntryStatus[] = ["PLAYING", "COMPLETED", "ON_HOLD", "BACKLOG", "WISHLIST", "DROPPED"];

export const STATUS_CONFIG: Record<
  EntryStatus,
  { label: string; verb: string; color: string; bg: string; border: string; dot: string; icon: string; desc: string }
> = {
  PLAYING: {
    label: "Playing",
    verb: "Started playing",
    color: "text-violet-300",
    bg: "bg-violet-500/15",
    border: "border-violet-400/30",
    dot: "bg-violet-400",
    icon: "Gamepad2",
    desc: "Games you're playing right now",
  },
  COMPLETED: {
    label: "Finished",
    verb: "Finished",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    border: "border-emerald-400/30",
    dot: "bg-emerald-400",
    icon: "CheckCircle2",
    desc: "Games you ended — with the date you beat them",
  },
  ON_HOLD: {
    label: "On Hold",
    verb: "Paused",
    color: "text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-400/30",
    dot: "bg-amber-400",
    icon: "PauseCircle",
    desc: "Paused mid-story — you'll come back",
  },
  BACKLOG: {
    label: "Backlog",
    verb: "Added to backlog",
    color: "text-zinc-300",
    bg: "bg-zinc-500/15",
    border: "border-zinc-400/30",
    dot: "bg-zinc-400",
    icon: "Layers",
    desc: "Owned or planned, waiting to be started",
  },
  WISHLIST: {
    label: "Wishlist",
    verb: "Wishlisted",
    color: "text-fuchsia-300",
    bg: "bg-fuchsia-500/15",
    border: "border-fuchsia-400/30",
    dot: "bg-fuchsia-400",
    icon: "Heart",
    desc: "Want to buy / play someday",
  },
  DROPPED: {
    label: "Dropped",
    verb: "Dropped",
    color: "text-rose-300",
    bg: "bg-rose-500/15",
    border: "border-rose-400/30",
    dot: "bg-rose-400",
    icon: "XCircle",
    desc: "Tried it, decided to move on",
  },
};

export const PLATFORM_ICONS: Record<string, string> = {
  pc: "Monitor",
  "nintendo-switch": "Gamepad2",
  "playstation-4": "Gamepad2",
  "playstation-5": "Gamepad2",
  "xbox-one": "Gamepad2",
  "xbox-series-x|s": "Gamepad2",
  mobile: "Smartphone",
};
