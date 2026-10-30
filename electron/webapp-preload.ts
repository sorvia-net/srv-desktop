import { contextBridge, ipcRenderer, webFrame } from "electron";

contextBridge.exposeInMainWorld("__sorviaNotify", (title: unknown, body: unknown, icon: unknown) => {
  ipcRenderer.sendToHost("notify", {
    title: String(title ?? "").slice(0, 200),
    body: String(body ?? "").slice(0, 500),
    icon: typeof icon === "string" && /^https?:|^data:image\//.test(icon) ? icon.slice(0, 4000) : null,
  });
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
})();`);
