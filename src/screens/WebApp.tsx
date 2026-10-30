import { ArrowLeft, ArrowRight, ExternalLink, RotateCw } from "lucide-react";
import { createElement, useEffect, useRef, useState } from "react";

import { bridge, SECONDARY_SCREEN } from "@/data/bridge";
import { pushFeed, registerMediaControl, setNowPlaying, setWebBadge, type NowPlaying } from "@/data/feed";
import { playSound } from "@/data/sound";
import { IconButton } from "@/design/ui";
import { itemById, type LinkDef } from "@/os/registry";
import { useOs } from "@/os/state";
import { useSession } from "@/shell/context";

type WebviewTag = HTMLElement & { goBack(): void; goForward(): void; reload(): void; canGoBack(): boolean; canGoForward(): boolean; getURL(): string };
type NotifyEvent = Event & { channel: string; args: [{ title: string; body: string }] };

export function WebApp({ id }: { id: string }) {
  const item = itemById(id) as LinkDef | undefined;
  const ref = useRef<WebviewTag | null>(null);
  const [nav, setNav] = useState({ back: false, forward: false, loading: true });
  const session = useSession();
  const os = useOs();
  const latest = useRef({ session, os });
  latest.current = { session, os };

  useEffect(() => {
    const view = ref.current;
    if (!view || !item) return;
    const update = () => setNav({ back: view.canGoBack(), forward: view.canGoForward(), loading: false });
    const start = () => setNav((current) => ({ ...current, loading: true }));
    const onMessage = (event: Event) => {
      const message = event as NotifyEvent;
      if (message.channel === "media") {
        setNowPlaying(item.id, (message.args[0] as unknown as Omit<NowPlaying, "app"> | null) ?? null);
        return;
      }
      if (message.channel !== "notify") return;
      const payload = message.args[0];
      if (!payload?.title) return;
      const { session: current, os: system } = latest.current;
      pushFeed({ app: item.id, title: payload.title, body: payload.body });
      if (current.prefs.doNotDisturb || SECONDARY_SCREEN) return;
      playSound(current.prefs.notificationSound);
      if (system.active !== item.id || !document.hasFocus()) current.toast(`${item.title} · ${payload.title}${payload.body ? `: ${payload.body}` : ""}`.slice(0, 160), "info");
    };
    const onTitle = (event: Event) => {
      const title = (event as Event & { title: string }).title ?? "";
      const match = /^\((\d+)\)/.exec(title);
      setWebBadge(item.id, match ? Number(match[1]) : 0);
    };
    registerMediaControl(item.id, (action) => (view as WebviewTag & { send(channel: string, value: string): void }).send("media-control", action));
    view.addEventListener("did-navigate", update);
    view.addEventListener("did-navigate-in-page", update);
    view.addEventListener("did-stop-loading", update);
    view.addEventListener("did-start-loading", start);
    view.addEventListener("ipc-message", onMessage);
    view.addEventListener("page-title-updated", onTitle);
    return () => {
      view.removeEventListener("did-navigate", update);
      view.removeEventListener("did-navigate-in-page", update);
      view.removeEventListener("did-stop-loading", update);
      view.removeEventListener("did-start-loading", start);
      view.removeEventListener("ipc-message", onMessage);
      view.removeEventListener("page-title-updated", onTitle);
      registerMediaControl(item.id, null);
      setNowPlaying(item.id, null);
    };
  }, [item]);

  if (!item) return null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-white/10 px-3">
        <IconButton label="Geri" size={30} disabled={!nav.back} onClick={() => ref.current?.goBack()}><ArrowLeft className="size-4" /></IconButton>
        <IconButton label="İleri" size={30} disabled={!nav.forward} onClick={() => ref.current?.goForward()}><ArrowRight className="size-4" /></IconButton>
        <IconButton label="Yenile" size={30} onClick={() => ref.current?.reload()}><RotateCw className={nav.loading ? "size-4 animate-spin" : "size-4"} /></IconButton>
        <span className="ml-2 text-[13px] font-semibold text-ink">{item.title}</span>
        {item.id === "app-spotify" && <span className="ml-2 truncate text-[11.5px] text-ink-4">Şarkı çalmazsa sağdaki düğmeyle ayrı pencerede aç</span>}
        <span className="flex-1" />
        <IconButton label="Ayrı pencerede aç" size={30} onClick={() => void bridge.system.openAppWindow(ref.current?.getURL() || item.url, item.id)}><ExternalLink className="size-4" /></IconButton>
      </div>
      {createElement("webview", { ref, src: item.url, partition: "persist:sorvia-web", allowpopups: "true", className: "min-h-0 flex-1 bg-black", style: { display: "flex" } })}
    </div>
  );
}
