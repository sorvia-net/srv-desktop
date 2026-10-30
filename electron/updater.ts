import { app, BrowserWindow, nativeImage } from "electron";
import electronUpdater from "electron-updater";

import type { UpdateStatus } from "../shared/contracts";
import { auth } from "./auth";
import { SERVER } from "./config";

const { autoUpdater } = electronUpdater;

let ready: string | null = null;
let busy = false;
let listener: (version: string) => void = () => undefined;
let statusListener: (status: UpdateStatus) => void = () => undefined;
let current: UpdateStatus = { state: "idle", version: null, percent: null, message: null };

function setStatus(next: Partial<UpdateStatus>) {
  current = { ...current, ...next };
  statusListener(current);
  return current;
}

const SPLASH = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:transparent;font-family:"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;user-select:none;-webkit-app-region:drag}
.card{position:absolute;inset:0;border-radius:28px;overflow:hidden;background:radial-gradient(circle at 50% -10%,#ffcf8f 0%,#b56a2c 32%,#2a1f19 68%,#120d0b 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#f6f1ec}
.logo{width:92px;height:92px;border-radius:26px;background:linear-gradient(160deg,#ffbf7a,#ff8a2b 48%,#e4560c);display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:800;color:#fff;box-shadow:0 20px 50px -14px rgba(255,120,30,.8);animation:pulse 1.8s ease-in-out infinite}
h1{margin:22px 0 4px;font-size:20px;font-weight:700;letter-spacing:-.02em}
p{margin:0;font-size:13px;color:rgba(246,241,236,.75);min-height:18px}
.bar{margin-top:22px;width:200px;height:5px;border-radius:9px;background:rgba(255,255,255,.14);overflow:hidden}
.fill{height:100%;width:30%;border-radius:9px;background:#fff;animation:slide 1.2s ease-in-out infinite}
.fill.known{animation:none;transition:width .3s}
@keyframes slide{0%{transform:translateX(-110%)}100%{transform:translateX(380%)}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
</style></head><body><div class="card"><div class="logo">S</div><h1>Sorvia</h1><p id="s">Başlatılıyor…</p><div class="bar"><div class="fill" id="f"></div></div></div>
<script>window.setStatus=function(t,p){document.getElementById("s").textContent=t;var f=document.getElementById("f");if(typeof p==="number"){f.className="fill known";f.style.width=Math.max(4,Math.min(100,p))+"%"}else{f.className="fill";f.style.width="30%"}}</script></body></html>`;

function configure() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.setFeedURL({ provider: "generic", url: `${SERVER}/api/desktop/update` });
  const token = auth.token();
  autoUpdater.requestHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  return Boolean(token) && app.isPackaged;
}

function status(splash: BrowserWindow, text: string, percent?: number) {
  if (splash.isDestroyed()) return;
  void splash.webContents.executeJavaScript(`window.setStatus(${JSON.stringify(text)}, ${percent === undefined ? "undefined" : Math.round(percent)})`).catch(() => undefined);
}

function withTimeout<T>(work: Promise<T>, ms: number) {
  return Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export const updater = {
  onReady(callback: (version: string) => void) {
    listener = callback;
  },

  async startup(icon: string): Promise<boolean> {
    const splash = new BrowserWindow({
      width: 340,
      height: 380,
      frame: false,
      transparent: true,
      resizable: false,
      movable: true,
      show: false,
      skipTaskbar: false,
      alwaysOnTop: true,
      title: "Sorvia",
      icon: nativeImage.createFromPath(icon),
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true },
    });
    splash.once("ready-to-show", () => splash.show());
    await splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH)}`);
    const started = Date.now();
    let installing = false;
    try {
      if (configure()) {
        status(splash, "Güncellemeler denetleniyor…");
        const result = await withTimeout(autoUpdater.checkForUpdates(), 10_000);
        const info = result?.updateInfo;
        if (result?.isUpdateAvailable && info) {
          status(splash, `Sürüm ${info.version} indiriliyor…`, 0);
          const onProgress = (progress: { percent: number }) => status(splash, `Sürüm ${info.version} indiriliyor… %${Math.round(progress.percent)}`, progress.percent);
          autoUpdater.on("download-progress", onProgress);
          const downloaded = await withTimeout(autoUpdater.downloadUpdate(), 10 * 60_000);
          autoUpdater.off("download-progress", onProgress);
          if (downloaded) {
            status(splash, "Güncelleme kuruluyor…", 100);
            installing = true;
            setTimeout(() => autoUpdater.quitAndInstall(true, true), 900);
            return false;
          }
        }
      }
      status(splash, "Masaüstün hazırlanıyor…");
      const wait = 900 - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    } catch {
      status(splash, "Masaüstün hazırlanıyor…");
    } finally {
      if (!installing) setTimeout(() => !splash.isDestroyed() && splash.destroy(), 400);
    }
    return true;
  },

  async background() {
    if (busy || ready || !configure()) return;
    busy = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.isUpdateAvailable && result.updateInfo) {
        await autoUpdater.downloadUpdate();
        ready = result.updateInfo.version;
        listener(ready);
        setStatus({ state: "ready", version: ready, percent: 100 });
      }
    } catch {
      return;
    } finally {
      busy = false;
    }
  },

  readyVersion: () => ready,

  onStatus(callback: (status: UpdateStatus) => void) {
    statusListener = callback;
  },

  status: () => current,

  async manual(): Promise<UpdateStatus> {
    if (ready) return setStatus({ state: "ready", version: ready, percent: 100, message: null });
    if (!app.isPackaged) return setStatus({ state: "unavailable", message: "Geliştirme sürümünde güncelleme yapılmaz." });
    if (!configure()) return setStatus({ state: "error", message: "Güncelleme için oturum açık olmalı." });
    if (busy) return current;
    busy = true;
    setStatus({ state: "checking", message: null, percent: null });
    const onProgress = (progress: { percent: number }) => setStatus({ state: "downloading", percent: Math.round(progress.percent) });
    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result?.isUpdateAvailable || !result.updateInfo) return setStatus({ state: "latest", version: app.getVersion() });
      setStatus({ state: "downloading", version: result.updateInfo.version, percent: 0 });
      autoUpdater.on("download-progress", onProgress);
      await autoUpdater.downloadUpdate();
      ready = result.updateInfo.version;
      listener(ready);
      return setStatus({ state: "ready", version: ready, percent: 100 });
    } catch (error) {
      return setStatus({ state: "error", message: (error as Error).message.slice(0, 200) });
    } finally {
      autoUpdater.off("download-progress", onProgress);
      busy = false;
    }
  },

  install() {
    if (ready) autoUpdater.quitAndInstall(true, true);
  },
};
