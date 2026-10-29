import { Bell, ChevronLeft, ChevronRight, LayoutGrid, Lock, PanelsTopLeft, Plus, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

import { bridge } from "@/data/bridge";
import { invalidate } from "@/data/query";
import { cn, IconButton, Kbd } from "@/design/ui";

import { useNav, useOverlay, useSession } from "./context";
import { moduleOf } from "./modules";

const PATHS: Record<string, string> = {
  home: "my-sorvia",
  tasks: "gorevler",
  calendar: "takvim",
  tickets: "destek",
  mail: "mail",
  chat: "ekip",
  settings: "ayarlar",
};

export function TitleBar({ unread }: { unread: number }) {
  const nav = useNav();
  const overlay = useOverlay();
  const session = useSession();
  const [spinning, setSpinning] = useState(false);

  const refresh = () => {
    setSpinning(true);
    invalidate("");
    window.setTimeout(() => setSpinning(false), 900);
  };

  const status = session.preview ? { dot: "bg-warn", label: "Önizleme" } : { dot: "bg-ok", label: "Bağlı" };

  return (
    <div className="drag relative z-40 flex h-[58px] items-center justify-center px-6 pt-3">
      <div className="glass-float flex h-[50px] w-full max-w-[1060px] items-center gap-2 rounded-full pl-5 pr-3">
        <WindowControls className="mr-2" />
        <IconButton label="Uygulamalar" size={36} onClick={() => overlay.toggle("launcher")} active={overlay.launcher}>
          <PanelsTopLeft className="size-[18px]" />
        </IconButton>
        <div className="mx-1 flex items-center">
          <IconButton label="Geri" size={32} onClick={nav.back} disabled={!nav.canBack} className="disabled:opacity-30">
            <ChevronLeft className="size-[18px]" />
          </IconButton>
          <IconButton label="İleri" size={32} onClick={nav.forward} disabled={!nav.canForward} className="disabled:opacity-30">
            <ChevronRight className="size-[18px]" />
          </IconButton>
        </div>
        <button
          onClick={() => overlay.open("palette")}
          className="focus-ring no-drag group mx-auto flex h-[36px] min-w-0 max-w-[460px] flex-1 items-center gap-2.5 rounded-full bg-white/[0.07] px-4 text-[13px] text-ink-2 ring-1 ring-white/8 transition-colors hover:bg-white/[0.11]"
        >
          <span className={cn("size-[7px] shrink-0 rounded-full", status.dot)} title={status.label} />
          <Lock className="size-3.5 shrink-0 text-ink-3" />
          <span className="truncate">
            sorvia.net/<span className="text-ink">{PATHS[nav.route.screen] ?? nav.route.screen}</span>
          </span>
          <span className="ml-auto hidden items-center gap-1 text-ink-3 md:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
          <span
            role="button"
            tabIndex={-1}
            aria-label="Yenile"
            onClick={(event) => {
              event.stopPropagation();
              refresh();
            }}
            className="-mr-1.5 flex size-7 items-center justify-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink"
          >
            <RotateCw className={cn("size-3.5 transition-transform duration-700", spinning && "rotate-[360deg]")} />
          </span>
        </button>
        <div className="ml-1 flex items-center gap-0.5">
          <IconButton label="Bildirimler" size={36} onClick={() => overlay.toggle("notifications")} active={overlay.notifications}>
            <Bell className="size-[18px]" />
            {unread > 0 && !overlay.notifications && <span className="absolute right-[7px] top-[7px] size-[8px] rounded-full bg-accent ring-2 ring-[#3a332f]" />}
          </IconButton>
          <IconButton label="Hızlı görev" size={36} onClick={() => overlay.open("quickTask")}>
            <Plus className="size-[19px]" />
          </IconButton>
          <IconButton label="Uygulama başlatıcı" size={36} onClick={() => overlay.toggle("launcher")}>
            <LayoutGrid className="size-[17px]" />
          </IconButton>
        </div>
      </div>
      <span className="sr-only">{moduleOf(nav.route.screen).title}</span>
    </div>
  );
}

export function WindowControls({ className }: { className?: string }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    void bridge.window.isMaximized().then(setMaximized);
    return bridge.window.onMaximizeChange(setMaximized);
  }, []);

  return (
    <div className={cn("group no-drag flex items-center gap-2", className)} onDoubleClick={(event) => event.stopPropagation()}>
      <TrafficLight color="#ff5f57" label="Kapat" glyph="×" onClick={() => bridge.window.close()} />
      <TrafficLight color="#febc2e" label="Küçült" glyph="−" onClick={() => bridge.window.minimize()} />
      <TrafficLight color="#28c840" label={maximized ? "Önceki boyut" : "Büyüt"} glyph={maximized ? "⤡" : "⤢"} onClick={() => bridge.window.toggleMaximize()} />
    </div>
  );
}

function TrafficLight({ color, label, glyph, onClick }: { color: string; label: string; glyph: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="focus-ring flex size-[14px] items-center justify-center rounded-full text-[10px] font-bold leading-none text-black/0 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.35)] transition-colors group-hover:text-black/60"
      style={{ background: color }}
    >
      {glyph}
    </button>
  );
}
