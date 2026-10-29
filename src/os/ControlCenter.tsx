import { ACCENTS, type Accent } from "@shared/appearance";
import { Bell, BellOff, Lock, LogOut, Mail, Moon, RefreshCw, Settings, Sparkles, Wifi } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import type { MailAccountInfo, Preferences, StorageOverview } from "@shared/contracts";
import { filesApi, mailApi } from "@/data/api";
import { bytes } from "@/data/format";
import { invalidate, useQuery } from "@/data/query";
import { Avatar, cn } from "@/design/ui";
import { useSession } from "@/shell/context";

import { useModules } from "./modules";
import { useOs } from "./state";

const WALLPAPERS: { id: Preferences["wallpaper"]; preview: string }[] = [
  { id: "ember", preview: "radial-gradient(circle at 50% 0%, #ffcf8f 0%, #b56a2c 34%, #2a1f19 70%)" },
  { id: "dusk", preview: "radial-gradient(circle at 50% 0%, #f5c6c0 0%, #9a5a86 36%, #241b26 70%)" },
  { id: "noir", preview: "radial-gradient(circle at 50% 0%, #c9a882 0%, #5a4232 34%, #151210 70%)" },
];

function Round({ on, icon, label, onClick, tone = "#ff9f0a" }: { on: boolean; icon: ReactNode; label: string; onClick?: () => void; tone?: string }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 text-center" disabled={!onClick}>
      <span className={cn("flex size-11 items-center justify-center rounded-full transition-colors", on ? "text-white" : "bg-white/15 text-white/85")} style={on ? { background: tone } : undefined}>
        {icon}
      </span>
      <span className="text-[11px] leading-tight text-white/85">{label}</span>
    </button>
  );
}

function Square({ icon, label, onClick, on = false }: { icon: ReactNode; label: string; onClick: () => void; on?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex aspect-square flex-col items-center justify-center gap-2 rounded-[22px] text-white transition-colors", on ? "bg-white text-[#1c1c1e]" : "bg-white/[0.14] hover:bg-white/[0.22]")}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

export function ControlCenter() {
  const os = useOs();
  const session = useSession();
  const { installed } = useModules();
  const prefs = session.prefs;
  const mail = useQuery<MailAccountInfo | null>("mail:account", () => mailApi.account(), { enabled: os.control && installed.has("mail") });
  const storage = useQuery<StorageOverview>("storage:overview", () => filesApi.overview(), { enabled: os.control });
  const used = storage.data ? storage.data.categories.reduce((sum, item) => sum + item.bytes, 0) : 0;
  const total = storage.data?.disk?.total ?? used;

  return (
    <AnimatePresence>
      {os.control && (
        <motion.div className="fixed inset-0 z-[57]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => os.setControl(false)}>
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onMouseDown={(event) => event.stopPropagation()}
            className="absolute right-4 top-[50px] w-[372px] rounded-[32px] border border-white/20 bg-[#2a2420]/55 p-4 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-3xl"
          >
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2 row-span-2 grid grid-cols-2 gap-x-2 gap-y-3 rounded-[24px] bg-white/[0.12] p-3">
                <Round on={!session.preview} icon={<Wifi className="size-5" />} label={session.preview ? "Önizleme" : "Sorvia"} tone="#30d158" />
                <Round on={Boolean(mail.data)} icon={<Mail className="size-5" />} label={mail.data ? "Posta" : "Posta yok"} tone="#0a84ff" />
                <Round on={prefs.nativeNotifications} icon={prefs.nativeNotifications ? <Bell className="size-5" /> : <BellOff className="size-5" />} label="Bildirimler" onClick={() => session.setPrefs({ nativeNotifications: !prefs.nativeNotifications })} />
                <Round on={prefs.doNotDisturb} icon={<Moon className="size-5" />} label="Rahatsız etme" tone="#5e5ce6" onClick={() => session.setPrefs({ doNotDisturb: !prefs.doNotDisturb })} />
              </div>
              <Square icon={<Lock className="size-5" />} label="Kilitle" onClick={os.lock} />
              <Square
                icon={<RefreshCw className="size-5" />}
                label="Yenile"
                onClick={() => {
                  invalidate("");
                  session.toast("Her şey yenileniyor", "info");
                }}
              />
              <Square icon={<Sparkles className="size-5" />} label={`Tema: ${ACCENTS[prefs.accent].label}`} on onClick={() => { const keys = Object.keys(ACCENTS) as Accent[]; session.setPrefs({ accent: keys[(keys.indexOf(prefs.accent) + 1) % keys.length]! }); }} />
              <Square icon={<Settings className="size-5" />} label="Ayarlar" onClick={() => os.openApp("settings")} />
              <div className="col-span-4 rounded-[24px] bg-white/[0.12] p-3">
                <p className="mb-2 px-1 text-[11.5px] font-medium text-white/70">Duvar kâğıdı</p>
                <div className="grid grid-cols-3 gap-2">
                  {WALLPAPERS.map((item) => (
                    <button key={item.id} onClick={() => session.setPrefs({ wallpaper: item.id })} aria-label={item.id} className={cn("h-14 rounded-[14px] ring-2 transition", prefs.wallpaper === item.id ? "ring-white" : "ring-transparent hover:ring-white/40")} style={{ background: item.preview }} />
                  ))}
                </div>
              </div>
              {storage.data && storage.data.categories.length > 0 && (
                <button onClick={() => os.openApp(installed.has("storage") ? "storage" : "store")} className="col-span-4 rounded-[24px] bg-white/[0.12] p-3 text-left hover:bg-white/[0.18]">
                  <div className="mb-2 flex items-baseline justify-between px-1 text-[11.5px] text-white/70">
                    <span className="font-medium">Depolama</span>
                    <span>{storage.data.disk ? `${bytes(storage.data.disk.total - storage.data.disk.free)} / ${bytes(storage.data.disk.total)}` : bytes(used)}</span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-white/15">
                    {storage.data.categories.map((item) => (
                      <span key={item.id} style={{ width: `${total ? (item.bytes / total) * 100 : 0}%`, background: item.color }} />
                    ))}
                  </div>
                </button>
              )}
              <div className="col-span-4 flex items-center gap-3 rounded-[24px] bg-white/[0.12] p-3">
                <Avatar name={session.user.name} src={session.user.avatarUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">{session.user.name}</p>
                  <p className="truncate text-[11.5px] text-white/65">{session.user.roleLabel}</p>
                </div>
                <button onClick={session.logout} aria-label="Oturumu kapat" title="Oturumu kapat" className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-[#ff453a]">
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
