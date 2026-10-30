import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, Menu, nativeImage, net, powerMonitor, protocol, screen, session, shell, Tray } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from "electron";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import type { Preferences } from "../shared/contracts";
import { request } from "./api";
import { auth, setLinkOpener } from "./auth";
import { badgeImage } from "./badge";
import { APP_ORIGIN, DEV_URL, IS_DEV, SERVER, userAgent } from "./config";
import { mail } from "./mail";
import { createNotifier, toast } from "./notifier";
import { files } from "./files";
import { store } from "./store";
import { resolveShortcuts, toAccelerator } from "../shared/shortcuts";
import { checkUpdate } from "./updates";
import { updater } from "./updater";

const DIST = resolve(__dirname, "../dist");
const ASSETS = IS_DEV ? resolve(__dirname, "../public") : DIST;
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob: https://sorvia.net https://*.sorvia.net",
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
  ".mp3": "audio/mpeg",
  ".jpg": "image/jpeg",
};

protocol.registerSchemesAsPrivileged([{ scheme: "sorvia", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setAppUserModelId("net.sorvia.desktop");
app.enableSandbox();

let win: BrowserWindow | null = null;
const extras = new Map<number, BrowserWindow>();
const openByWindow = new Map<number, string[]>();
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

const MAIN_ONLY = new Set(["system:command", "system:openWeb", "window:maximized"]);

function send(channel: string, payload?: unknown) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  if (MAIN_ONLY.has(channel)) return;
  for (const extra of extras.values()) if (!extra.isDestroyed()) extra.webContents.send(channel, payload);
}

function appWindowPreferences() {
  return {
    preload: join(__dirname, "preload.cjs"),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    spellcheck: false,
    webviewTag: true,
    devTools: IS_DEV,
    backgroundThrottling: false,
    navigateOnDragDrop: false,
    safeDialogs: true,
    additionalArguments: [`--sorvia-version=${app.getVersion()}`],
  };
}

function syncScreens() {
  if (!win || win.isDestroyed()) return;
  const enabled = store.prefs().extraScreens && auth.state.status !== "signedOut";
  const mainDisplay = screen.getDisplayMatching(win.getBounds()).id;
  const wanted = enabled ? screen.getAllDisplays().filter((display) => display.id !== mainDisplay) : [];
  for (const [id, extra] of extras) {
    if (!wanted.some((display) => display.id === id)) {
      extras.delete(id);
      if (!extra.isDestroyed()) extra.destroy();
    }
  }
  for (const display of wanted) {
    const current = extras.get(display.id);
    if (current && !current.isDestroyed()) {
      current.setBounds(display.workArea);
      continue;
    }
    const extra = new BrowserWindow({
      ...display.workArea,
      show: false,
      frame: false,
      skipTaskbar: true,
      backgroundColor: "#0d0a09",
      title: "Sorvia Desktop",
      icon: image("icon.png"),
      webPreferences: appWindowPreferences(),
    });
    extra.setMenu(null);
    harden(extra.webContents);
    extra.once("ready-to-show", () => {
      extra.maximize();
      extra.showInactive();
    });
    extra.on("closed", () => {
      if (extras.get(display.id) === extra) extras.delete(display.id);
    });
    extras.set(display.id, extra);
    const query = `?ekran=${display.id}`;
    if (IS_DEV) void extra.loadURL(`${DEV_URL}${query}`);
    else void extra.loadURL(`${APP_ORIGIN}/index.html${query}`);
  }
}

function senderWindow(event: IpcMainEvent | IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender);
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
    if (parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:" || parsed.toString() === "ms-settings:signinoptions") void shell.openExternal(parsed.toString());
  } catch {
    return;
  }
}

function webAllowed(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function hardenGuest(contents: WebContents) {
  contents.on("will-navigate", (event, url) => {
    if (!webAllowed(url)) {
      event.preventDefault();
      openSafe(url);
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (webAllowed(url)) void contents.loadURL(url);
    else openSafe(url);
    return { action: "deny" };
  });
}

function isAppHost(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && APP_WINDOW_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

function harden(contents: WebContents) {
  if (contents.getType() === "webview" || contents.session !== session.defaultSession) return hardenGuest(contents);
  contents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  contents.on("will-redirect", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  contents.on("will-frame-navigate", (event) => {
    if (!event.isMainFrame && !event.url.startsWith("about:")) event.preventDefault();
  });
  contents.on("will-attach-webview", (event, preferences, params) => {
    if (!webAllowed(params.src ?? "")) return event.preventDefault();
    delete preferences.preload;
    if (isAppHost(params.src ?? "")) preferences.preload = join(__dirname, "webapp-preload.cjs");
    preferences.nodeIntegration = false;
    preferences.contextIsolation = true;
    preferences.sandbox = true;
    preferences.webSecurity = true;
    preferences.partition = "persist:sorvia-web";
  });
  contents.setWindowOpenHandler(({ url }) => {
    openInside(url);
    return { action: "deny" };
  });
}

const APP_WINDOW_HOSTS = ["open.spotify.com", "web.whatsapp.com", "discord.com", "music.youtube.com", "www.youtube.com", "web.telegram.org"];

function chromiumBrowser() {
  const roots = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean) as string[];
  const candidates = roots.flatMap((root) => [join(root, "Microsoft", "Edge", "Application", "msedge.exe"), join(root, "Google", "Chrome", "Application", "chrome.exe")]);
  return candidates.find((path) => existsSync(path)) ?? null;
}

function openAppWindow(url: unknown, id: unknown) {
  if (typeof url !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || !APP_WINDOW_HOSTS.includes(parsed.hostname)) return false;
  const browser = chromiumBrowser();
  if (!browser) {
    void shell.openExternal(parsed.toString());
    return true;
  }
  const profile = join(app.getPath("userData"), "app-windows", typeof id === "string" ? id.replace(/[^\w-]/g, "") || "default" : "default");
  const child = spawn(browser, [`--app=${parsed.toString()}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--window-size=1280,820"], { detached: true, stdio: "ignore" });
  child.unref();
  return true;
}

function openInside(url: unknown) {
  if (typeof url !== "string") return;
  if (!webAllowed(url) || !win || win.isDestroyed() || auth.state.status !== "signedIn") return openSafe(url);
  showWindow();
  send("system:openWeb", url);
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
      webviewTag: true,
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
    for (const extra of extras.values()) if (!extra.isDestroyed()) extra.destroy();
    extras.clear();
  });
  win.on("hide", () => {
    for (const extra of extras.values()) if (!extra.isDestroyed()) extra.hide();
  });
  win.on("show", () => {
    for (const extra of extras.values()) if (!extra.isDestroyed()) extra.showInactive();
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

let chosenScreen: string | null = null;
let globalCombo = "";

async function screenSources() {
  const sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 320, height: 180 } });
  return sources
    .filter((source) => source.name && !/Sorvia Desktop/i.test(source.name))
    .slice(0, 24)
    .map((source) => ({ id: source.id, name: source.id.startsWith("screen:") ? `Ekran ${source.display_id || ""}`.trim() : source.name, thumbnail: source.thumbnail.toDataURL(), display: source.id.startsWith("screen:") }));
}

async function passkeyUnlock(kind: "unlock" | "register" = "unlock", password = "") {
  const started =
    kind === "register"
      ? await request<{ code: string; url: string }>("POST", "/api/desktop/unlock/passkey/register", undefined, { password })
      : await request<{ code: string; url: string }>("POST", "/api/desktop/unlock/passkey", undefined, {});
  if (!started.ok) return started;
  const bounds = win?.getBounds();
  const popup = new BrowserWindow({
    width: 300,
    height: 110,
    ...(bounds ? { x: Math.round(bounds.x + bounds.width / 2 - 150), y: bounds.y + 56 } : {}),
    parent: win ?? undefined,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: "Yüz tanıma",
    backgroundColor: "#100d0b",
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: "sorvia-unlock" },
  });
  popup.setMenu(null);
  popup.once("ready-to-show", () => popup.focus());
  void popup.loadURL(started.data.url);
  const deadline = Date.now() + 5 * 60_000;
  return new Promise<{ ok: true; data: true } | { ok: false; status: number; error: string; message: string }>((resolve) => {
    let done = false;
    const finish = (value: { ok: true; data: true } | { ok: false; status: number; error: string; message: string }) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      if (!popup.isDestroyed()) setTimeout(() => !popup.isDestroyed() && popup.destroy(), value.ok ? 700 : 0);
      resolve(value);
    };
    popup.on("closed", () => setTimeout(() => finish({ ok: false, status: 0, error: "cancelled", message: "Doğrulama penceresi kapatıldı." }), 1500));
    const timer = setInterval(async () => {
      if (Date.now() > deadline) return finish({ ok: false, status: 408, error: "timeout", message: "Doğrulama zaman aşımına uğradı." });
      const state = await request<{ state: string }>("GET", "/api/desktop/unlock/passkey", { code: started.data.code });
      if (state.ok && state.data.state === "verified") finish({ ok: true, data: true });
      else if (state.ok && state.data.state === "expired") finish({ ok: false, status: 410, error: "expired", message: "Doğrulama süresi doldu." });
    }, 1500);
  });
}

function registerGlobal(prefs: Preferences) {
  const combo = resolveShortcuts(prefs.shortcuts).global;
  if (combo === globalCombo) return;
  if (globalCombo) globalShortcut.unregister(toAccelerator(globalCombo));
  globalCombo = combo;
  if (!combo) return;
  try {
    globalShortcut.register(toAccelerator(combo), () => {
      if (win?.isVisible() && win.isFocused()) send("system:command", "palette");
      else command("palette");
    });
  } catch {
    globalCombo = "";
  }
}

const wallpaperFile = () => join(app.getPath("userData"), "wallpaper.jpg");

function wallpaperImage() {
  const file = wallpaperFile();
  return existsSync(file) ? `data:image/jpeg;base64,${readFileSync(file).toString("base64")}` : null;
}

async function pickImage(extensions: string[]) {
  const options = { properties: ["openFile" as const], filters: [{ name: "Görseller", extensions }] };
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return null;
  const picture = nativeImage.createFromPath(result.filePaths[0]);
  return picture.isEmpty() ? "invalid" : picture;
}

async function pickWallpaper() {
  const picked = await pickImage(["png", "jpg", "jpeg", "webp", "bmp"]);
  if (!picked || picked === "invalid") return null;
  const picture = picked.getSize().width > 2560 ? picked.resize({ width: 2560, quality: "best" }) : picked;
  writeFileSync(wallpaperFile(), picture.toJPEG(86));
  applyPrefs(store.setPrefs({ wallpaper: "custom" }), true);
  return wallpaperImage();
}

async function uploadRequest(path: unknown, bytes: unknown, name: unknown, voice: unknown) {
  if (typeof path !== "string" || !/^\/api\/desktop\/chat\/[\w-]+\/upload$/.test(path) || !(bytes instanceof Uint8Array) || bytes.byteLength > 25 * 1024 * 1024) return { ok: false as const, status: 400, error: "invalid", message: "Dosya gönderilemedi." };
  const token = auth.token();
  if (!token) return { ok: false as const, status: 401, error: "unauthorized", message: "Oturum açık değil." };
  try {
    const response = await net.fetch(`${SERVER}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent(), "X-Sorvia-Client": "desktop", "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(typeof name === "string" ? name.slice(0, 160) : "dosya"), ...(voice ? { "X-Voice": "1" } : {}) },
      body: new Uint8Array(bytes),
    });
    const payload = (await response.json().catch(() => ({}))) as { data?: unknown; message?: string };
    if (!response.ok) return { ok: false as const, status: response.status, error: "upload", message: payload.message ?? "Dosya gönderilemedi." };
    return { ok: true as const, data: (payload.data ?? payload) as never };
  } catch {
    return { ok: false as const, status: 0, error: "network", message: "Sorvia'ya ulaşılamadı." };
  }
}

async function avatarRequest(method: "PUT" | "DELETE", body?: Buffer) {
  const token = auth.token();
  if (!token) return { ok: false as const, status: 401, error: "unauthorized", message: "Oturum açık değil." };
  try {
    const response = await net.fetch(`${SERVER}/api/desktop/me/avatar`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent(), "X-Sorvia-Client": "desktop", ...(body ? { "Content-Type": "application/octet-stream" } : {}) },
      body: body ? new Uint8Array(body) : undefined,
    });
    const payload = (await response.json().catch(() => ({}))) as { user?: unknown; message?: string };
    if (!response.ok) return { ok: false as const, status: response.status, error: "avatar", message: payload.message ?? "Fotoğraf güncellenemedi." };
    await auth.refresh();
    return { ok: true as const, data: (payload.user ?? null) as never };
  } catch {
    return { ok: false as const, status: 0, error: "network", message: "Sorvia'ya ulaşılamadı." };
  }
}

async function pickAvatar() {
  const picture = await pickImage(["png", "jpg", "jpeg", "webp", "gif"]);
  if (!picture) return null;
  if (picture === "invalid") return { ok: false as const, status: 400, error: "invalid", message: "Görsel okunamadı." };
  const size = picture.getSize();
  const side = Math.min(size.width, size.height);
  const square = picture.crop({ x: Math.floor((size.width - side) / 2), y: Math.floor((size.height - side) / 2), width: side, height: side }).resize({ width: 512, height: 512, quality: "best" });
  return avatarRequest("PUT", square.toJPEG(88));
}

function applyPrefs(prefs: Preferences, broadcast = false) {
  registerGlobal(prefs);
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: prefs.launchAtLogin, args: ["--hidden"] });
  notifier.restart();
  refreshTray();
  if (broadcast) send("prefs:changed", prefs);
  syncScreens();
  return prefs;
}

async function announceUpdate() {
  const info = await checkUpdate();
  if (!info?.available || announcedUpdate === info.latest) return;
  announcedUpdate = info.latest;
  toast({ open: () => openSafe(info.url), icon: () => image("icon.png") }, `Sorvia Desktop ${info.latest} hazır`, info.notes ?? "Yeni sürümü indirmek için tıkla.", "update");
}

function trusted(event: IpcMainInvokeEvent | IpcMainEvent) {
  const known = (win && event.sender === win.webContents) || [...extras.values()].some((extra) => !extra.isDestroyed() && extra.webContents === event.sender);
  if (!known) return false;
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
  ipcMain.on("window:minimize", (event) => {
    if (trusted(event)) senderWindow(event)?.minimize();
  });
  ipcMain.on("window:toggleMaximize", (event) => {
    if (!trusted(event)) return;
    const target = senderWindow(event);
    if (!target) return;
    if (target.isMaximized()) target.unmaximize();
    else target.maximize();
  });
  ipcMain.on("window:close", (event) => {
    if (trusted(event)) senderWindow(event)?.close();
  });
  ipcMain.on("system:openApps", (event, list) => {
    if (!trusted(event) || !Array.isArray(list)) return;
    openByWindow.set(event.sender.id, list.filter((item): item is string => typeof item === "string").slice(0, 40));
    event.sender.once("destroyed", () => openByWindow.delete(event.sender.id));
  });
  ipcMain.handle("system:claimApp", (event, id, params) => {
    if (!trusted(event) || typeof id !== "string") return true;
    if (id.startsWith("app-") && win && !win.isDestroyed() && event.sender !== win.webContents) {
      win.webContents.send("system:activateApp", { id, params: params ?? null });
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      return false;
    }
    for (const target of [win, ...extras.values()]) {
      if (!target || target.isDestroyed() || target.webContents === event.sender) continue;
      if (!(openByWindow.get(target.webContents.id) ?? []).includes(id)) continue;
      target.webContents.send("system:activateApp", { id, params: params ?? null });
      if (target.isMinimized()) target.restore();
      target.show();
      target.focus();
      return false;
    }
    return true;
  });
  ipcMain.on("system:lockState", (event, locked) => {
    if (!trusted(event) || typeof locked !== "boolean") return;
    for (const target of [win, ...extras.values()]) if (target && !target.isDestroyed() && target.webContents !== event.sender) target.webContents.send("system:lockState", locked);
  });
  handle("system:screens", () => {
    const mainDisplay = win ? screen.getDisplayMatching(win.getBounds()).id : null;
    return screen.getAllDisplays().map((display, index) => ({ id: display.id, label: display.label || `Ekran ${index + 1}`, width: display.size.width, height: display.size.height, primary: display.id === screen.getPrimaryDisplay().id, main: display.id === mainDisplay, open: extras.has(display.id) }));
  });
  handle("window:isMaximized", () => win?.isMaximized() ?? false);
  handle("window:capture", async () => {
    if (!win || win.isMinimized()) return null;
    const shot = await win.webContents.capturePage();
    return shot.isEmpty() ? null : `data:image/jpeg;base64,${shot.resize({ width: 640 }).toJPEG(72).toString("base64")}`;
  });

  files.init({ emit: (transfer) => send("files:transfer", transfer), window: () => win });
  handle("files:pick", (options) => files.pick(options));
  handle("files:uploadMedia", (paths, options) => files.uploadMedia(paths, options));
  handle("files:uploadDrive", (paths, options) => files.uploadDrive(paths, options));
  handle("files:downloadDrive", (file, options) => files.downloadDrive(file, options));
  handle("files:downloadMedia", (item, options) => files.downloadMedia(item, options));
  handle("files:transfers", () => files.transfers());
  handle("files:cancel", (id) => files.cancel(id));
  handle("files:clearFinished", () => files.clearFinished());
  handle("files:downloads", () => files.downloads());
  handle("files:open", (path) => files.open(path));
  on("files:reveal", (path) => files.reveal(path));
  handle("files:forget", (id) => files.forget(id));
  handle("files:usage", () => files.usage());
  handle("files:clearCache", () => files.clearCache());

  handle("auth:state", () => auth.state);
  handle("auth:start", () => auth.start());
  handle("auth:poll", () => auth.poll());
  handle("auth:cancel", () => auth.cancel());
  handle("auth:preview", () => auth.preview());
  handle("auth:logout", () => auth.logout());

  handle("api:get", (path, query) => request("GET", path, query));
  handle("api:send", (method, path, body) => request(method, path, undefined, body));
  handle("api:upload", (path, bytes, name, voice) => uploadRequest(path, bytes, name, voice));

  handle("mail:account", () => mail.info());
  handle("mail:accounts", () => mail.accounts());
  handle("mail:switchAccount", (id) => mail.switchAccount(id));
  handle("mail:connect", (input) => mail.connect(input));
  handle("mail:disconnect", (id) => mail.disconnect(id));
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

  handle("system:openExternal", (url) => openInside(url));
  handle("system:openAppWindow", (url, id) => openAppWindow(url, id));
  handle("system:openBrowser", (url) => openSafe(url));
  handle("system:checkUpdate", () => checkUpdate());
  handle("system:pickWallpaper", () => pickWallpaper());
  handle("system:wallpaperImage", () => wallpaperImage());
  on("system:installUpdate", () => updater.install());
  handle("system:passkeyUnlock", () => passkeyUnlock());
  handle("system:passkeySetup", async (password) => {
    const result = await passkeyUnlock("register", typeof password === "string" ? password.slice(0, 200) : "");
    if (result.ok) await auth.refresh();
    return result;
  });
  handle("system:unlockedVersion", () => store.unlockedVersion());
  handle("system:markUnlocked", () => store.setUnlockedVersion(app.getVersion()));
  handle("system:screenSources", () => screenSources());
  handle("system:chooseScreen", (id) => {
    chosenScreen = typeof id === "string" ? id : null;
  });
  handle("system:updateNow", () => updater.manual());
  handle("system:updateStatus", () => updater.status());
  handle("system:updateReady", () => updater.readyVersion());
  handle("account:pickAvatar", () => pickAvatar());
  handle("account:removeAvatar", () => avatarRequest("DELETE"));
  on("system:notify", (title, body) => {
    if (typeof title === "string" && store.prefs().nativeNotifications && !store.prefs().doNotDisturb) toast({ open: command, icon: () => image("icon.png") }, title.slice(0, 120), typeof body === "string" ? body : "", null);
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
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (permission === "clipboard-sanitized-write") return callback(true);
    const fromApp = isAppUrl(details.requestingUrl ?? contents.getURL());
    callback(fromApp && (permission === "media" || permission === "display-capture" || permission === "speaker-selection"));
  });
  ses.setPermissionCheckHandler((_contents, permission, origin) => permission === "clipboard-sanitized-write" || ((permission === "media" || permission === "speaker-selection") && isAppUrl(`${origin}/`)));
  ses.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
    const chosen = sources.find((source) => source.id === chosenScreen) ?? sources.find((source) => source.id.startsWith("screen:"));
    chosenScreen = null;
    if (!chosen) return callback({});
    callback({ video: chosen });
  });
  const web = session.fromPartition("persist:sorvia-web");
  web.setUserAgent(web.getUserAgent().replace(/\s(Electron|sorvia-desktop|Sorvia[\w-]*)\/\S+/gi, ""));
  const appHost = (url: string) => {
    try {
      return APP_WINDOW_HOSTS.includes(new URL(url).hostname);
    } catch {
      return false;
    }
  };
  const webAllow = (permission: string, url: string) => permission === "fullscreen" || permission === "clipboard-sanitized-write" || (appHost(url) && (permission === "notifications" || permission === "media" || permission === "clipboard-read"));
  web.setPermissionRequestHandler((contents, permission, callback, details) => callback(webAllow(permission, details.requestingUrl ?? contents.getURL())));
  web.setPermissionCheckHandler((_contents, permission, origin) => webAllow(permission, `${origin}/`));
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

  void app.whenReady().then(async () => {
    registerProtocol();
    hardenSession();
    registerIpc();

    auth.onChange((state) => {
      send("auth:changed", state);
      syncScreens();
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
      void (reason === "logout" ? mail.disconnectAll() : mail.stop());
      setBadge(0);
    });
    mail.onNew((items) => {
      send("mail:new", items.length);
      if (!store.prefs().nativeNotifications || store.prefs().doNotDisturb || (win?.isVisible() && win.isFocused())) return;
      const first = items[items.length - 1]!;
      toast({ open: command, icon: () => image("icon.png") }, items.length > 1 ? `${items.length} yeni e-posta` : `Yeni e-posta · ${first.from}`, first.subject, "go:mail");
      if (win && !win.isFocused()) win.flashFrame(true);
    });

    let linkWindow: BrowserWindow | null = null;
    setLinkOpener((url) => {
      if (linkWindow && !linkWindow.isDestroyed()) {
        void linkWindow.loadURL(url);
        return linkWindow.focus();
      }
      linkWindow = new BrowserWindow({
        width: 520,
        height: 720,
        parent: win ?? undefined,
        title: "Sorvia Desktop'u bağla",
        autoHideMenuBar: true,
        backgroundColor: "#0d0a09",
        icon: image("icon.png"),
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: "persist:sorvia-web" },
      });
      linkWindow.setMenu(null);
      void linkWindow.loadURL(url);
      linkWindow.on("closed", () => {
        linkWindow = null;
      });
    });
    auth.onSignedIn(() => {
      if (linkWindow && !linkWindow.isDestroyed()) linkWindow.close();
    });
    auth.restore();
    if (!startHidden && !(await updater.startup(asset("icon.png")))) return;
    updater.onStatus((status) => send("system:updateStatus", status));
    updater.onReady((version) => {
      send("system:updateReady", version);
      toast({ open: command, icon: () => image("icon.png") }, `Sorvia Desktop ${version} hazır`, "Yeniden başlattığında güncelleme kurulacak.", null);
    });

    createWindow();
    createTray();
    applyPrefs(store.prefs());
    win?.once("ready-to-show", () => setTimeout(syncScreens, 1500));
    screen.on("display-added", syncScreens);
    screen.on("display-removed", syncScreens);
    screen.on("display-metrics-changed", syncScreens);

    powerMonitor.on("resume", () => {
      void auth.refresh();
      mail.resume();
      notifier.restart();
    });
    const periodic = () => void (app.isPackaged ? updater.background() : announceUpdate());
    setTimeout(periodic, startHidden ? 30_000 : 4 * 60 * 60 * 1000);
    setInterval(periodic, 4 * 60 * 60 * 1000);
  });
}
