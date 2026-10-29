import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { AuthState, DesktopUser, ModuleId, Preferences } from "@shared/contracts";

export type Route = { screen: ModuleId; params?: Record<string, string> };

type NavValue = {
  route: Route;
  go: (screen: ModuleId, params?: Record<string, string>) => void;
  back: () => void;
  forward: () => void;
  canBack: boolean;
  canForward: boolean;
};

type OverlayValue = {
  palette: boolean;
  launcher: boolean;
  notifications: boolean;
  quickTask: boolean;
  compose: { to?: string; subject?: string; text?: string; inReplyTo?: string | null } | null;
  open: (overlay: "palette" | "launcher" | "notifications" | "quickTask") => void;
  close: () => void;
  toggle: (overlay: "palette" | "launcher" | "notifications") => void;
  setCompose: (value: OverlayValue["compose"]) => void;
};

type Toast = { id: number; message: string; tone: "ok" | "bad" | "info" };

type SessionValue = {
  auth: AuthState;
  user: DesktopUser;
  preview: boolean;
  prefs: Preferences;
  setPrefs: (patch: Partial<Preferences>) => void;
  logout: () => void;
  toasts: Toast[];
  toast: (message: string, tone?: Toast["tone"]) => void;
  can: (permission: string) => boolean;
};

const NavContext = createContext<NavValue | null>(null);
const OverlayContext = createContext<OverlayValue | null>(null);
const SessionContext = createContext<SessionValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<{ stack: Route[]; index: number }>({ stack: [{ screen: "home" }], index: 0 });
  const go = useCallback((screen: ModuleId, params?: Record<string, string>) => {
    setHistory((current) => {
      const active = current.stack[current.index]!;
      if (active.screen === screen && JSON.stringify(active.params ?? {}) === JSON.stringify(params ?? {})) return current;
      const stack = [...current.stack.slice(0, current.index + 1), { screen, params }].slice(-40);
      return { stack, index: stack.length - 1 };
    });
  }, []);
  const back = useCallback(() => setHistory((current) => ({ ...current, index: Math.max(0, current.index - 1) })), []);
  const forward = useCallback(() => setHistory((current) => ({ ...current, index: Math.min(current.stack.length - 1, current.index + 1) })), []);
  const value = useMemo<NavValue>(
    () => ({ route: history.stack[history.index]!, go, back, forward, canBack: history.index > 0, canForward: history.index < history.stack.length - 1 }),
    [history, go, back, forward],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ palette: false, launcher: false, notifications: false, quickTask: false });
  const [compose, setCompose] = useState<OverlayValue["compose"]>(null);
  const value = useMemo<OverlayValue>(
    () => ({
      ...state,
      compose,
      open: (overlay) => setState({ palette: false, launcher: false, notifications: false, quickTask: false, [overlay]: true }),
      close: () => setState({ palette: false, launcher: false, notifications: false, quickTask: false }),
      toggle: (overlay) => setState((current) => ({ palette: false, launcher: false, notifications: false, quickTask: false, [overlay]: !current[overlay] })),
      setCompose,
    }),
    [state, compose],
  );
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function SessionProvider({ value, children }: { value: Omit<SessionValue, "toasts" | "toast" | "can">; children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    counter.current += 1;
    const id = counter.current;
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3800);
  }, []);
  const can = useCallback((permission: string) => value.user.role === "OWNER" || value.user.permissions.includes(permission), [value.user]);
  const merged = useMemo(() => ({ ...value, toasts, toast, can }), [value, toasts, toast, can]);
  return <SessionContext.Provider value={merged}>{children}</SessionContext.Provider>;
}

export function useNav() {
  const value = useContext(NavContext);
  if (!value) throw new Error("NavProvider eksik");
  return value;
}

export function useOverlay() {
  const value = useContext(OverlayContext);
  if (!value) throw new Error("OverlayProvider eksik");
  return value;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider eksik");
  return value;
}
