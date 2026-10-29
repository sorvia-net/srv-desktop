import { ICON_SIZES } from "@shared/appearance";
import { HardDrive, ListChecks, Mail, Minus, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { HomeLayout, HomeSummary, StorageOverview } from "@shared/contracts";
import { api, filesApi } from "@/data/api";
import { bytes, dueLabel, time } from "@/data/format";
import { useQuery } from "@/data/query";
import { cn } from "@/design/ui";
import { useSession } from "@/shell/context";

import { ConfirmDialog, type ConfirmState } from "./Confirm";
import { Badge, ItemTile, Tile } from "./icons";
import { useModules } from "./modules";
import { appById, DEFAULT_LAYOUT, folderItems, itemBadge, itemById, resolveLayout, type HomeItem } from "./registry";
import { useOs } from "./state";

const WEEKDAY = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "Europe/Istanbul" });
const DAY = new Intl.DateTimeFormat("tr-TR", { day: "numeric", timeZone: "Europe/Istanbul" });
const MONTH = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "Europe/Istanbul" });

type Drag = { id: string; from: "grid" | "dock" } | null;

export const BadgeContext = createContext<Partial<Record<string, number>>>({});

const UninstallContext = createContext<(item: HomeItem) => void>(() => undefined);

function Widget({ children, onClick, className }: { children: ReactNode; onClick: () => void; className?: string }) {
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

function Widgets() {
  const os = useOs();
  const { installed } = useModules();
  const home = useQuery<HomeSummary>("home", () => api.home(), { refreshMs: 60_000 });
  const storage = useQuery<StorageOverview>("storage:overview", () => filesApi.overview(), { refreshMs: 300_000 });
  const data = home.data;
  const now = new Date();
  const agenda = (data?.agenda ?? []).slice(0, 3);
  const tasks = (data?.tasks ?? []).slice(0, 3);
  const disk = storage.data?.disk;
  const used = disk ? disk.total - disk.free : (storage.data?.categories ?? []).reduce((sum, item) => sum + item.bytes, 0);
  const ratio = disk ? used / disk.total : 0;
  const open = (id: "calendar" | "tasks" | "tickets" | "mail" | "storage" | "store") => os.openApp(installed.has(id) ? id : "store", installed.has(id) ? undefined : { module: id });

  return (
    <aside className="hidden w-[330px] shrink-0 flex-col gap-4 xl:flex">
      <Widget onClick={() => open("calendar")}>
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
      </Widget>

      <Widget onClick={() => open("tasks")}>
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
      </Widget>

      <div className="grid grid-cols-2 gap-4">
        {installed.has("tickets") ? (
          <Widget onClick={() => open("tickets")} className="aspect-square">
            <Tile item={appById("tickets")} size={30} className="shadow-none" />
            <p className="tabular mt-3 text-[34px] font-semibold leading-none text-white">{data?.counts.waitingTickets ?? "–"}</p>
            <p className="mt-1 text-[12px] text-white/70">talep yanıt bekliyor</p>
          </Widget>
        ) : (
          <Widget onClick={() => open("mail")} className="aspect-square">
            <span className="flex size-[30px] items-center justify-center rounded-[8px] bg-[#4b93f2] text-white"><Mail className="size-4" /></span>
            <p className="mt-3 text-[15px] font-semibold text-white">Sorvia Mail</p>
            <p className="mt-1 text-[12px] text-white/70">{installed.has("mail") ? "Posta kutunu aç" : "Mağazadan yükle"}</p>
          </Widget>
        )}
        <Widget onClick={() => open("storage")} className="aspect-square">
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
        </Widget>
      </div>
    </aside>
  );
}

function HomeIcon({ item, size, label, drag, setDrag, onDropOn, area }: { item: HomeItem; size: number; label: boolean; drag: Drag; setDrag: (value: Drag) => void; onDropOn: (targetId: string, area: "grid" | "dock") => void; area: "grid" | "dock" }) {
  const os = useOs();
  const session = useSession();
  const { installed, installing } = useModules();
  const askUninstall = useContext(UninstallContext);
  const ref = useRef<HTMLButtonElement>(null);
  const press = useRef<number | null>(null);
  const badges = useContext(BadgeContext);
  const badge = itemBadge(item, badges, session.user, installed);
  const running = item.kind === "app" && os.openApps.includes(item.id);
  const removable = item.kind !== "folder" && !item.system;

  const open = () => {
    if (os.editing) return;
    if (item.kind === "app") os.openApp(item.id, undefined, ref.current?.getBoundingClientRect());
    else if (item.kind === "folder") os.openFolder(item.id);
    else {
      os.openApp("web", { link: item.id, url: item.url, title: item.title, at: String(Date.now()) }, ref.current?.getBoundingClientRect());
    }
  };

  return (
    <div
      className={cn("relative flex flex-col items-center", drag?.id === item.id && "opacity-40")}
      onDragOver={(event) => {
        if (!drag) return;
        event.preventDefault();
        onDropOn(item.id, area);
      }}
    >
      <button
        ref={ref}
        draggable={os.editing}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          setDrag({ id: item.id, from: area });
        }}
        onDragEnd={() => setDrag(null)}
        onClick={open}
        onContextMenu={(event) => {
          event.preventDefault();
          os.setEditing(true);
        }}
        onPointerDown={() => {
          press.current = window.setTimeout(() => os.setEditing(true), 650);
        }}
        onPointerUp={() => press.current && window.clearTimeout(press.current)}
        onPointerLeave={() => press.current && window.clearTimeout(press.current)}
        title={label ? undefined : item.title}
        className={cn("focus-ring relative rounded-[22%] outline-none transition-transform duration-150 active:scale-90", os.editing && "jiggle")}
        style={os.editing ? { animationDelay: `${(item.id.length % 5) * -0.07}s` } : undefined}
      >
        <ItemTile item={item} size={size} user={session.user} installed={installed} />
        {installing.has(item.id) && <span className="absolute inset-0 rounded-[22%] bg-black/45" />}
        {!os.editing && <Badge count={badge} />}
      </button>
      {os.editing && removable && (
        <button
          onClick={() => askUninstall(item)}
          aria-label={`${item.title} kaldır`}
          className="absolute -left-1.5 -top-1.5 z-10 flex size-[22px] items-center justify-center rounded-full bg-[#3a3a3c] text-white shadow-[0_2px_6px_rgba(0,0,0,0.5)] ring-1 ring-white/30 hover:bg-[#ff453a]"
        >
          <Minus className="size-3.5" strokeWidth={3} />
        </button>
      )}
      {label && <span onClick={open} className="mt-2 max-w-[104px] cursor-default truncate text-center text-[12.5px] font-medium text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">{item.title}</span>}
      {!label && running && <span className="absolute -bottom-2.5 size-1 rounded-full bg-white/80" />}
    </div>
  );
}

function FolderOverlay() {
  const os = useOs();
  const session = useSession();
  const { installed } = useModules();
  const folder = os.folder ? itemById(os.folder) : null;
  const [drag, setDrag] = useState<Drag>(null);
  return (
    <AnimatePresence>
      {folder?.kind === "folder" && (
        <motion.div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/25 backdrop-blur-[18px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => os.openFolder(null)}>
          <motion.div initial={{ scale: 0.82, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.86, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }} onMouseDown={(event) => event.stopPropagation()} className="w-[min(640px,88vw)]">
            <h2 className="mb-5 text-center text-[30px] font-semibold tracking-[-0.02em] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.5)]">{folder.title}</h2>
            <div className="grid grid-cols-4 gap-x-6 gap-y-7 rounded-[44px] border border-white/20 bg-white/[0.14] px-8 py-9 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-3xl">
              {folderItems(folder, session.user, installed).map((child) => (
                <HomeIcon key={child.id} item={child} size={72} label drag={drag} setDrag={setDrag} onDropOn={() => undefined} area="grid" />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function HomeScreen({ visible }: { visible: boolean }) {
  const os = useOs();
  const session = useSession();
  const { installed, uninstall } = useModules();
  const saved = session.prefs.homeLayout;
  const resolved = useMemo(() => resolveLayout(saved, session.user, installed), [saved, session.user, installed]);
  const [layout, setLayout] = useState<HomeLayout>(resolved);
  const [drag, setDrag] = useState<Drag>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  useEffect(() => setLayout(resolved), [resolved]);

  const recent = os.openApps.filter((id) => !layout.dock.includes(id)).slice(-3).reverse();

  const moveTo = (targetId: string, area: "grid" | "dock") => {
    if (!drag || drag.id === targetId) return;
    setLayout((current) => {
      const grid = current.grid.filter((id) => id !== drag.id);
      const dock = current.dock.filter((id) => id !== drag.id);
      if (area === "dock" && drag.from === "grid" && dock.length >= 7) return current;
      if (area === "dock" && itemById(drag.id)?.kind !== "app") return current;
      const list = area === "grid" ? grid : dock;
      const index = list.indexOf(targetId);
      list.splice(index < 0 ? list.length : index, 0, drag.id);
      if (area === "dock" && !grid.includes(drag.id) && current.grid.includes(drag.id)) grid.splice(current.grid.indexOf(drag.id), 0, drag.id);
      return { grid, dock };
    });
    setDrag((current) => (current ? { ...current, from: area } : current));
  };

  const persist = () => {
    setDrag(null);
    session.setPrefs({ homeLayout: layout });
  };

  const askUninstall = (item: HomeItem) => {
    if (item.kind === "folder") return;
    setConfirm({
      title: `${item.title} kaldırılsın mı?`,
      body: item.id === "mail" ? "Bu bilgisayardaki posta bağlantın ve kayıtlı parolan da silinir. İstediğin an Mağaza'dan yeniden yükleyebilirsin." : "Mağaza'dan istediğin an yeniden yükleyebilirsin.",
      action: "Kaldır",
      danger: true,
      icon: <Tile item={item} size={56} />,
      onConfirm: () => void uninstall(item.id),
    });
  };

  return (
    <UninstallContext.Provider value={askUninstall}>
      <motion.div
        className="absolute inset-0 flex flex-col"
        animate={visible ? { opacity: 1, scale: 1, filter: "blur(0px)" } : { opacity: 0, scale: 0.94, filter: "blur(8px)" }}
        transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
        style={{ pointerEvents: visible ? "auto" : "none" }}
        onDragEnd={persist}
        onDrop={persist}
        onContextMenu={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            os.setEditing(true);
          }
        }}
        onClick={(event) => {
          if (os.editing && event.target === event.currentTarget) os.setEditing(false);
        }}
      >
        <div className="flex min-h-0 flex-1 gap-12 px-12 pb-4 pt-7">
          <Widgets />
          <section
            className="min-w-0 flex-1"
            onDragOver={(event) => {
              if (drag) event.preventDefault();
            }}
            onDrop={() => {
              if (drag?.from === "dock") moveTo("__end__", "grid");
            }}
          >
            {os.editing && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => {
                    setLayout(resolveLayout(DEFAULT_LAYOUT, session.user, installed));
                    session.setPrefs({ homeLayout: null });
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-xl hover:bg-white/25"
                >
                  <RotateCcw className="size-3.5" /> Varsayılan düzen
                </button>
              </div>
            )}
            <div style={{ "--home-cell": `${(ICON_SIZES[session.prefs.iconSize] ?? 76) + 32}px` } as React.CSSProperties} className="grid grid-cols-[repeat(auto-fill,minmax(var(--home-cell),1fr))] content-start gap-x-4 gap-y-8">
              {layout.grid.map((id) => {
                const item = itemById(id);
                return item ? <HomeIcon key={id} item={item} size={ICON_SIZES[session.prefs.iconSize] ?? 76} label drag={drag} setDrag={setDrag} onDropOn={moveTo} area="grid" /> : null;
              })}
            </div>
          </section>
        </div>

        <div className="flex justify-center pb-5">
          <div
            className="flex items-center gap-4 rounded-[32px] border border-white/20 bg-white/[0.16] px-4 py-3.5 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-3xl"
            onDragOver={(event) => {
              if (!drag) return;
              event.preventDefault();
              if (!layout.dock.includes(drag.id)) moveTo("__end__", "dock");
            }}
          >
            {layout.dock.map((id) => {
              const item = itemById(id);
              return item ? <HomeIcon key={id} item={item} size={62} label={false} drag={drag} setDrag={setDrag} onDropOn={moveTo} area="dock" /> : null;
            })}
            {recent.length > 0 && <span className="mx-1 h-12 w-px bg-white/25" />}
            {recent.map((id) => {
              const item = itemById(id);
              return item ? <HomeIcon key={`recent-${id}`} item={item} size={62} label={false} drag={null} setDrag={() => undefined} onDropOn={() => undefined} area="dock" /> : null;
            })}
          </div>
        </div>
        <FolderOverlay />
      </motion.div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </UninstallContext.Provider>
  );
}
