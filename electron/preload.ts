import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";

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
    capture: () => ipcRenderer.invoke("window:capture"),
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
  files: {
    pick: (options) => ipcRenderer.invoke("files:pick", options),
    pathFor: (file) => {
      try {
        return webUtils.getPathForFile(file);
      } catch {
        return "";
      }
    },
    uploadMedia: (paths, options) => ipcRenderer.invoke("files:uploadMedia", paths, options),
    uploadDrive: (paths, options) => ipcRenderer.invoke("files:uploadDrive", paths, options),
    downloadDrive: (file, options) => ipcRenderer.invoke("files:downloadDrive", file, options),
    downloadMedia: (item, options) => ipcRenderer.invoke("files:downloadMedia", item, options),
    transfers: () => ipcRenderer.invoke("files:transfers"),
    cancel: (id) => ipcRenderer.invoke("files:cancel", id),
    clearFinished: () => ipcRenderer.invoke("files:clearFinished"),
    onTransfer: (listener) => listen("files:transfer", listener),
    downloads: () => ipcRenderer.invoke("files:downloads"),
    open: (path) => ipcRenderer.invoke("files:open", path),
    reveal: (path) => ipcRenderer.send("files:reveal", path),
    forget: (id) => ipcRenderer.invoke("files:forget", id),
    usage: () => ipcRenderer.invoke("files:usage"),
    clearCache: () => ipcRenderer.invoke("files:clearCache"),
  },
};

contextBridge.exposeInMainWorld("sorvia", bridge);
