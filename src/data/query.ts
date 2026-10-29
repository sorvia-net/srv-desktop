import { useCallback, useEffect, useSyncExternalStore } from "react";

import type { ApiResult } from "@shared/contracts";

type Entry = { data?: unknown; error?: string; loading: boolean; updatedAt: number; inflight?: Promise<void> };

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const fetchers = new Map<string, () => Promise<ApiResult<unknown>>>();
const EMPTY: Entry = { loading: true, updatedAt: 0 };

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, listener: () => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
  };
}

async function run(key: string) {
  const fetcher = fetchers.get(key);
  if (!fetcher) return;
  const current = cache.get(key);
  if (current?.inflight) return current.inflight;
  const inflight = (async () => {
    cache.set(key, { ...(cache.get(key) ?? EMPTY), loading: !cache.get(key)?.data, inflight: undefined });
    notify(key);
    try {
      const result = await fetcher();
      cache.set(key, result.ok ? { data: result.data, loading: false, updatedAt: Date.now() } : { ...(cache.get(key) ?? EMPTY), error: result.message, loading: false, updatedAt: Date.now() });
    } catch (error) {
      cache.set(key, { ...(cache.get(key) ?? EMPTY), error: (error as Error).message || "Beklenmeyen hata", loading: false, updatedAt: Date.now() });
    }
    notify(key);
  })();
  cache.set(key, { ...(cache.get(key) ?? EMPTY), inflight });
  return inflight;
}

export function useQuery<T>(key: string, fetcher: () => Promise<ApiResult<T>>, options: { refreshMs?: number; enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  fetchers.set(key, fetcher as () => Promise<ApiResult<unknown>>);
  const entry = useSyncExternalStore(
    useCallback((listener) => subscribe(key, listener), [key]),
    () => cache.get(key) ?? EMPTY,
  );

  useEffect(() => {
    if (!enabled) return;
    const stale = !cache.get(key)?.updatedAt || Date.now() - (cache.get(key)?.updatedAt ?? 0) > 5_000;
    if (stale) void run(key);
    if (!options.refreshMs) return;
    const timer = window.setInterval(() => void run(key), options.refreshMs);
    const onFocus = () => void run(key);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [key, enabled, options.refreshMs]);

  return {
    data: entry.data as T | undefined,
    error: entry.error,
    loading: entry.loading && !entry.data,
    refresh: () => run(key),
  };
}

export function invalidate(prefix: string) {
  for (const key of fetchers.keys()) if (key.startsWith(prefix)) void run(key);
}

export function setQueryData<T>(key: string, update: (current: T | undefined) => T) {
  const entry = cache.get(key) ?? EMPTY;
  cache.set(key, { ...entry, data: update(entry.data as T | undefined), loading: false, updatedAt: Date.now() });
  notify(key);
}

export function clearQueries() {
  cache.clear();
  for (const key of listeners.keys()) notify(key);
}

export function dropQueries(prefix: string) {
  for (const key of [...cache.keys()]) {
    if (!key.startsWith(prefix)) continue;
    cache.delete(key);
    notify(key);
  }
}
