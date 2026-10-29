import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AppNotification, AuthState, ChatChannel, HomeSummary, MailAccountInfo, MailFolder, ModuleId, Preferences } from "@shared/contracts";
import { api, mailApi, setPreviewMode } from "@/data/api";
import { bridge } from "@/data/bridge";
import { previewUser } from "@/data/preview";
import { clearQueries, invalidate, useQuery } from "@/data/query";
import { Spinner } from "@/design/ui";
import { ControlCenter } from "@/os/ControlCenter";
import { BadgeContext, HomeScreen } from "@/os/Home";
import { LockScreen } from "@/os/LockScreen";
import { ModulesProvider, useModules } from "@/os/modules";
import { catalog } from "@/os/registry";
import { OsProvider, useOs } from "@/os/state";
import { StatusBar } from "@/os/StatusBar";
import { AppHost, AppSwitcher } from "@/os/Windows";
import { Connect } from "@/screens/Connect";
import { Background } from "@/shell/Background";
import { OverlayProvider, SessionProvider, useOverlay, useSession } from "@/shell/context";
import { CommandPalette, NotificationCenter, PreviewBanner, QuickTask, Toasts } from "@/shell/overlays";

function identity(state: AuthState) {
  if (state.status === "signedIn") return `user:${state.user.id}`;
  return state.status === "preview" ? "preview" : "none";
}

export function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [prefs, setPrefsState] = useState<Preferences | null>(null);
  const current = useRef("none");

  const apply = useCallback((next: AuthState) => {
    const id = identity(next);
    if (id !== current.current) {
      current.current = id;
      setPreviewMode(next.status === "preview");
      clearQueries();
    }
    setAuth(next);
  }, []);

  useEffect(() => {
    void bridge.auth.state().then(apply);
    void bridge.prefs.get().then(setPrefsState);
    const offAuth = bridge.auth.onChange(apply);
    const offPrefs = bridge.prefs.onChange(setPrefsState);
    return () => {
      offAuth();
      offPrefs();
    };
  }, [apply]);

  const setPrefs = useCallback((patch: Partial<Preferences>) => {
    setPrefsState((value) => (value ? { ...value, ...patch } : value));
    void bridge.prefs.set(patch).then(setPrefsState);
  }, []);

  const logout = useCallback(() => {
    void bridge.auth.logout().then(apply);
  }, [apply]);

  const reduce = prefs?.reduceMotion ?? "system";
  useEffect(() => {
    document.documentElement.dataset.motion = reduce === "on" ? "off" : "on";
  }, [reduce]);

  const session = useMemo(() => {
    if (!auth || !prefs) return null;
    if (auth.status === "signedIn") return { auth, user: auth.user, preview: false, prefs, setPrefs, logout };
    if (auth.status === "preview") return { auth, user: previewUser, preview: true, prefs, setPrefs, logout };
    return null;
  }, [auth, prefs, setPrefs, logout]);

  return (
    <MotionConfig reducedMotion={reduce === "on" ? "always" : reduce === "off" ? "never" : "user"}>
      <Background wallpaper={prefs?.wallpaper ?? "ember"} />
      {!auth || !prefs ? (
        <div className="flex h-full items-center justify-center">
          <Spinner className="size-6" />
        </div>
      ) : session ? (
        <SessionProvider key={identity(auth)} value={session}>
          <OverlayProvider>
            <OsProvider>
              <ModulesProvider>
                <Desktop onConnect={() => void bridge.auth.start().then(apply)} />
              </ModulesProvider>
            </OsProvider>
          </OverlayProvider>
        </SessionProvider>
      ) : (
        <Connect auth={auth as Extract<AuthState, { status: "signedOut" | "linking" }>} onChange={apply} />
      )}
    </MotionConfig>
  );
}

function Desktop({ onConnect }: { onConnect: () => void }) {
  const os = useOs();
  const overlay = useOverlay();
  const session = useSession();
  const { installed } = useModules();
  const poll = session.prefs.pollSeconds * 1000;

  const home = useQuery<HomeSummary>("home", () => api.home(), { refreshMs: poll });
  const notes = useQuery<AppNotification[]>("notifications", () => api.notifications(), { refreshMs: poll });
  const channels = useQuery<ChatChannel[]>("chat:channels", () => api.channels(), { refreshMs: 60_000, enabled: installed.has("chat") });
  const account = useQuery<MailAccountInfo | null>("mail:account", () => mailApi.account(), { enabled: installed.has("mail") });
  const folders = useQuery<MailFolder[]>("mail:folders", () => mailApi.folders(), { refreshMs: 120_000, enabled: installed.has("mail") && Boolean(account.data) });

  const unread = (notes.data ?? []).filter((item) => !item.readAt).length;
  const mailUnread = installed.has("mail") && account.data ? (folders.data?.find((item) => item.role === "INBOX")?.unread ?? 0) : 0;
  const counts = home.data?.counts;
  const badges = useMemo<Partial<Record<string, number>>>(
    () => ({
      tasks: counts ? counts.overdueTasks + counts.dueToday : 0,
      tickets: counts?.waitingTickets ?? 0,
      chat: (channels.data ?? []).reduce((sum, item) => sum + item.unread, 0),
      mail: mailUnread,
    }),
    [counts, channels.data, mailUnread],
  );

  useEffect(() => {
    bridge.system.setBadge(unread + mailUnread);
  }, [unread, mailUnread]);

  useEffect(() => bridge.mail.onNewMail(() => invalidate("mail:")), []);

  const latest = useRef({ os, overlay, session, installed });
  latest.current = { os, overlay, session, installed };

  useEffect(() => {
    const order = catalog()
      .filter((item) => item.kind === "app" && item.id !== "settings")
      .map((item) => item.id as ModuleId);
    const onKey = (event: KeyboardEvent) => {
      const { os: system, overlay: layer, installed: apps } = latest.current;
      if (system.locked) return;
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const shortcuts = order.filter((id) => apps.has(id));
      if (ctrl && key === "k") {
        event.preventDefault();
        layer.toggle("palette");
      } else if (ctrl && key === "n" && !event.shiftKey && apps.has("tasks")) {
        event.preventDefault();
        layer.open("quickTask");
      } else if (ctrl && event.key === ",") {
        event.preventDefault();
        system.openApp("settings");
      } else if (ctrl && key === "h") {
        event.preventDefault();
        layer.close();
        system.goHome();
      } else if (ctrl && event.key === "Tab") {
        event.preventDefault();
        system.setSwitcher(!system.switcher);
      } else if (ctrl && key === "l") {
        event.preventDefault();
        system.lock();
      } else if (ctrl && /^[1-9]$/.test(event.key)) {
        const target = shortcuts[Number(event.key) - 1];
        if (target) {
          event.preventDefault();
          layer.close();
          system.openApp(target);
        }
      } else if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        system.goHome();
      } else if (event.key === "F5" || (ctrl && key === "r")) {
        event.preventDefault();
        invalidate("");
      } else if (event.key === "Escape") {
        if (layer.palette || layer.notifications || layer.quickTask) layer.close();
        else if (system.folder) system.openFolder(null);
        else if (system.switcher) system.setSwitcher(false);
        else if (system.control) system.setControl(false);
        else if (system.editing) system.setEditing(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () =>
      bridge.system.onCommand((command) => {
        const { os: system, overlay: layer, session: current, installed: apps } = latest.current;
        const [name, screen, id] = command.split(":");
        if (name === "palette") layer.open("palette");
        else if (name === "quick-task") layer.open("quickTask");
        else if (name === "notifications") layer.open("notifications");
        else if (name === "refresh") invalidate("");
        else if (name === "logout") current.logout();
        else if (name === "lock") system.lock();
        else if (name === "home") system.goHome();
        else if (name === "go" && screen && apps.has(screen)) {
          layer.close();
          system.openApp(screen as ModuleId, id ? { id } : undefined);
        }
      }),
    [],
  );

  useEffect(() => {
    const minutes = session.prefs.autoLockMinutes;
    if (!minutes) return;
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    const events = ["mousemove", "mousedown", "keydown", "wheel"] as const;
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));
    const timer = window.setInterval(() => {
      const system = latest.current.os;
      if (!system.locked && Date.now() - last > minutes * 60_000) system.lock();
    }, 10_000);
    return () => {
      events.forEach((name) => window.removeEventListener(name, touch));
      window.clearInterval(timer);
    };
  }, [session.prefs.autoLockMinutes]);

  return (
    <BadgeContext.Provider value={badges}>
      <div className="relative flex h-full flex-col">
        <StatusBar unread={unread} />
        {session.preview && <PreviewBanner onConnect={onConnect} />}
        <div className="relative min-h-0 flex-1">
          <HomeScreen visible={!os.active} />
          <AppHost />
        </div>
        <AppSwitcher />
        <ControlCenter />
        <CommandPalette />
        <NotificationCenter />
        <QuickTask />
        <LockScreen />
        <Toasts />
      </div>
    </BadgeContext.Provider>
  );
}
