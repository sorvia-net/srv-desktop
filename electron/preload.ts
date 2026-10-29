import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import type { SorviaBridge } from "../shared/contracts";

const versionArgument = process.argv.find((item) => item.startsWith("--sorvia-version="));

function listen<T>(channel: string, listener: (payload: T) => void) {
  const handler = (_event: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const bridge: SorviaBridge = {
  platform: "win32",
  version: versionArgument ? versionArgument.slice("--sorvia-version=".length) : "0.0.0",
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleMaximize: () => ipcRenderer.send("window:toggleMaximize"),
    close: () => ipcRenderer.send("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChange: (listener) => listen("window:maximized", listener),
  },
  auth: {
    state: () => ipcRenderer.invoke("auth:state"),
    start: () => ipcRenderer.invoke("auth:start"),
    poll: () => ipcRenderer.invoke("auth:poll"),
    cancel: () => ipcRenderer.invoke("auth:cancel"),
    preview: () => ipcRenderer.invoke("auth:preview"),
    logout: () => ipcRenderer.invoke("auth:logout"),
    onChange: (listener) => listen("auth:changed", listener),
  },
  api: {
    get: (path, query) => ipcRenderer.invoke("api:get", path, query),
    send: (method, path, body) => ipcRenderer.invoke("api:send", method, path, body),
  },
  mail: {
    account: () => ipcRenderer.invoke("mail:account"),
    connect: (input) => ipcRenderer.invoke("mail:connect", input),
    disconnect: () => ipcRenderer.invoke("mail:disconnect"),
    folders: () => ipcRenderer.invoke("mail:folders"),
    list: (folder, page) => ipcRenderer.invoke("mail:list", folder, page),
    read: (folder, uid) => ipcRenderer.invoke("mail:read", folder, uid),
    setSeen: (folder, uid, seen) => ipcRenderer.invoke("mail:setSeen", folder, uid, seen),
    move: (folder, uid, target) => ipcRenderer.invoke("mail:move", folder, uid, target),
    send: (draft) => ipcRenderer.invoke("mail:send", draft),
    search: (folder, query) => ipcRenderer.invoke("mail:search", folder, query),
    saveAttachment: (folder, uid, id) => ipcRenderer.invoke("mail:saveAttachment", folder, uid, id),
    onNewMail: (listener) => listen("mail:new", listener),
  },
  prefs: {
    get: () => ipcRenderer.invoke("prefs:get"),
    set: (patch) => ipcRenderer.invoke("prefs:set", patch),
    onChange: (listener) => listen("prefs:changed", listener),
  },
  system: {
    openExternal: (url) => ipcRenderer.invoke("system:openExternal", url),
    notify: (title, body) => ipcRenderer.send("system:notify", title, body),
    onCommand: (listener) => listen("system:command", listener),
    setBadge: (count) => ipcRenderer.send("system:setBadge", count),
    checkUpdate: () => ipcRenderer.invoke("system:checkUpdate"),
  },
};

contextBridge.exposeInMainWorld("sorvia", bridge);
