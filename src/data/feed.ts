import { useSyncExternalStore } from "react";

import { bridge, SECONDARY_SCREEN } from "./bridge";

export type FeedItem = { id: string; app: string; title: string; body: string; at: string };

const KEY = "sorvia.feed";
const listeners = new Set<() => void>();

function load(): FeedItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as FeedItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

let items: FeedItem[] = load();
let badges: Record<string, number> = {};

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pushFeed(item: Omit<FeedItem, "id" | "at">, entry?: FeedItem) {
  const full = entry ?? { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString() };
  if (items.some((existing) => existing.id === full.id)) return;
  items = [full, ...items].slice(0, 40);
  if (!entry) bridge.system.shareState("feed", full);
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    void 0;
  }
  emit();
}

export function clearFeed() {
  items = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    void 0;
  }
  emit();
}

export function setWebBadge(app: string, count: number, remote = false) {
  if ((badges[app] ?? 0) === count) return;
  badges = { ...badges, [app]: count };
  if (!remote) bridge.system.shareState("badge", { app, count });
  emit();
}

export function useFeed() {
  return useSyncExternalStore(subscribe, () => items);
}

export function useWebBadges() {
  return useSyncExternalStore(subscribe, () => badges);
}

export type NowPlaying = { app: string; title: string; artist: string; artwork: string | null; playing: boolean };

let playing: NowPlaying | null = null;
const controllers = new Map<string, (action: string) => void>();

export function setNowPlaying(app: string, state: Omit<NowPlaying, "app"> | null, remote = false) {
  if (!remote) bridge.system.shareState("playing", { app, state });
  if (!state) {
    if (playing?.app === app) {
      playing = null;
      emit();
    }
    return;
  }
  if (playing && playing.app !== app && playing.playing && !state.playing) return;
  playing = { app, ...state };
  emit();
}

export function registerMediaControl(app: string, control: ((action: string) => void) | null) {
  if (control) controllers.set(app, control);
  else controllers.delete(app);
}

export function mediaControl(action: "play" | "pause" | "previoustrack" | "nexttrack") {
  if (!playing) return;
  const local = controllers.get(playing.app);
  if (local) local(action);
  else bridge.system.shareState("media-control", { app: playing.app, action });
}

bridge.system.onSharedState(({ kind, payload }) => {
  const value = payload as Record<string, unknown>;
  if (kind === "feed") pushFeed(value as unknown as FeedItem, value as unknown as FeedItem);
  else if (kind === "badge") setWebBadge(String(value.app), Number(value.count) || 0, true);
  else if (kind === "playing") setNowPlaying(String(value.app), (value.state as Omit<NowPlaying, "app"> | null) ?? null, true);
  else if (kind === "media-control") controllers.get(String(value.app))?.(String(value.action));
  else if (kind === "sync-request" && !SECONDARY_SCREEN) {
    if (playing) bridge.system.shareState("playing", { app: playing.app, state: { title: playing.title, artist: playing.artist, artwork: playing.artwork, playing: playing.playing } });
    for (const [app, count] of Object.entries(badges)) bridge.system.shareState("badge", { app, count });
  }
});

if (SECONDARY_SCREEN) setTimeout(() => bridge.system.shareState("sync-request", null), 1500);

export function useNowPlaying() {
  return useSyncExternalStore(subscribe, () => playing);
}
