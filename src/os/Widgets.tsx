import { Bell, ChevronDown, ChevronUp, HardDrive, ListChecks, Mail, Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { HomeSummary, ModuleId, StorageOverview } from "@shared/contracts";
import { api, filesApi } from "@/data/api";
import { useFeed } from "@/data/feed";
import { bytes, dueLabel, time } from "@/data/format";
import { useQuery } from "@/data/query";
import { cn } from "@/design/ui";
import { useSession } from "@/shell/context";

import { BadgeContext } from "./badges";
import { Tile } from "./icons";
import { useModules } from "./modules";
import { appById, itemById } from "./registry";
import { useOs } from "./state";

const WEEKDAY = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "Europe/Istanbul" });
const DAY = new Intl.DateTimeFormat("tr-TR", { day: "numeric", timeZone: "Europe/Istanbul" });
const MONTH = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "Europe/Istanbul" });
const CLOCK = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

const WIDGETS: { id: string; title: string; size: "wide" | "small"; app?: ModuleId }[] = [
  { id: "clock", title: "Saat", size: "wide" },
  { id: "calendar", title: "Takvim", size: "wide", app: "calendar" },
  { id: "tasks", title: "Görevler", size: "wide", app: "tasks" },
  { id: "notifications", title: "Bildirimler", size: "wide" },
  { id: "tickets", title: "Destek", size: "small", app: "tickets" },
  { id: "mail", title: "Posta", size: "small", app: "mail" },
  { id: "storage", title: "Depolama", size: "small", app: "storage" },
  { id: "chat", title: "Ekip", size: "small", app: "chat" },
];
const DEFAULT_WIDGETS = ["calendar", "tasks", "tickets", "storage"];

function Card({ children, onClick, className }: { children: ReactNode; onClick: () => void; className?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn("focus-ring block w-full rounded-[28px] border border-white/15 bg-white/[0.12] p-4 text-left shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-2xl", className)}
    >
      {children}
    </motion.button>
  );
}

export function Widgets() {
  const os = useOs();
  const session = useSession();
  const { installed } = useModules();
  const badges = useContext(BadgeContext);
  const feed = useFeed();
  const home = useQuery<HomeSummary>("home", () => api.home(), { refreshMs: 60_000 });
  const storage = useQuery<StorageOverview>("storage:overview", () => filesApi.overview(), { refreshMs: 300_000 });
  const [picker, setPicker] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!os.editing) setPicker(false);
  }, [os.editing]);

  const data = home.data;
  const agenda = (data?.agenda ?? []).slice(0, 3);
  const tasks = (data?.tasks ?? []).slice(0, 3);
  const disk = storage.data?.disk;
  const used = disk ? disk.total - disk.free : (storage.data?.categories ?? []).reduce((sum, item) => sum + item.bytes, 0);
  const ratio = disk ? used / disk.total : 0;
  const open = (id: ModuleId) => os.openApp(installed.has(id) ? id : "store", installed.has(id) ? undefined : { module: id });
  const list = (session.prefs.widgets ?? DEFAULT_WIDGETS).filter((id) => WIDGETS.some((widget) => widget.id === id));
  const save = (next: string[]) => session.setPrefs({ widgets: next });
  const move = (id: string, step: number) => {
    const next = [...list];
    const index = next.indexOf(id);
    const target = index + step;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    save(next);
  };

  const body = (id: string) => {
    if (id === "clock")
      return (
        <div>
          <p className="tabular text-[64px] font-light leading-none tracking-[-0.04em] text-white">{CLOCK.format(now)}</p>
          <p className="mt-2 text-[13px] capitalize text-white/75">{WEEKDAY.format(now)}, {DAY.format(now)} {MONTH.format(now)}</p>
        </div>
      );
    if (id === "calendar")
      return (
        <div className="flex gap-4">
          <div className="w-[92px] shrink-0">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#ff6b5e]">{WEEKDAY.format(now)}</p>
            <p className="tabular text-[52px] font-light leading-none tracking-[-0.04em] text-white">{DAY.format(now)}</p>
            <p className="mt-1 text-[12px] capitalize text-white/70">{MONTH.format(now)}</p>
          </div>
          <div className="min-w-0 flex-1 space-y-2 border-l border-white/15 pl-4">
            {agenda.length === 0 && <p className="pt-2 text-[12.5px] text-white/60">Bugün için plan yok.</p>}
            {agenda.map((item) => (
              <div key={item.id} className="min-w-0">
                <p className="tabular text-[11px] font-semibold text-[#ffb47a]">{item.allDay ? "Gün boyu" : time(item.startsAt)}</p>
                <p className="truncate text-[13px] font-medium text-white">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      );
    if (id === "tasks")
      return (
        <>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-[#f7b32b] text-white"><ListChecks className="size-4" /></span>
            <span className="text-[13px] font-semibold text-white">Görevler</span>
            <span className="tabular ml-auto text-[26px] font-semibold text-white">{data?.counts.openTasks ?? "–"}</span>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 && <p className="text-[12.5px] text-white/60">Açık görevin yok.</p>}
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2.5">
                <span className={cn("size-3.5 shrink-0 rounded-full border-2", task.priority === "URGENT" ? "border-[#ff453a]" : task.priority === "HIGH" ? "border-[#ffb340]" : "border-white/50")} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-white">{task.title}</span>
                {task.dueAt && <span className="shrink-0 text-[11px] text-white/60">{dueLabel(task.dueAt)}</span>}
              </div>
            ))}
          </div>
        </>
      );
    if (id === "notifications") {
      const recent = feed.slice(0, 3);
      return (
        <>
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-white"><Bell className="size-4" /> Son bildirimler</p>
          {recent.length === 0 && <p className="text-[12.5px] text-white/60">Yeni bildirim yok.</p>}
          <div className="space-y-2">
            {recent.map((item) => {
              const source = itemById(item.app);
              return (
                <div key={item.id} className="flex items-center gap-2.5">
                  {source && source.kind !== "folder" ? <Tile item={source} size={24} className="shadow-none" /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-white">{item.title}</span>
                    {item.body && <span className="block truncate text-[11.5px] text-white/70">{item.body}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      );
    }
    if (id === "tickets")
      return (
        <>
          <Tile item={appById("tickets")} size={30} className="shadow-none" />
          <p className="tabular mt-3 text-[34px] font-semibold leading-none text-white">{data?.counts.waitingTickets ?? "–"}</p>
          <p className="mt-1 text-[12px] text-white/70">talep yanıt bekliyor</p>
        </>
      );
    if (id === "mail")
      return (
        <>
          <span className="flex size-[30px] items-center justify-center rounded-[8px] bg-[#4b93f2] text-white"><Mail className="size-4" /></span>
          <p className="tabular mt-3 text-[34px] font-semibold leading-none text-white">{installed.has("mail") ? (badges.mail ?? 0) : "–"}</p>
          <p className="mt-1 text-[12px] text-white/70">{installed.has("mail") ? "okunmamış posta" : "Mağazadan yükle"}</p>
        </>
      );
    if (id === "chat")
      return (
        <>
          <Tile item={appById("chat")} size={30} className="shadow-none" />
          <p className="tabular mt-3 text-[34px] font-semibold leading-none text-white">{badges.chat ?? 0}</p>
          <p className="mt-1 text-[12px] text-white/70">okunmamış mesaj</p>
        </>
      );
    return (
      <>
        <div className="flex items-start justify-between">
          <span className="flex size-[30px] items-center justify-center rounded-[8px] bg-white text-[#0a84ff]"><HardDrive className="size-4" /></span>
          {disk && (
            <svg viewBox="0 0 36 36" className="size-11 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="4" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="#5ac8fa" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${ratio * 94.2} 94.2`} />
            </svg>
          )}
        </div>
        <p className="mt-2 text-[15px] font-semibold text-white">{storage.data ? bytes(used) : "–"}</p>
        <p className="mt-0.5 text-[12px] text-white/70">{disk ? `${bytes(disk.free)} boş` : "kullanılan alan"}</p>
      </>
    );
  };

  const sizeOf = (id: string) => WIDGETS.find((widget) => widget.id === id)!.size;
  const groups: string[][] = [];
  for (const id of list) {
    const last = groups.at(-1);
    if (sizeOf(id) === "small" && last && last.length === 1 && sizeOf(last[0]!) === "small") last.push(id);
    else groups.push([id]);
  }

  const render = (id: string) => {
    const meta = WIDGETS.find((widget) => widget.id === id)!;
    return (
      <div key={id} className="relative">
        <Card onClick={() => !os.editing && meta.app && open(meta.app)} className={cn(meta.size === "small" && "aspect-square")}>
          {body(id)}
        </Card>
        {os.editing && (
          <div className="absolute -right-2 -top-2 flex gap-1">
            <button onClick={() => move(id, -1)} aria-label="Yukarı taşı" className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><ChevronUp className="size-3.5" /></button>
            <button onClick={() => move(id, 1)} aria-label="Aşağı taşı" className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><ChevronDown className="size-3.5" /></button>
            <button onClick={() => save(list.filter((item) => item !== id))} aria-label="Kaldır" className="flex size-6 items-center justify-center rounded-full bg-[#ff453a] text-white"><Minus className="size-3.5" /></button>
          </div>
        )}
      </div>
    );
  };

  const missing = WIDGETS.filter((widget) => !list.includes(widget.id));
  return (
    <aside className="scroll-area -mx-3 -mt-3 hidden w-[354px] shrink-0 flex-col gap-4 px-3 pb-3 pt-3 xl:flex">
      {groups.map((group) => (group.length === 2 ? <div key={group.join("-")} className="grid grid-cols-2 gap-4">{group.map(render)}</div> : render(group[0]!)))}
      {list.length === 0 && !os.editing && <p className="px-2 text-[12.5px] text-white/60">Widget eklemek için ana ekranda boş bir yere sağ tıkla.</p>}
      {os.editing && (
        <div>
          <button onClick={() => setPicker((value) => !value)} className="flex w-full items-center justify-center gap-1.5 rounded-[22px] border border-dashed border-white/30 py-3 text-[13px] font-medium text-white/85 hover:bg-white/10">
            <Plus className="size-4" /> Widget ekle
          </button>
          {picker && (
            <div className="mt-2 space-y-1 rounded-[20px] bg-black/50 p-2 backdrop-blur-2xl">
              {missing.length === 0 && <p className="px-3 py-2 text-[12.5px] text-white/60">Hepsi ekli.</p>}
              {missing.map((widget) => (
                <button
                  key={widget.id}
                  onClick={() => {
                    save([...list, widget.id]);
                    setPicker(false);
                  }}
                  className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-[13px] text-white hover:bg-white/10"
                >
                  {widget.title}
                  <span className="text-[11px] text-white/50">{widget.size === "wide" ? "Geniş" : "Küçük"}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  session.setPrefs({ widgets: null });
                  setPicker(false);
                }}
                className="w-full rounded-[14px] px-3 py-2 text-left text-[12px] text-white/60 hover:bg-white/10"
              >
                Varsayılana dön
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
