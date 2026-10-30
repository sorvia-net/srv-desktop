import { ICON_SIZES } from "@shared/appearance";
import { Minus, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { HomeLayout } from "@shared/contracts";
import { cn } from "@/design/ui";
import { useSession } from "@/shell/context";

import { BadgeContext } from "./badges";
import { ConfirmDialog, type ConfirmState } from "./Confirm";
import { Badge, ItemTile, Tile } from "./icons";
import { useModules } from "./modules";
import { DEFAULT_LAYOUT, folderItems, itemBadge, itemById, launchLink, resolveLayout, type HomeItem } from "./registry";
import { useOs } from "./state";
import { Widgets } from "./Widgets";


type Drag = { id: string; from: "grid" | "dock" } | null;

export { BadgeContext } from "./badges";

const UninstallContext = createContext<(item: HomeItem) => void>(() => undefined);

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
      launchLink(item, (url) => os.openApp("web", { link: item.id, url, title: item.title, at: String(Date.now()) }, ref.current?.getBoundingClientRect()), (id) => os.openApp(id, undefined, ref.current?.getBoundingClientRect()));
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
          if (!(event.target as HTMLElement).closest("button, a, input, textarea")) {
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
