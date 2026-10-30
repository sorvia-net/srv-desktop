import { contextBridge, ipcRenderer, webFrame } from "electron";

contextBridge.exposeInMainWorld("__sorviaMedia", (state: unknown) => {
  if (!state || typeof state !== "object") return ipcRenderer.sendToHost("media", null);
  const value = state as Record<string, unknown>;
  ipcRenderer.sendToHost("media", {
    title: String(value.title ?? "").slice(0, 200),
    artist: String(value.artist ?? "").slice(0, 200),
    artwork: typeof value.artwork === "string" && /^https?:/.test(value.artwork) ? value.artwork.slice(0, 2000) : null,
    playing: Boolean(value.playing),
  });
});

contextBridge.exposeInMainWorld("__sorviaNotify", (title: unknown, body: unknown, icon: unknown) => {
  ipcRenderer.sendToHost("notify", {
    title: String(title ?? "").slice(0, 200),
    body: String(body ?? "").slice(0, 500),
    icon: typeof icon === "string" && /^https?:|^data:image\//.test(icon) ? icon.slice(0, 4000) : null,
  });
});

ipcRenderer.on("media-control", (_event, action: unknown) => {
  if (typeof action !== "string" || !["play", "pause", "previoustrack", "nexttrack"].includes(action)) return;
  const name = JSON.stringify(action);
  void webFrame.executeJavaScript(`(() => {
    const handler = window.__sorviaMediaHandlers && window.__sorviaMediaHandlers[${name}];
    if (handler) return void handler({ action: ${name} });
    const media = document.querySelector("video, audio");
    if (!media) return;
    if (${name} === "play") media.play();
    if (${name} === "pause") media.pause();
  })();`);
});

void webFrame.executeJavaScript(`(() => {
  const notify = window.__sorviaNotify;
  class SorviaNotification extends EventTarget {
    constructor(title, options = {}) {
      super();
      this.title = title;
      this.body = options.body || "";
      this.icon = options.icon || "";
      this.tag = options.tag || "";
      this.data = options.data;
      this.onclick = null;
      this.onclose = null;
      this.onshow = null;
      this.onerror = null;
      notify(title, options.body, options.icon);
    }
    close() {}
    static get permission() { return "granted"; }
    static requestPermission(callback) {
      if (typeof callback === "function") callback("granted");
      return Promise.resolve("granted");
    }
  }
  Object.defineProperty(window, "Notification", { value: SorviaNotification, configurable: true, writable: true });
  if (navigator.serviceWorker && window.ServiceWorkerRegistration) {
    ServiceWorkerRegistration.prototype.showNotification = function (title, options = {}) {
      notify(title, options.body, options.icon);
      return Promise.resolve();
    };
  }

  const handlers = {};
  window.__sorviaMediaHandlers = handlers;
  if (navigator.mediaSession) {
    const original = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
    navigator.mediaSession.setActionHandler = (action, handler) => {
      handlers[action] = handler;
      try { original(action, handler); } catch {}
    };
  }
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    console.error("[sorvia-diag] unhandled", reason && (reason.stack || reason.message || reason.errorCode || JSON.stringify(reason)));
  });
  if (location.hostname === "music.apple.com") {
    const watch = setInterval(() => {
      const kit = window.MusicKit;
      const instance = kit && kit.getInstance && kit.getInstance();
      if (!instance) return;
      clearInterval(watch);
      const describe = (value) => { try { return JSON.stringify(value, Object.getOwnPropertyNames(value || {})).slice(0, 800); } catch { return String(value); } };
      for (const name of ["mediaPlaybackError", "playbackError", "authorizationStatusDidChange", "drmUnsupported", "mediaCanPlay"]) {
        const key = kit.Events && kit.Events[name];
        if (key) instance.addEventListener(key, (event) => console.error("[sorvia-diag] MusicKit " + name, describe(event)));
      }
      const original = instance.play && instance.play.bind(instance);
      if (original) instance.play = (...args) => original(...args).catch((error) => { console.error("[sorvia-diag] MusicKit play", describe(error)); throw error; });
    }, 1000);
  }
  let last = "";
  setInterval(() => {
    const list = Array.from(document.querySelectorAll("video, audio"));
    const media = list.find((item) => !item.paused) || list[0];
    const meta = navigator.mediaSession && navigator.mediaSession.metadata;
    const playing = Boolean(media && !media.paused && !media.ended);
    const art = meta && meta.artwork && meta.artwork.length ? meta.artwork[meta.artwork.length - 1].src : null;
    const state = meta && meta.title ? { title: meta.title, artist: meta.artist, artwork: art, playing } : null;
    const key = JSON.stringify(state);
    if (key === last) return;
    last = key;
    window.__sorviaMedia(state);
  }, 1500);
})();`);
