import { ArrowDownUp, Bell, Check, Search, SlidersHorizontal, Wifi, WifiOff, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { bridge } from "@/data/bridge";
import { bytes } from "@/data/format";
import { clearFinishedTransfers, useTransfers } from "@/data/transfers";
import { LogoMark } from "@/design/logo";
import { cn, Kbd } from "@/design/ui";
import { useOverlay, useSession } from "@/shell/context";

import { Tile } from "./icons";
import { appById } from "./registry";
import { useOs } from "./state";

const TIME = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const DATE = new Intl.DateTimeFormat("tr-TR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

export function useNow(interval = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}

export function WindowControls({ className }: { className?: string }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    void bridge.window.isMaximized().then(setMaximized);
    return bridge.window.onMaximizeChange(setMaximized);
  }, []);

  return (
    <div className={cn("group no-drag flex items-center gap-2", className)} onDoubleClick={(event) => event.stopPropagation()}>
      <Light color="#ff5f57" label="Kapat" glyph="×" onClick={() => bridge.window.close()} />
      <Light color="#febc2e" label="Küçült" glyph="−" onClick={() => bridge.window.minimize()} />
      <Light color="#28c840" label={maximized ? "Önceki boyut" : "Büyüt"} glyph={maximized ? "⤡" : "⤢"} onClick={() => bridge.window.toggleMaximize()} />
    </div>
  );
}

function Light({ color, label, glyph, onClick }: { color: string; label: string; glyph: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="focus-ring flex size-[13px] items-center justify-center rounded-full text-[9.5px] font-bold leading-none text-black/0 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.35)] transition-colors group-hover:text-black/60"
      style={{ background: color }}
    >
      {glyph}
    </button>
  );
}

function Transfers() {
  const transfers = useTransfers();
  const [open, setOpen] = useState(false);
  const running = transfers.filter((item) => item.status === "queued" || item.status === "running");
  if (!transfers.length) return null;
  const total = running.reduce((sum, item) => sum + item.size, 0);
  const done = running.reduce((sum, item) => sum + item.done, 0);
  const ratio = total ? done / total : 1;
  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} aria-label="Aktarımlar" className="relative flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/10 hover:text-ink">
        <svg viewBox="0 0 32 32" className="absolute inset-0 size-8 -rotate-90">
          {running.length > 0 && <circle cx="16" cy="16" r="13" fill="none" stroke="var(--color-accent-2)" strokeWidth="2.2" strokeDasharray={`${Math.max(0.04, ratio) * 81.7} 81.7`} strokeLinecap="round" />}
        </svg>
        <ArrowDownUp className="relative size-[15px]" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} className="glass-sheet absolute right-0 top-10 z-[90] w-[340px] rounded-[22px] p-3">
            <div className="mb-2 flex items-center justify-between px-1.5">
              <p className="text-[13px] font-semibold text-ink">Aktarımlar</p>
              <button onClick={clearFinishedTransfers} className="text-[12px] text-accent-2 hover:underline">Bitenleri temizle</button>
            </div>
            <div className="scroll-area max-h-[320px] space-y-1.5">
              {transfers.map((item) => (
                <div key={item.id} className="rounded-[14px] bg-white/[0.05] px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span className={cn("size-1.5 shrink-0 rounded-full", item.status === "failed" ? "bg-bad" : item.status === "done" ? "bg-ok" : "bg-accent")} />
                    <span className="min-w-0 flex-1 truncate text-ink">{item.name}</span>
                    {(item.status === "running" || item.status === "queued") && (
                      <button onClick={() => void bridge.files.cancel(item.id)} aria-label="İptal" className="text-ink-3 hover:text-bad">
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className={cn("h-full rounded-full", item.status === "failed" ? "bg-bad" : "bg-accent")} style={{ width: `${item.size ? Math.round((item.done / item.size) * 100) : item.status === "done" ? 100 : 0}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-4">
                    {item.kind === "upload" ? "Yükleme" : "İndirme"} · {item.target === "drive" ? "Kurucu deposu" : "Galeri"} · {item.status === "failed" ? item.error : item.status === "done" ? `${bytes(item.size)} tamamlandı` : `${bytes(item.done)} / ${bytes(item.size)}`}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function StatusBar({ unread }: { unread: number }) {
  const os = useOs();
  const overlay = useOverlay();
  const session = useSession();
  const now = useNow();
  const app = os.active ? appById(os.active) : null;

  return (
    <header className="drag relative z-[60] flex h-[44px] shrink-0 items-center gap-3 px-4 text-ink">
      <WindowControls className="mr-1" />
      <div className="no-drag flex min-w-0 items-center gap-2">
        {app ? (
          <button onClick={os.goHome} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-[13px] font-semibold hover:bg-white/10" title="Ana ekrana dön">
            <Tile item={app} size={20} className="shadow-none" />
            {app.title}
          </button>
        ) : (
          <span className="flex items-center gap-2 pl-1 text-[13px] font-semibold">
            <LogoMark size={20} /> Sorvia
          </span>
        )}
      </div>

      <button
        onClick={() => overlay.open("palette")}
        className="no-drag mx-auto flex h-[30px] w-[min(320px,32vw)] items-center gap-2 rounded-full bg-white/[0.09] px-3.5 text-[12.5px] text-ink-3 ring-1 ring-white/10 transition-colors hover:bg-white/[0.14] hover:text-ink-2"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Ara</span>
        <Kbd>Ctrl K</Kbd>
      </button>

      <div className="no-drag flex items-center gap-1">
        {os.editing ? (
          <button onClick={() => os.setEditing(false)} className="accent-fill flex h-7 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold">
            <Check className="size-3.5" /> Bitti
          </button>
        ) : (
          <>
            <Transfers />
            <span title={session.preview ? "Önizleme modu" : "Sorvia'ya bağlı"} className={cn("flex size-8 items-center justify-center rounded-full", session.preview ? "text-warn" : "text-ink-2")}>
              {session.preview ? <WifiOff className="size-[15px]" /> : <Wifi className="size-[15px]" />}
            </span>
            <button onClick={() => overlay.toggle("notifications")} aria-label="Bildirimler" className="relative flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/10 hover:text-ink">
              <Bell className="size-[15px]" />
              {unread > 0 && <span className="absolute right-[3px] top-[3px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[9.5px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
            </button>
            <button onClick={() => os.setControl(!os.control)} aria-label="Denetim merkezi" className={cn("flex size-8 items-center justify-center rounded-full hover:bg-white/10", os.control ? "bg-white/15 text-ink" : "text-ink-2")}>
              <SlidersHorizontal className="size-[15px]" />
            </button>
          </>
        )}
        <button onClick={() => os.setControl(!os.control)} className="ml-1 flex items-baseline gap-2 rounded-full px-2 py-1 hover:bg-white/10">
          <span className="text-[12px] capitalize text-ink-2">{DATE.format(now)}</span>
          <span className="tabular text-[13.5px] font-semibold">{TIME.format(now)}</span>
        </button>
      </div>
    </header>
  );
}
