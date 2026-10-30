import { ArrowLeft, ArrowRight, ExternalLink, Globe, Home as HomeIcon, Lock, Plus, RotateCw, Search, X } from "lucide-react";
import { createElement, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { bridge } from "@/data/bridge";
import { cn, IconButton } from "@/design/ui";
import { Tile } from "@/os/icons";
import { catalog, itemById } from "@/os/registry";
import { useOs } from "@/os/state";
import { useNav, useSession } from "@/shell/context";

type Tab = { id: string; linkId: string | null; title: string; url: string; favicon: string | null };

type WebviewElement = HTMLElement & {
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  stop(): void;
  getURL(): string;
  loadURL(url: string): Promise<void>;
};

const START = "sorvia:start";

let tabs: Tab[] = [];
let activeTab: string | null = null;
const listeners = new Set<() => void>();
let cached: { tabs: Tab[]; active: string | null } = { tabs, active: activeTab };

function setState(next: Tab[], active: string | null) {
  tabs = next;
  activeTab = active;
  cached = { tabs, active: activeTab };
  listeners.forEach((listener) => listener());
}

function patchTab(id: string, patch: Partial<Tab>) {
  setState(
    tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
    activeTab,
  );
}

function useTabs() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => cached,
  );
}

function newTab(url = START, title = "Yeni sekme", linkId: string | null = null) {
  const tab: Tab = { id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, linkId, title, url, favicon: null };
  setState([...tabs, tab], tab.id);
}

export function openWebTab(linkId: string, url: string, title: string) {
  const existing = tabs.find((tab) => tab.linkId === linkId);
  if (existing) return setState(tabs, existing.id);
  newTab(url, title, linkId);
}

function normalize(input: string) {
  const value = input.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(value) && !value.includes(" ")) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

export function Web() {
  const nav = useNav();
  const os = useOs();
  const state = useTabs();
  const params = nav.route.params;

  useEffect(() => {
    if (params?.link && params.url) openWebTab(params.link, params.url, params.title ?? "Sorvia");
    else if (tabs.length === 0) newTab();
  }, [params?.link, params?.url, params?.title, params?.at]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (os.active !== "web" || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "t") {
        event.preventDefault();
        newTab();
      } else if (key === "w" && activeTab) {
        event.preventDefault();
        close(activeTab);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [os.active]);

  const close = (id: string) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    const rest = tabs.filter((tab) => tab.id !== id);
    setState(rest, activeTab === id ? (rest[Math.max(0, index - 1)]?.id ?? null) : activeTab);
    if (!rest.length) os.closeApp("web");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {state.tabs.map((tab) => {
          const item = tab.linkId ? itemById(tab.linkId) : null;
          return (
            <div
              key={tab.id}
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  close(tab.id);
                }
              }}
              className={cn("group flex h-10 w-[200px] shrink-0 items-center gap-2 rounded-[14px] pl-2 pr-1.5 transition", state.active === tab.id ? "bg-white/[0.16] text-ink" : "bg-white/[0.05] text-ink-2 hover:bg-white/[0.09]")}
            >
              <button onClick={() => setState(tabs, tab.id)} className="flex min-w-0 flex-1 items-center gap-2">
                {tab.favicon ? (
                  <img src={tab.favicon} alt="" className="size-4 shrink-0 rounded-sm" />
                ) : item && item.kind !== "folder" ? (
                  <Tile item={item} size={20} className="shadow-none" />
                ) : (
                  <Globe className="size-4 shrink-0" />
                )}
                <span className="truncate text-[12.5px] font-medium">{tab.title}</span>
              </button>
              <button aria-label={`${tab.title} kapat`} onClick={() => close(tab.id)} className="rounded-full p-1 text-ink-3 opacity-60 hover:bg-white/15 hover:text-ink group-hover:opacity-100">
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
        <IconButton label="Yeni sekme (Ctrl+T)" size={34} onClick={() => newTab()}>
          <Plus className="size-4" />
        </IconButton>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] bg-[#141210]">
        {state.tabs.map((tab) => (
          <WebPane key={tab.id} tab={tab} active={state.active === tab.id} />
        ))}
      </div>
    </div>
  );
}

function WebPane({ tab, active }: { tab: Tab; active: boolean }) {
  const ref = useRef<WebviewElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState(tab.url === START ? "" : tab.url);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState({ back: false, forward: false });
  const start = tab.url === START;

  useEffect(() => {
    if (active && start) setTimeout(() => input.current?.focus(), 50);
  }, [active, start]);

  useEffect(() => {
    const view = ref.current;
    if (!view) return;
    const sync = () => {
      try {
        const url = view.getURL();
        if (!editing) setAddress(url);
        setHistory({ back: view.canGoBack(), forward: view.canGoForward() });
        patchTab(tab.id, { url });
      } catch {
        return;
      }
    };
    const onStart = () => setLoading(true);
    const onStop = () => {
      setLoading(false);
      sync();
    };
    const onTitle = (event: Event) => patchTab(tab.id, { title: (event as Event & { title: string }).title || tab.title });
    const onFavicon = (event: Event) => {
      const icon = (event as Event & { favicons: string[] }).favicons?.[0];
      if (icon && /^https:\/\//.test(icon)) patchTab(tab.id, { favicon: icon });
    };
    view.addEventListener("did-start-loading", onStart);
    view.addEventListener("did-stop-loading", onStop);
    view.addEventListener("did-navigate", sync);
    view.addEventListener("did-navigate-in-page", sync);
    view.addEventListener("page-title-updated", onTitle);
    view.addEventListener("page-favicon-updated", onFavicon);
    return () => {
      view.removeEventListener("did-start-loading", onStart);
      view.removeEventListener("did-stop-loading", onStop);
      view.removeEventListener("did-navigate", sync);
      view.removeEventListener("did-navigate-in-page", sync);
      view.removeEventListener("page-title-updated", onTitle);
      view.removeEventListener("page-favicon-updated", onFavicon);
    };
  }, [start, tab.id, tab.title, editing]);

  const go = (raw: string) => {
    const url = normalize(raw);
    if (!url) return;
    setEditing(false);
    setAddress(url);
    if (start) patchTab(tab.id, { url, title: "Yükleniyor…" });
    else void ref.current?.loadURL(url).catch(() => undefined);
  };

  const secure = address.startsWith("https://");

  return (
    <div className={cn("absolute inset-0 flex flex-col", !active && "invisible")}>
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-white/[0.07] bg-white/[0.05] px-2">
        <IconButton label="Geri" size={32} disabled={!history.back} onClick={() => ref.current?.goBack()}><ArrowLeft className="size-4" /></IconButton>
        <IconButton label="İleri" size={32} disabled={!history.forward} onClick={() => ref.current?.goForward()}><ArrowRight className="size-4" /></IconButton>
        <IconButton label={loading ? "Durdur" : "Yenile"} size={32} disabled={start} onClick={() => (loading ? ref.current?.stop() : ref.current?.reload())}>
          {loading ? <X className="size-4" /> : <RotateCw className="size-4" />}
        </IconButton>
        <IconButton label="Başlangıç" size={32} onClick={() => go("https://sorvia.net")}><HomeIcon className="size-4" /></IconButton>
        <form
          className="mx-1.5 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-black/30 px-3.5 ring-1 ring-white/[0.06] focus-within:ring-accent/60"
          onSubmit={(event) => {
            event.preventDefault();
            go(address);
          }}
        >
          {start || editing ? <Search className="size-3.5 shrink-0 text-ink-3" /> : secure ? <Lock className="size-3.5 shrink-0 text-ok" /> : <Globe className="size-3.5 shrink-0 text-warn" />}
          <input
            ref={input}
            value={address}
            onFocus={(event) => {
              setEditing(true);
              event.currentTarget.select();
            }}
            onBlur={() => setEditing(false)}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Ara ya da adres yaz"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4"
          />
        </form>
        <IconButton label="Varsayılan tarayıcıda aç" size={32} disabled={start} onClick={() => void bridge.system.openBrowser(address)}><ExternalLink className="size-4" /></IconButton>
      </div>
      {loading && <div className="h-0.5 w-full animate-pulse bg-accent" />}
      {start ? <StartPage onOpen={go} /> : createElement("webview", { ref, src: tab.url, partition: "persist:sorvia-web", allowpopups: "true", className: "min-h-0 flex-1 bg-white", style: { display: "flex" } })}
    </div>
  );
}

function StartPage({ onOpen }: { onOpen: (url: string) => void }) {
  const session = useSession();
  const links = catalog().filter((item) => item.kind === "link");
  return (
    <div className="scroll-area flex-1 overflow-y-auto px-10 py-12">
      <p className="text-center text-[28px] font-semibold tracking-[-0.02em] text-ink">Merhaba {session.user.name.split(" ")[0]}</p>
      <p className="mt-1 text-center text-[13.5px] text-ink-3">Bir adres yaz ya da Sorvia sayfalarından birini aç.</p>
      <div className="mx-auto mt-10 grid max-w-[760px] grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-6">
        {links.map((item) => (
          <button key={item.id} onClick={() => onOpen(item.url!)} className="flex flex-col items-center gap-2 rounded-[18px] p-2 transition hover:bg-white/[0.06]">
            <Tile item={item} size={56} />
            <span className="max-w-full truncate text-[12.5px] text-ink-2">{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
