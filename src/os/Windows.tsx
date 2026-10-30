import { Home as HomeIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ComponentType } from "react";

import type { ModuleId } from "@shared/contracts";
import { SECONDARY_SCREEN } from "@/data/bridge";
import { cn } from "@/design/ui";
import { Calendar } from "@/screens/Calendar";
import { Chat } from "@/screens/Chat";
import { Gallery } from "@/screens/Gallery";
import { Home } from "@/screens/Home";
import { Mail } from "@/screens/Mail";
import { Settings } from "@/screens/Settings";
import { Storage } from "@/screens/Storage";
import { Store } from "@/screens/Store";
import { Tasks } from "@/screens/Tasks";
import { Admin } from "@/screens/Admin";
import { Founder } from "@/screens/Founder";
import { Games } from "@/screens/Games";
import { Orders } from "@/screens/Orders";
import { Products } from "@/screens/Products";
import { WebApp } from "@/screens/WebApp";
import { Status } from "@/screens/Status";
import { Tickets } from "@/screens/Tickets";
import { Users } from "@/screens/Users";
import { Web } from "@/screens/Web";
import { useSession } from "@/shell/context";

import { Tile } from "./icons";
import { appById, itemById, resolveLayout } from "./registry";
import { useModules } from "./modules";
import { AppNav, useOs } from "./state";
import { ModuleScreen } from "@/modules/loader";

const SCREENS: Partial<Record<ModuleId, ComponentType>> = {
  home: Home,
  tasks: Tasks,
  calendar: Calendar,
  tickets: Tickets,
  mail: Mail,
  chat: Chat,
  gallery: Gallery,
  storage: Storage,
  store: Store,
  web: Web,
  users: Users,
  orders: Orders,
  status: Status,
  products: Products,
  admin: Admin,
  founder: Founder,
  games: Games,
  settings: Settings,
};

function AppWindow({ id, active }: { id: ModuleId; active: boolean }) {
  const os = useOs();
  const Screen = SCREENS[id];
  const origin = os.origin ? `${os.origin.x - 12}px ${os.origin.y - 44}px` : "50% 60%";
  return (
    <motion.section
      aria-hidden={!active}
      className="glass-panel absolute inset-x-3 bottom-3 top-0 overflow-hidden rounded-[30px]"
      initial={{ opacity: 0, scale: 0.2 }}
      animate={active ? { opacity: 1, scale: 1, visibility: "visible" } : { opacity: 0, scale: 0.9, transitionEnd: { visibility: "hidden" } }}
      transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.9 }}
      style={{ transformOrigin: origin, pointerEvents: active ? "auto" : "none", zIndex: active ? 20 : 10 }}
    >
      <div className="h-full px-9 pb-10 pt-7">
        <AppNav id={id}>{Screen ? <ModuleScreen id={id} builtin={Screen} builtinVersion={appById(id).version} /> : null}</AppNav>
      </div>
      <button onClick={os.goHome} title="Ana ekran (Ctrl+H)" aria-label="Ana ekran" className="group absolute bottom-1.5 left-1/2 z-10 flex h-5 w-56 -translate-x-1/2 items-center justify-center">
        <span className="h-[5px] w-[134px] rounded-full bg-white/45 transition-all group-hover:w-[160px] group-hover:bg-white/80" />
      </button>
    </motion.section>
  );
}

function DockPeek() {
  const os = useOs();
  const session = useSession();
  const modules = useModules();
  const [shown, setShown] = useState(false);
  if (!os.active) return null;
  const dock = resolveLayout(session.prefs.homeLayout, session.user, modules.installed).dock;
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-3 justify-center" onMouseEnter={() => setShown(true)}>
      <AnimatePresence>
        {shown && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: -40, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onMouseLeave={() => setShown(false)}
            className="absolute bottom-0 flex items-center gap-3 rounded-[26px] border border-white/20 bg-white/[0.16] px-3 py-2.5 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.75)] backdrop-blur-3xl"
          >
            <button onClick={os.goHome} aria-label="Ana ekran" title="Ana ekran" className="flex size-[50px] items-center justify-center rounded-[13px] bg-white/15 text-white hover:bg-white/25">
              <HomeIcon className="size-6" />
            </button>
            <span className="h-9 w-px bg-white/25" />
            {dock.map((itemId) => {
              const item = itemById(itemId);
              if (!item || item.kind !== "app") return null;
              return (
                <button key={itemId} onClick={() => os.openApp(item.id)} title={item.title} className="relative transition-transform hover:-translate-y-1 active:scale-90">
                  <Tile item={item} size={50} />
                  {os.active === item.id && <span className="absolute -bottom-2 left-1/2 size-1 -translate-x-1/2 rounded-full bg-white" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WebAppLayer() {
  const os = useOs();
  const { installed } = useModules();
  const ids = [...new Set([...(SECONDARY_SCREEN ? [] : [...installed].filter((id) => id.startsWith("app-"))), ...os.openApps.filter((id) => id.startsWith("app-"))])].filter((id) => itemById(id));
  return (
    <>
      {ids.map((id) => {
        const active = os.active === id;
        return (
          <motion.section
            key={id}
            aria-hidden={!active}
            className="glass-panel absolute inset-x-3 bottom-3 top-0 overflow-hidden rounded-[30px]"
            initial={false}
            animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            style={{ pointerEvents: active ? "auto" : "none", zIndex: active ? 20 : 1, visibility: active ? "visible" : "hidden" }}
          >
            <div className="h-full pb-7">
              <WebApp id={id} />
            </div>
            <button onClick={os.goHome} title="Ana ekran (Ctrl+H)" aria-label="Ana ekran" className="group absolute bottom-1.5 left-1/2 z-10 flex h-5 w-56 -translate-x-1/2 items-center justify-center">
              <span className="h-[5px] w-[134px] rounded-full bg-white/45 transition-all group-hover:w-[160px] group-hover:bg-white/80" />
            </button>
          </motion.section>
        );
      })}
    </>
  );
}

export function AppHost() {
  const os = useOs();
  return (
    <div className="absolute inset-0" style={{ pointerEvents: os.active ? "auto" : "none" }}>
      {os.openApps.filter((id) => !id.startsWith("app-")).map((id) => (
        <AppWindow key={id} id={id} active={os.active === id} />
      ))}
      <WebAppLayer />
      <DockPeek />
    </div>
  );
}

export function AppSwitcher() {
  const os = useOs();
  const apps = [...os.openApps].reverse();
  return (
    <AnimatePresence>
      {os.switcher && (
        <motion.div className="fixed inset-0 z-[58] flex flex-col justify-center bg-black/30 backdrop-blur-[26px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => os.setSwitcher(false)}>
          {apps.length === 0 ? (
            <p className="text-center text-[15px] text-white/80">Açık uygulama yok</p>
          ) : (
            <div className="scroll-area flex items-center gap-10 overflow-x-auto px-16 py-10" onClick={(event) => event.stopPropagation()}>
              {apps.map((id, index) => {
                const app = appById(id);
                const shot = os.snapshots[id];
                return (
                  <motion.div
                    key={id}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -300, opacity: 0 }}
                    transition={{ delay: index * 0.03, type: "spring", stiffness: 360, damping: 32 }}
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0.9, bottom: 0.1 }}
                    onDragEnd={(_event, info) => {
                      if (info.offset.y < -120) os.closeApp(id);
                    }}
                    className="flex shrink-0 cursor-grab flex-col gap-3 active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2 pl-1 text-[14px] font-semibold text-white">
                      <Tile item={app} size={26} className="shadow-none" />
                      {app.title}
                      <button onClick={() => os.closeApp(id)} aria-label={`${app.title} kapat`} className="ml-auto flex size-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30">
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <button onClick={() => os.openApp(id)} className={cn("relative h-[250px] w-[400px] overflow-hidden rounded-[26px] border border-white/20 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.85)] transition-transform hover:scale-[1.02]")} style={{ background: shot ? undefined : app.tile }}>
                      {shot ? <img src={shot} alt="" className="h-full w-full object-cover" draggable={false} /> : <Tile item={app} size={96} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
          {apps.length > 0 && (
            <div className="mt-4 flex justify-center gap-2" onClick={(event) => event.stopPropagation()}>
              {os.active && apps.length > 1 && (
                <button onClick={() => apps.filter((id) => id !== os.active).forEach((id) => os.closeApp(id))} className="rounded-full bg-white/15 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/25">
                  Arka plandakileri kapat ({apps.length - 1})
                </button>
              )}
              <button onClick={() => { apps.forEach((id) => os.closeApp(id)); os.setSwitcher(false); }} className="rounded-full bg-white/15 px-4 py-2 text-[13px] font-medium text-white hover:bg-bad/70">
                Tümünü kapat ({apps.length})
              </button>
            </div>
          )}
          <p className="mt-3 text-center text-[12.5px] text-white/60">Kapatmak için kartı yukarı sürükle · Ctrl+Tab · Arka plandakileri kapat: Ctrl+Shift+Q</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
