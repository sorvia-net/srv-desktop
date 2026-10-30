import { ArrowLeft, ArrowRight, ExternalLink, RotateCw } from "lucide-react";
import { createElement, useEffect, useRef, useState } from "react";

import { bridge } from "@/data/bridge";
import { IconButton } from "@/design/ui";
import { itemById, type LinkDef } from "@/os/registry";

type WebviewTag = HTMLElement & { goBack(): void; goForward(): void; reload(): void; canGoBack(): boolean; canGoForward(): boolean; getURL(): string };

export function WebApp({ id }: { id: string }) {
  const item = itemById(id) as LinkDef | undefined;
  const ref = useRef<WebviewTag | null>(null);
  const [nav, setNav] = useState({ back: false, forward: false, loading: true });

  useEffect(() => {
    const view = ref.current;
    if (!view) return;
    const update = () => setNav({ back: view.canGoBack(), forward: view.canGoForward(), loading: false });
    const start = () => setNav((current) => ({ ...current, loading: true }));
    view.addEventListener("did-navigate", update);
    view.addEventListener("did-navigate-in-page", update);
    view.addEventListener("did-stop-loading", update);
    view.addEventListener("did-start-loading", start);
    return () => {
      view.removeEventListener("did-navigate", update);
      view.removeEventListener("did-navigate-in-page", update);
      view.removeEventListener("did-stop-loading", update);
      view.removeEventListener("did-start-loading", start);
    };
  }, []);

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
