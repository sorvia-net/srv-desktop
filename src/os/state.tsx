import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { ModuleId } from "@shared/contracts";
import { bridge } from "@/data/bridge";
import { NavContext, type NavValue } from "@/shell/context";

type Params = Record<string, string> | undefined;

type OsValue = {
  active: ModuleId | null;
  openApps: ModuleId[];
  params: Partial<Record<ModuleId, Params>>;
  origin: { x: number; y: number } | null;
  snapshots: Partial<Record<ModuleId, string>>;
  switcher: boolean;
  control: boolean;
  locked: boolean;
  folder: string | null;
  editing: boolean;
  openApp: (id: ModuleId, params?: Params, from?: DOMRect | null, local?: boolean) => void;
  goHome: () => void;
  closeApp: (id: ModuleId) => void;
  setSwitcher: (value: boolean) => void;
  setControl: (value: boolean) => void;
  lock: () => void;
  unlock: () => void;
  openFolder: (id: string | null) => void;
  setEditing: (value: boolean) => void;
};

const OsContext = createContext<OsValue | null>(null);

const MAX_OPEN = 8;

export function OsProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ModuleId | null>(null);
  const [openApps, setOpenApps] = useState<ModuleId[]>([]);
  const openRef = useRef<ModuleId[]>([]);
  openRef.current = openApps;
  const [params, setParams] = useState<Partial<Record<ModuleId, Params>>>({});
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [snapshots, setSnapshots] = useState<Partial<Record<ModuleId, string>>>({});
  const [switcher, setSwitcher] = useState(false);
  const [control, setControl] = useState(false);
  const [locked, setLocked] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const activeRef = useRef<ModuleId | null>(null);
  activeRef.current = active;

  const remember = useCallback(async () => {
    const current = activeRef.current;
    if (!current) return;
    const shot = await bridge.window.capture().catch(() => null);
    if (shot) setSnapshots((map) => ({ ...map, [current]: shot }));
  }, []);

  const openApp = useCallback(
    (id: ModuleId, next?: Params, from?: DOMRect | null, local = false) => {
      void (async () => {
        if (!local && id !== "home" && !openRef.current.includes(id) && !(await bridge.system.claimApp(id, (next as Record<string, string> | undefined) ?? null))) return;
        if (activeRef.current && activeRef.current !== id) await remember();
        if (from) setOrigin({ x: from.left + from.width / 2, y: from.top + from.height / 2 });
        if (next !== undefined) setParams((map) => ({ ...map, [id]: next }));
        setOpenApps((list) => [...list.filter((item) => item !== id), id].slice(-MAX_OPEN));
        setFolder(null);
        setSwitcher(false);
        setControl(false);
        setEditing(false);
        setActive(id);
      })();
    },
    [remember],
  );

  const goHome = useCallback(() => {
    void (async () => {
      await remember();
      setSwitcher(false);
      setControl(false);
      setActive(null);
    })();
  }, [remember]);

  const closeApp = useCallback((id: ModuleId) => {
    setOpenApps((list) => list.filter((item) => item !== id));
    setSnapshots((map) => {
      const copy = { ...map };
      delete copy[id];
      return copy;
    });
    setActive((current) => (current === id ? null : current));
  }, []);

  const value = useMemo<OsValue>(
    () => ({
      active,
      openApps,
      params,
      origin,
      snapshots,
      switcher,
      control,
      locked,
      folder,
      editing,
      openApp,
      goHome,
      closeApp,
      setSwitcher: (value) => {
        if (value) void remember();
        setControl(false);
        setSwitcher(value);
      },
      setControl: (value) => {
        setSwitcher(false);
        setControl(value);
      },
      lock: () => {
        setSwitcher(false);
        setControl(false);
        setFolder(null);
        setLocked(true);
      },
      unlock: () => setLocked(false),
      openFolder: setFolder,
      setEditing,
    }),
    [active, openApps, params, origin, snapshots, switcher, control, locked, folder, editing, openApp, goHome, closeApp, remember],
  );

  const nav = useMemo<NavValue>(
    () => ({ route: { screen: active ?? "home", params: active ? params[active] : undefined }, go: (screen, next) => openApp(screen, next), back: goHome, forward: () => undefined, canBack: active !== null, canForward: false }),
    [active, params, openApp, goHome],
  );

  return (
    <OsContext.Provider value={value}>
      <NavContext.Provider value={nav}>{children}</NavContext.Provider>
    </OsContext.Provider>
  );
}

export function AppNav({ id, children }: { id: ModuleId; children: ReactNode }) {
  const os = useOs();
  const nav = useMemo<NavValue>(
    () => ({ route: { screen: id, params: os.params[id] }, go: (screen, next) => os.openApp(screen, next), back: os.goHome, forward: () => undefined, canBack: true, canForward: false }),
    [id, os],
  );
  return <NavContext.Provider value={nav}>{children}</NavContext.Provider>;
}

export function useOs() {
  const value = useContext(OsContext);
  if (!value) throw new Error("OsProvider eksik");
  return value;
}
