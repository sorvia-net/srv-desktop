import { RefreshCw } from "lucide-react";
import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ACCENTS } from "@shared/appearance";
import { comboFromEvent, resolveShortcuts, type ShortcutAction } from "@shared/shortcuts";
import type { AppNotification, AuthState, ChatChannel, HomeSummary, MailAccountInfo, MailFolder, ModuleId, Preferences } from "@shared/contracts";
import { api, mailApi, setPreviewMode } from "@/data/api";
import { bridge, SECONDARY_SCREEN } from "@/data/bridge";
import { previewUser } from "@/data/preview";
import { clearQueries, invalidate, useQuery } from "@/data/query";
import { playSound } from "@/data/sound";
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
import { useWebBadges } from "@/data/feed";

async function nextMailAccount(session: { toast: (message: string, tone?: "ok" | "bad" | "info") => void }) {
  const accounts = await bridge.mail.accounts();
  if (accounts.length < 2) return session.toast("Geçiş için ikinci bir posta hesabı ekle", "info");
  const index = accounts.findIndex((item) => item.active);
  const next = accounts[(index + 1) % accounts.length]!;
  await bridge.mail.switchAccount(next.id);
  invalidate("mail:");
  session.toast(`Posta: ${next.address}`, "ok");
}

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

  useEffect(() => {
    const root = document.documentElement;
    const accent = ACCENTS[prefs?.accent ?? "ember"] ?? ACCENTS.ember;
    root.style.setProperty("--color-accent", accent.base);
    root.style.setProperty("--color-accent-2", accent.light);
    root.style.setProperty("--color-accent-3", accent.soft);
    root.style.setProperty("--color-accent-ink", accent.ink);
    root.dataset.style = prefs?.uiStyle ?? "glass";
    root.dataset.density = prefs?.density ?? "comfortable";
  }, [prefs?.accent, prefs?.uiStyle, prefs?.density]);

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
  const webBadges = useWebBadges();
  const badges = useMemo<Partial<Record<string, number>>>(
    () => ({
      tasks: counts ? counts.overdueTasks + counts.dueToday : 0,
      tickets: counts?.waitingTickets ?? 0,
      chat: (channels.data ?? []).reduce((sum, item) => sum + item.unread, 0),
      mail: mailUnread,
      ...webBadges,
    }),
    [counts, channels.data, mailUnread, webBadges],
  );

  useEffect(() => {
    bridge.system.setBadge(unread + mailUnread);
  }, [unread, mailUnread]);

  const previousUnread = useRef<number | null>(null);
  useEffect(() => {
    if (!notes.data) return;
    if (!SECONDARY_SCREEN && previousUnread.current !== null && unread > previousUnread.current && !session.prefs.doNotDisturb) playSound(session.prefs.notificationSound);
    previousUnread.current = unread;
  }, [unread, notes.data, session.prefs.doNotDisturb, session.prefs.notificationSound]);

  useEffect(
    () =>
      bridge.mail.onNewMail(() => {
        const prefs = latest.current.session.prefs;
        if (!SECONDARY_SCREEN && !prefs.doNotDisturb) playSound(prefs.notificationSound);
      }),
    [],
  );

  useEffect(() => bridge.mail.onNewMail(() => invalidate("mail:")), []);
  const [update, setUpdate] = useState<string | null>(null);
  useEffect(() => {
    if (session.preview) return;
    void bridge.system.unlockedVersion().then((version) => {
      if (version !== bridge.version) latest.current.os.lock();
    });
  }, [session.preview]);
  useEffect(() => bridge.system.onUpdateReady(setUpdate), []);
  const sharedLock = useRef<boolean | null>(null);
  useEffect(() => {
    if (sharedLock.current === os.locked) return;
    sharedLock.current = os.locked;
    bridge.system.shareLock(os.locked);
  }, [os.locked]);
  useEffect(
    () =>
      bridge.system.onLockState((locked) => {
        sharedLock.current = locked;
        if (locked) latest.current.os.lock();
        else latest.current.os.unlock();
      }),
    [],
  );
  useEffect(
    () =>
      bridge.system.onOpenWeb((url) => {
        let title = url;
        try {
          title = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          return;
        }
        latest.current.overlay.close();
        latest.current.os.openApp("web", { link: `url:${url}`, url, title, at: String(Date.now()) });
      }),
    [],
  );

  const latest = useRef({ os, overlay, session, installed });
  latest.current = { os, overlay, session, installed };

  useEffect(() => {
    const order = catalog()
      .filter((item) => item.kind === "app" && item.id !== "settings")
      .map((item) => item.id as ModuleId);
    const onKey = (event: KeyboardEvent) => {
      const { os: system, overlay: layer, installed: apps, session: current } = latest.current;
      if (system.locked) return;
      if ((event.target as HTMLElement | null)?.dataset?.shortcutRecorder) return;
      const ctrl = event.ctrlKey || event.metaKey;
      const combo = comboFromEvent(event);
      const map = resolveShortcuts(current.prefs.shortcuts);
      const action = combo ? (Object.keys(map) as ShortcutAction[]).find((name) => name !== "global" && map[name] === combo) : undefined;
      const shortcuts = order.filter((id) => apps.has(id));
      const run = (work: () => void) => {
        event.preventDefault();
        work();
      };
      if (action === "palette") run(() => layer.toggle("palette"));
      else if (action === "quickTask" && apps.has("tasks")) run(() => layer.open("quickTask"));
      else if (action === "notifications") run(() => layer.toggle("notifications"));
      else if (action === "control") run(() => system.setControl(!system.control));
      else if (action === "settings") run(() => system.openApp("settings"));
      else if (action === "home") run(() => { layer.close(); system.goHome(); });
      else if (action === "closeApp" && system.active) run(() => { layer.close(); system.closeApp(system.active!); })
      else if (action === "closeBackground") run(() => { const others = system.openApps.filter((id) => id !== system.active); others.forEach((id) => system.closeApp(id)); if (others.length) current.toast(`${others.length} uygulama kapatıldı`, "ok"); })
      else if (action === "switcher") run(() => system.setSwitcher(!system.switcher));
      else if (action === "lock") run(() => system.lock());
      else if (action === "refresh") run(() => invalidate(""));
      else if (action === "mail" && apps.has("mail")) run(() => { layer.close(); system.openApp("mail"); });
      else if (action === "nextAccount") run(() => void nextMailAccount(current));
      else if (ctrl && /^[1-9]$/.test(event.key)) {
        const target = shortcuts[Number(event.key) - 1];
        if (target) {
          event.preventDefault();
          layer.close();
          system.openApp(target);
        }
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
      if (!SECONDARY_SCREEN && !system.locked && Date.now() - last > minutes * 60_000) system.lock();
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
        {update && (
          <button
            onClick={() => bridge.system.installUpdate()}
            className="accent-fill absolute right-5 top-14 z-[70] flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold"
          >
            <RefreshCw className="size-4" /> Sorvia {update} hazır · Yeniden başlat
          </button>
        )}
      </div>
    </BadgeContext.Provider>
  );
}
