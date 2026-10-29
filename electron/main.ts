import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, net, powerMonitor, protocol, session, shell, Tray } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from "electron";
import { readFileSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import type { Preferences } from "../shared/contracts";
import { request } from "./api";
import { auth } from "./auth";
import { badgeImage } from "./badge";
import { APP_ORIGIN, DEV_URL, IS_DEV } from "./config";
import { mail } from "./mail";
import { createNotifier, toast } from "./notifier";
import { store } from "./store";
import { checkUpdate } from "./updates";

const DIST = resolve(__dirname, "../dist");
const ASSETS = IS_DEV ? resolve(__dirname, "../public") : DIST;
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

protocol.registerSchemesAsPrivileged([{ scheme: "sorvia", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setAppUserModelId("net.sorvia.desktop");
app.enableSandbox();

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let announcedUpdate: string | null = null;
const startHidden = process.argv.includes("--hidden");
const badge = { image: null as Electron.NativeImage | null, count: 0 };

function asset(name: string) {
  return join(ASSETS, name);
}

const images = new Map<string, Electron.NativeImage>();

function image(name: string) {
  let value = images.get(name);
  if (!value) {
    try {
      value = nativeImage.createFromBuffer(readFileSync(asset(name)));
    } catch {
      value = nativeImage.createEmpty();
    }
    images.set(name, value);
  }
  return value;
}

function send(channel: string, payload?: unknown) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function command(value: string) {
  showWindow();
  send("system:command", value);
}

function isAppUrl(url: string) {
  return IS_DEV ? url.startsWith(DEV_URL) : url.startsWith(`${APP_ORIGIN}/`);
}

function openSafe(url: unknown) {
  if (typeof url !== "string") return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:") void shell.openExternal(parsed.toString());
  } catch {
    return;
  }
}

function harden(contents: WebContents) {
  contents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  contents.on("will-redirect", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  contents.on("will-frame-navigate", (event) => {
    if (!event.isMainFrame && !event.url.startsWith("about:")) event.preventDefault();
  });
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    openSafe(url);
    return { action: "deny" };
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: "#0d0a09",
    title: "Sorvia Desktop",
    icon: image("icon.png"),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      devTools: IS_DEV,
      backgroundThrottling: false,
      navigateOnDragDrop: false,
      safeDialogs: true,
      additionalArguments: [`--sorvia-version=${app.getVersion()}`],
    },
  });
  win.setMenu(null);
  harden(win.webContents);
  win.once("ready-to-show", () => {
    if (!startHidden) win?.show();
  });
  win.on("maximize", () => send("window:maximized", true));
  win.on("unmaximize", () => send("window:maximized", false));
  win.on("focus", () => win?.flashFrame(false));
  win.on("close", (event) => {
    if (quitting || !store.prefs().closeToTray) return;
    event.preventDefault();
    win?.hide();
    if (!store.trayHintShown()) {
      store.setTrayHintShown();
      toast({ open: command, icon: () => image("icon.png") }, "Sorvia Desktop arka planda", "Bildirimler gelmeye devam edecek. Tamamen kapatmak için sistem tepsisindeki simgeyi kullan.", null);
    }
  });
  win.on("closed", () => {
    win = null;
  });
  if (IS_DEV) void win.loadURL(DEV_URL);
  else void win.loadURL(`${APP_ORIGIN}/index.html`);
}

function refreshTray() {
  if (!tray) return;
  const prefs = store.prefs();
  const signedIn = auth.state.status === "signedIn";
  tray.setToolTip(badge.count > 0 ? `Sorvia Desktop · ${badge.count} okunmamış` : "Sorvia Desktop");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Sorvia'yı aç", click: showWindow },
      { label: "Komut paleti", accelerator: "Ctrl+Shift+Space", click: () => command("palette") },
      { label: "Yeni görev", enabled: signedIn, click: () => command("quick-task") },
      { label: "Bildirimler", enabled: signedIn, click: () => command("notifications") },
      { type: "separator" },
      { label: "Windows bildirimleri", type: "checkbox", checked: prefs.nativeNotifications, click: (item) => applyPrefs(store.setPrefs({ nativeNotifications: item.checked }), true) },
      { label: "Windows açılınca başlat", type: "checkbox", checked: prefs.launchAtLogin, enabled: app.isPackaged, click: (item) => applyPrefs(store.setPrefs({ launchAtLogin: item.checked }), true) },
      { type: "separator" },
      {
        label: "Çıkış",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function createTray() {
  const trayImage = image("tray.png");
  tray = new Tray(trayImage.isEmpty() ? image("icon.png").resize({ width: 32, height: 32 }) : trayImage.resize({ width: 32, height: 32, quality: "best" }));
  tray.on("click", showWindow);
  tray.on("double-click", showWindow);
  refreshTray();
}

function setBadge(count: unknown) {
  const value = Math.max(0, Math.min(999, Math.floor(Number(count) || 0)));
  badge.count = value;
  if (win && !win.isDestroyed()) {
    badge.image ??= badgeImage();
    win.setOverlayIcon(value > 0 ? badge.image : null, value > 0 ? `${value} okunmamış` : "");
  }
  refreshTray();
}

const notifier = createNotifier({
  focused: () => Boolean(win?.isVisible() && win.isFocused()),
  open: command,
  icon: () => image("icon.png"),
  attention: () => {
    if (win && !win.isFocused()) win.flashFrame(true);
  },
});

function applyPrefs(prefs: Preferences, broadcast = false) {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: prefs.launchAtLogin, args: ["--hidden"] });
  notifier.restart();
  refreshTray();
  if (broadcast) send("prefs:changed", prefs);
  return prefs;
}

async function announceUpdate() {
  const info = await checkUpdate();
  if (!info?.available || announcedUpdate === info.latest) return;
  announcedUpdate = info.latest;
  toast({ open: () => openSafe(info.url), icon: () => image("icon.png") }, `Sorvia Desktop ${info.latest} hazır`, info.notes ?? "Yeni sürümü indirmek için tıkla.", "update");
}

function trusted(event: IpcMainInvokeEvent | IpcMainEvent) {
  if (!win || event.sender !== win.webContents) return false;
  return isAppUrl(event.senderFrame?.url ?? "");
}

function handle(channel: string, handler: (...args: unknown[]) => unknown) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!trusted(event)) throw new Error("Yetkisiz istek.");
    return handler(...args);
  });
}

function on(channel: string, handler: (...args: unknown[]) => void) {
  ipcMain.on(channel, (event, ...args) => {
    if (trusted(event)) handler(...args);
  });
}

function registerIpc() {
  on("window:minimize", () => win?.minimize());
  on("window:toggleMaximize", () => {
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  on("window:close", () => win?.close());
  handle("window:isMaximized", () => win?.isMaximized() ?? false);

  handle("auth:state", () => auth.state);
  handle("auth:start", () => auth.start());
  handle("auth:poll", () => auth.poll());
  handle("auth:cancel", () => auth.cancel());
  handle("auth:preview", () => auth.preview());
  handle("auth:logout", () => auth.logout());

  handle("api:get", (path, query) => request("GET", path, query));
  handle("api:send", (method, path, body) => request(method, path, undefined, body));

  handle("mail:account", () => mail.info());
  handle("mail:connect", (input) => mail.connect(input));
  handle("mail:disconnect", () => mail.disconnect());
  handle("mail:folders", () => mail.folders());
  handle("mail:list", (folder, page) => mail.list(folder, page));
  handle("mail:read", (folder, uid) => mail.read(folder, uid));
  handle("mail:setSeen", (folder, uid, seen) => mail.setSeen(folder, uid, seen));
  handle("mail:move", (folder, uid, target) => mail.move(folder, uid, target));
  handle("mail:send", (draft) => mail.send(draft));
  handle("mail:search", (folder, query) => mail.search(folder, query));
  handle("mail:saveAttachment", (folder, uid, id) => mail.saveAttachment(win, folder, uid, id));

  handle("prefs:get", () => store.prefs());
  handle("prefs:set", (patch) => applyPrefs(store.setPrefs(patch)));

  handle("system:openExternal", (url) => openSafe(url));
  handle("system:checkUpdate", () => checkUpdate());
  on("system:notify", (title, body) => {
    if (typeof title === "string" && store.prefs().nativeNotifications) toast({ open: command, icon: () => image("icon.png") }, title.slice(0, 120), typeof body === "string" ? body : "", null);
  });
  on("system:setBadge", (count) => setBadge(count));
}

function registerProtocol() {
  protocol.handle("sorvia", async (incoming) => {
    const url = new URL(incoming.url);
    if (url.host !== "app") return new Response("Bulunamadı", { status: 404 });
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = resolve(DIST, relativePath);
    if (!file.startsWith(DIST + sep)) return new Response("Yasak", { status: 403 });
    try {
      const response = await net.fetch(pathToFileURL(file).toString());
      if (!response.ok) return new Response("Bulunamadı", { status: 404 });
      const headers = new Headers({ "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" });
      if (file.endsWith(".html")) headers.set("Content-Security-Policy", CSP);
      return new Response(await response.arrayBuffer(), { status: 200, headers });
    } catch {
      return new Response("Bulunamadı", { status: 404 });
    }
  });
}

function hardenSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === "clipboard-sanitized-write"));
  ses.setPermissionCheckHandler((_contents, permission) => permission === "clipboard-sanitized-write");
  ses.setDevicePermissionHandler(() => false);
  ses.on("will-download", (event) => event.preventDefault());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("web-contents-created", (_event, contents) => harden(contents));
  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    void mail.stop();
  });
  app.on("window-all-closed", () => app.quit());

  void app.whenReady().then(() => {
    registerProtocol();
    hardenSession();
    registerIpc();

    auth.onChange((state) => {
      send("auth:changed", state);
      refreshTray();
    });
    auth.onSignedIn(() => {
      notifier.start();
      mail.start();
      if (win?.isVisible()) showWindow();
    });
    auth.onSignedOut((reason) => {
      notifier.stop();
      store.setLastNotificationAt(null);
      void (reason === "logout" ? mail.disconnect() : mail.stop());
      setBadge(0);
    });
    mail.onNew((items) => {
      send("mail:new", items.length);
      if (!store.prefs().nativeNotifications || (win?.isVisible() && win.isFocused())) return;
      const first = items[items.length - 1]!;
      toast({ open: command, icon: () => image("icon.png") }, items.length > 1 ? `${items.length} yeni e-posta` : `Yeni e-posta · ${first.from}`, first.subject, "go:mail");
      if (win && !win.isFocused()) win.flashFrame(true);
    });

    createWindow();
    createTray();
    globalShortcut.register("Control+Shift+Space", () => {
      if (win?.isVisible() && win.isFocused()) send("system:command", "palette");
      else command("palette");
    });
    applyPrefs(store.prefs());
    auth.restore();

    powerMonitor.on("resume", () => {
      void auth.refresh();
      mail.resume();
      notifier.restart();
    });
    setTimeout(() => void announceUpdate(), 20_000);
    setInterval(() => void announceUpdate(), 6 * 60 * 60 * 1000);
  });
}
