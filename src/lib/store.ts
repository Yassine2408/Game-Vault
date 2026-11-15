"use client";

import { create } from "zustand";
import type { GameDTO, EntryDTO } from "./dto";

export type View = "dashboard" | "library" | "discover" | "stats";

type UIState = {
  view: View;
  setView: (v: View) => void;
  discoverQuery: string;
  setDiscoverQuery: (q: string) => void;
  detailGame: GameDTO | null;
  openDetail: (g: GameDTO) => void;
  closeDetail: () => void;
  trackTarget: { game: GameDTO; entry: EntryDTO | null; initialStatus?: EntryDTO["status"] } | null;
  openTrack: (game: GameDTO, entry?: EntryDTO | null, initialStatus?: EntryDTO["status"]) => void;
  closeTrack: () => void;
  quickLog: { entry: EntryDTO } | null;
  openQuickLog: (entry: EntryDTO) => void;
  closeQuickLog: () => void;
};

export const useUI = create<UIState>((set) => ({
  view: "dashboard",
  setView: (view) => set({ view }),
  discoverQuery: "",
  setDiscoverQuery: (discoverQuery) => set({ discoverQuery }),
  detailGame: null,
  openDetail: (detailGame) => set({ detailGame }),
  closeDetail: () => set({ detailGame: null }),
  trackTarget: null,
  openTrack: (game, entry = null, initialStatus) => set({ trackTarget: { game, entry, initialStatus }, detailGame: null }),
  closeTrack: () => set({ trackTarget: null }),
  quickLog: null,
  openQuickLog: (entry) => set({ quickLog: { entry }, detailGame: null }),
  closeQuickLog: () => set({ quickLog: null }),
}));
