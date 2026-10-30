import { useSyncExternalStore } from "react";

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

export function pushFeed(item: Omit<FeedItem, "id" | "at">) {
  items = [{ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString() }, ...items].slice(0, 40);
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

export function setWebBadge(app: string, count: number) {
  if ((badges[app] ?? 0) === count) return;
  badges = { ...badges, [app]: count };
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

export function setNowPlaying(app: string, state: Omit<NowPlaying, "app"> | null) {
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
  if (playing) controllers.get(playing.app)?.(action);
}

export function useNowPlaying() {
  return useSyncExternalStore(subscribe, () => playing);
}
