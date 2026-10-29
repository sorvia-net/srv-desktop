import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AppNotification, AuthState, ChatChannel, HomeSummary, MailAccountInfo, MailFolder, ModuleId, Preferences } from "@shared/contracts";
import { api, mailApi, setPreviewMode } from "@/data/api";
import { bridge } from "@/data/bridge";
import { previewUser } from "@/data/preview";
import { clearQueries, invalidate, useQuery } from "@/data/query";
import { Spinner } from "@/design/ui";
import { Calendar } from "@/screens/Calendar";
import { Chat } from "@/screens/Chat";
import { Connect } from "@/screens/Connect";
import { Home } from "@/screens/Home";
import { Mail } from "@/screens/Mail";
import { Settings } from "@/screens/Settings";
import { Tasks } from "@/screens/Tasks";
import { Tickets } from "@/screens/Tickets";
import { Background } from "@/shell/Background";
import { NavProvider, OverlayProvider, SessionProvider, useNav, useOverlay, useSession } from "@/shell/context";
import { Dock } from "@/shell/Dock";
import { MODULES } from "@/shell/modules";
import { CommandPalette, Launcher, NotificationCenter, PreviewBanner, QuickTask, Toasts } from "@/shell/overlays";
import { TitleBar } from "@/shell/TitleBar";

const SCREENS: Record<ModuleId, () => React.ReactNode> = {
  home: Home,
  tasks: Tasks,
  calendar: Calendar,
  tickets: Tickets,
  mail: Mail,
  chat: Chat,
  settings: Settings,
};

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
          <NavProvider>
            <OverlayProvider>
              <Workspace onConnect={() => void bridge.auth.start().then(apply)} />
            </OverlayProvider>
          </NavProvider>
        </SessionProvider>
      ) : (
        <Connect auth={auth as Extract<AuthState, { status: "signedOut" | "linking" }>} onChange={apply} />
      )}
    </MotionConfig>
  );
}

function Workspace({ onConnect }: { onConnect: () => void }) {
  const nav = useNav();
  const overlay = useOverlay();
  const session = useSession();
  const modules = session.user.modules;
  const poll = session.prefs.pollSeconds * 1000;

  const home = useQuery<HomeSummary>("home", () => api.home(), { refreshMs: poll });
  const notes = useQuery<AppNotification[]>("notifications", () => api.notifications(), { refreshMs: poll });
  const channels = useQuery<ChatChannel[]>("chat:channels", () => api.channels(), { refreshMs: 60_000, enabled: modules.includes("chat") });
  const account = useQuery<MailAccountInfo | null>("mail:account", () => mailApi.account(), { enabled: modules.includes("mail") });
  const folders = useQuery<MailFolder[]>("mail:folders", () => mailApi.folders(), { refreshMs: 120_000, enabled: Boolean(account.data) });

  const unread = (notes.data ?? []).filter((item) => !item.readAt).length;
  const mailUnread = account.data ? (folders.data?.find((item) => item.role === "INBOX")?.unread ?? 0) : 0;
  const counts = home.data?.counts;
  const badges: Partial<Record<ModuleId, number>> = {
    tasks: counts ? counts.overdueTasks + counts.dueToday : 0,
    tickets: counts?.waitingTickets ?? 0,
    chat: (channels.data ?? []).reduce((sum, item) => sum + item.unread, 0),
    mail: mailUnread,
  };

  useEffect(() => {
    bridge.system.setBadge(unread + mailUnread);
  }, [unread, mailUnread]);

  useEffect(() => bridge.mail.onNewMail(() => invalidate("mail:")), []);

  const { go, back, forward } = nav;
  const { open, close, toggle } = overlay;
  const { logout } = session;

  useEffect(() => {
    const shortcuts = MODULES.filter((item) => item.id !== "settings" && modules.includes(item.id));
    const onKey = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle("palette");
      } else if (ctrl && event.key.toLowerCase() === "n" && !event.shiftKey) {
        event.preventDefault();
        open("quickTask");
      } else if (ctrl && event.key === ",") {
        event.preventDefault();
        go("settings");
      } else if (ctrl && /^[1-9]$/.test(event.key)) {
        const target = shortcuts[Number(event.key) - 1];
        if (target) {
          event.preventDefault();
          close();
          go(target.id);
        }
      } else if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      } else if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        forward();
      } else if (event.key === "F5" || (ctrl && event.key.toLowerCase() === "r")) {
        event.preventDefault();
        invalidate("");
      } else if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modules, go, back, forward, open, close, toggle]);

  useEffect(
    () =>
      bridge.system.onCommand((command) => {
        const [name, screen, id] = command.split(":");
        if (name === "palette") open("palette");
        else if (name === "quick-task") open("quickTask");
        else if (name === "notifications") open("notifications");
        else if (name === "refresh") invalidate("");
        else if (name === "logout") logout();
        else if (name === "go" && screen && modules.includes(screen as ModuleId)) {
          close();
          go(screen as ModuleId, id ? { id } : undefined);
        }
      }),
    [modules, open, close, go, logout],
  );

  const Screen = SCREENS[nav.route.screen] ?? Home;

  return (
    <div className="relative flex h-full flex-col">
      <TitleBar unread={unread} />
      {session.preview && <PreviewBanner onConnect={onConnect} />}
      <div className="relative flex min-h-0 flex-1 items-stretch gap-5 px-6 pb-6 pt-4">
        <div className="flex items-center">
          <Dock badges={badges} />
        </div>
        <main className="glass-panel relative min-w-0 flex-1 overflow-hidden rounded-[34px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${nav.route.screen}`}
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
              className="h-full px-9 pb-8 pt-8"
            >
              <Screen />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette />
      <Launcher badges={badges as Record<string, number>} />
      <NotificationCenter />
      <QuickTask />
      <Toasts />
    </div>
  );
}
