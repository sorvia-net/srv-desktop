import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { AuthState, DesktopUser, ModuleId, Preferences } from "@shared/contracts";

export type Route = { screen: ModuleId; params?: Record<string, string> };

export type NavValue = {
  route: Route;
  go: (screen: ModuleId, params?: Record<string, string>) => void;
  back: () => void;
  forward: () => void;
  canBack: boolean;
  canForward: boolean;
};

type Overlay = "palette" | "notifications" | "quickTask";

type OverlayValue = {
  palette: boolean;
  notifications: boolean;
  quickTask: boolean;
  compose: { to?: string; subject?: string; text?: string; inReplyTo?: string | null } | null;
  open: (overlay: Overlay) => void;
  close: () => void;
  toggle: (overlay: Overlay) => void;
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

export const NavContext = createContext<NavValue | null>(null);
const OverlayContext = createContext<OverlayValue | null>(null);
const SessionContext = createContext<SessionValue | null>(null);

const CLOSED = { palette: false, notifications: false, quickTask: false };

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(CLOSED);
  const [compose, setCompose] = useState<OverlayValue["compose"]>(null);
  const value = useMemo<OverlayValue>(
    () => ({
      ...state,
      compose,
      open: (overlay) => setState({ ...CLOSED, [overlay]: true }),
      close: () => setState(CLOSED),
      toggle: (overlay) => setState((current) => ({ ...CLOSED, [overlay]: !current[overlay] })),
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
  if (!value) throw new Error("NavContext eksik");
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
