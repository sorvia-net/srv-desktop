import { ArrowLeft, ArrowRight, ExternalLink, Globe, RotateCw, X } from "lucide-react";
import { createElement, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { bridge } from "@/data/bridge";
import { cn, IconButton } from "@/design/ui";
import { Tile } from "@/os/icons";
import { itemById } from "@/os/registry";
import { useOs } from "@/os/state";
import { useNav } from "@/shell/context";

type Tab = { id: string; linkId: string; title: string; url: string };

type WebviewElement = HTMLElement & {
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  getURL(): string;
  getTitle(): string;
};

let tabs: Tab[] = [];
let activeTab: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const snapshot = () => ({ tabs, active: activeTab });
let cached = snapshot();

function setState(next: Tab[], active: string | null) {
  tabs = next;
  activeTab = active;
  cached = snapshot();
  emit();
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

export function openWebTab(linkId: string, url: string, title: string) {
  const existing = tabs.find((tab) => tab.linkId === linkId);
  if (existing) return setState(tabs, existing.id);
  const tab = { id: `${linkId}-${Date.now()}`, linkId, title, url };
  setState([...tabs, tab], tab.id);
}

export function Web() {
  const nav = useNav();
  const os = useOs();
  const state = useTabs();
  const params = nav.route.params;

  useEffect(() => {
    if (params?.link && params.url) openWebTab(params.link, params.url, params.title ?? "Sorvia");
  }, [params?.link, params?.url, params?.title, params?.at]);

  useEffect(() => {
    if (state.tabs.length === 0) os.closeApp("web");
  }, [state.tabs.length, os]);

  const close = (id: string) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    const rest = tabs.filter((tab) => tab.id !== id);
    setState(rest, activeTab === id ? (rest[Math.max(0, index - 1)]?.id ?? null) : activeTab);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center gap-2 overflow-x-auto">
        {state.tabs.map((tab) => {
          const item = itemById(tab.linkId);
          return (
            <div key={tab.id} className={cn("group flex h-10 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-2 transition", state.active === tab.id ? "bg-white/[0.14] text-ink" : "bg-white/[0.05] text-ink-2 hover:bg-white/[0.09]")}>
              <button onClick={() => setState(tabs, tab.id)} className="flex items-center gap-2">
                {item && item.kind !== "folder" ? <Tile item={item} size={28} className="shadow-none" /> : <Globe className="size-5" />}
                <span className="max-w-[180px] truncate text-[13px] font-medium">{tab.title}</span>
              </button>
              <button aria-label={`${tab.title} kapat`} onClick={() => close(tab.id)} className="rounded-full p-1 text-ink-3 hover:bg-white/15 hover:text-ink">
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] bg-[#111]">
        {state.tabs.map((tab) => (
          <WebPane key={tab.id} tab={tab} active={state.active === tab.id} />
        ))}
      </div>
    </div>
  );
}

function WebPane({ tab, active }: { tab: Tab; active: boolean }) {
  const ref = useRef<WebviewElement | null>(null);
  const [url, setUrl] = useState(tab.url);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState({ back: false, forward: false });

  useEffect(() => {
    const view = ref.current;
    if (!view) return;
    const sync = () => {
      try {
        setUrl(view.getURL());
        setHistory({ back: view.canGoBack(), forward: view.canGoForward() });
      } catch {
        return;
      }
    };
    const start = () => setLoading(true);
    const stop = () => {
      setLoading(false);
      sync();
    };
    view.addEventListener("did-start-loading", start);
    view.addEventListener("did-stop-loading", stop);
    view.addEventListener("did-navigate", sync);
    view.addEventListener("did-navigate-in-page", sync);
    return () => {
      view.removeEventListener("did-start-loading", start);
      view.removeEventListener("did-stop-loading", stop);
      view.removeEventListener("did-navigate", sync);
      view.removeEventListener("did-navigate-in-page", sync);
    };
  }, []);

  return (
    <div className={cn("absolute inset-0 flex flex-col", !active && "invisible")}>
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-white/[0.07] bg-white/[0.04] px-2">
        <IconButton label="Geri" size={32} disabled={!history.back} onClick={() => ref.current?.goBack()}><ArrowLeft className="size-4" /></IconButton>
        <IconButton label="İleri" size={32} disabled={!history.forward} onClick={() => ref.current?.goForward()}><ArrowRight className="size-4" /></IconButton>
        <IconButton label="Yenile" size={32} onClick={() => ref.current?.reload()}><RotateCw className={cn("size-4", loading && "animate-spin")} /></IconButton>
        <span className="mx-2 min-w-0 flex-1 truncate rounded-full bg-black/25 px-3.5 py-1.5 text-[12.5px] text-ink-3">{url}</span>
        <IconButton label="Tarayıcıda aç" size={32} onClick={() => void bridge.system.openExternal(url)}><ExternalLink className="size-4" /></IconButton>
      </div>
      {createElement("webview", { ref, src: tab.url, partition: "persist:sorvia-web", className: "min-h-0 flex-1 bg-white", style: { display: "flex" } })}
    </div>
  );
}
