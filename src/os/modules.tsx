import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { HomeLayout, StoreCatalog } from "@shared/contracts";
import { api } from "@/data/api";
import { bridge } from "@/data/bridge";
import { dropQueries, useQuery } from "@/data/query";
import { useSession } from "@/shell/context";

import { catalog, DEFAULT_LAYOUT, installedSet, itemById, setRemoteModules } from "./registry";
import { useOs } from "./state";

type ModulesValue = {
  installed: Set<string>;
  installing: Set<string>;
  featured: string | null;
  notice: string | null;
  revision: number;
  install: (id: string) => Promise<void>;
  uninstall: (id: string) => Promise<void>;
};

const ModulesContext = createContext<ModulesValue | null>(null);

const CLEANUP: Record<string, { prefixes: string[]; run?: () => Promise<unknown> }> = {
  mail: { prefixes: ["mail:"], run: () => bridge.mail.disconnect() },
  tasks: { prefixes: ["tasks:"] },
  tickets: { prefixes: ["tickets:", "ticket:"] },
  chat: { prefixes: ["chat:"] },
  calendar: { prefixes: ["calendar:"] },
  gallery: { prefixes: ["media:"] },
  storage: { prefixes: ["drive:", "storage:", "files:"] },
};

export function ModulesProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const os = useOs();
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [revision, setRevision] = useState(0);
  const store = useQuery<StoreCatalog>("store:catalog", () => api.store(), { refreshMs: 30 * 60_000 });

  useEffect(() => {
    if (!store.data) return;
    setRemoteModules(store.data.modules);
    setRevision((value) => value + 1);
  }, [store.data]);

  const installed = useMemo(() => installedSet(session.prefs.installed, session.user), [session.prefs.installed, session.user, revision]);

  const install = useCallback(
    async (id: string) => {
      const item = itemById(id);
      if (!item || item.kind === "folder" || installed.has(id)) return;
      setInstalling((set) => new Set(set).add(id));
      await new Promise((resolve) => setTimeout(resolve, 1100));
      session.setPrefs({ installed: [...installed, id] });
      setInstalling((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
      session.toast(`${item.title} yüklendi`, "ok");
    },
    [installed, session],
  );

  const uninstall = useCallback(
    async (id: string) => {
      const item = itemById(id);
      if (!item || item.kind === "folder") return;
      if (item.system) {
        session.toast(`${item.title} bir sistem uygulaması; kaldırılamaz`, "info");
        return;
      }
      const cleanup = CLEANUP[id];
      if (cleanup?.run && !session.preview) await cleanup.run().catch(() => undefined);
      for (const prefix of cleanup?.prefixes ?? []) dropQueries(prefix);
      if (item.kind === "app") os.closeApp(item.id);
      const layout: HomeLayout = session.prefs.homeLayout ?? DEFAULT_LAYOUT;
      session.setPrefs({
        installed: [...installed].filter((entry) => entry !== id),
        homeLayout: { grid: layout.grid.filter((entry) => entry !== id), dock: layout.dock.filter((entry) => entry !== id) },
      });
      session.toast(`${item.title} kaldırıldı`, "ok");
    },
    [installed, os, session],
  );

  const value = useMemo<ModulesValue>(
    () => ({ installed, installing, featured: store.data?.featured ?? "mail", notice: store.data?.notice ?? null, revision, install, uninstall }),
    [installed, installing, store.data, revision, install, uninstall],
  );
  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules() {
  const value = useContext(ModulesContext);
  if (!value) throw new Error("ModulesProvider eksik");
  return value;
}

export function useCatalog() {
  const { revision } = useModules();
  return useMemo(() => catalog(), [revision]);
}
