import type { ApiResult, AuthState, Preferences, SorviaBridge } from "@shared/contracts";

declare global {
  interface Window {
    sorvia?: SorviaBridge;
  }
}

const DEFAULT_PREFS: Preferences = {
  launchAtLogin: false,
  closeToTray: true,
  nativeNotifications: true,
  reduceMotion: "system",
  wallpaper: "ember",
  showRemoteImages: false,
  pollSeconds: 45,
  doNotDisturb: false,
  autoLockMinutes: 0,
  homeLayout: null,
  installed: null,
  accent: "ember",
  uiStyle: "glass",
  iconSize: "medium",
  density: "comfortable",
  shortcuts: {},
};

function webBridge(): SorviaBridge {
  let state: AuthState = new URLSearchParams(location.search).has("onizleme") ? { status: "preview", server: "önizleme" } : { status: "signedOut", server: "https://sorvia.net" };
  let prefs: Preferences = { ...DEFAULT_PREFS };
  const authListeners = new Set<(state: AuthState) => void>();
  const unavailable = <T,>(): ApiResult<T> => ({ ok: false, status: 0, error: "web", message: "Tarayıcı önizlemesinde sunucuya bağlanılmaz." });
  const emit = () => authListeners.forEach((listener) => listener(state));
  return {
    platform: "web",
    version: "0.4.0",
    window: {
      minimize: () => undefined,
      toggleMaximize: () => undefined,
      close: () => undefined,
      isMaximized: async () => false,
      onMaximizeChange: () => () => undefined,
      capture: async () => null,
    },
    auth: {
      state: async () => state,
      start: async () => {
        state = { status: "signedOut", server: "https://sorvia.net", error: "Bağlanmak için masaüstü uygulamasını kullanın. Tarayıcıda yalnızca önizleme açılır." };
        emit();
        return state;
      },
      poll: async () => state,
      cancel: async () => state,
      preview: async () => {
        state = { status: "preview", server: "önizleme" };
        emit();
        return state;
      },
      logout: async () => {
        state = { status: "signedOut", server: "https://sorvia.net" };
        emit();
        return state;
      },
      onChange: (listener) => {
        authListeners.add(listener);
        return () => authListeners.delete(listener);
      },
    },
    api: {
      get: async <T,>() => unavailable<T>(),
      send: async <T,>() => unavailable<T>(),
    },
    mail: {
      account: async () => null,
      accounts: async () => [],
      switchAccount: async () => null,
      connect: async () => unavailable(),
      disconnect: async () => undefined,
      folders: async () => unavailable(),
      list: async () => unavailable(),
      read: async () => unavailable(),
      setSeen: async () => unavailable(),
      move: async () => unavailable(),
      send: async () => unavailable(),
      search: async () => unavailable(),
      saveAttachment: async () => unavailable(),
      onNewMail: () => () => undefined,
    },
    prefs: {
      get: async () => prefs,
      set: async (patch) => {
        prefs = { ...prefs, ...patch };
        return prefs;
      },
      onChange: () => () => undefined,
    },
    system: {
      openExternal: async (url) => {
        window.open(url, "_blank", "noopener");
      },
      notify: () => undefined,
      onCommand: () => () => undefined,
      setBadge: () => undefined,
      checkUpdate: async () => null,
      installUpdate: () => undefined,
      onUpdateReady: () => () => undefined,
      pickWallpaper: async () => null,
      wallpaperImage: async () => null,
    },
    account: {
      pickAvatar: async () => unavailable(),
      removeAvatar: async () => unavailable(),
    },
    files: {
      pick: async () => [],
      pathFor: () => "",
      uploadMedia: async () => unavailable(),
      uploadDrive: async () => unavailable(),
      downloadDrive: async () => unavailable(),
      downloadMedia: async () => unavailable(),
      transfers: async () => [],
      cancel: async () => undefined,
      clearFinished: async () => undefined,
      onTransfer: () => () => undefined,
      downloads: async () => [],
      open: async () => unavailable(),
      reveal: () => undefined,
      forget: async () => undefined,
      usage: async () => ({ cache: 0, downloads: 0, downloadCount: 0 }),
      clearCache: async () => 0,
    },
  };
}

export const bridge: SorviaBridge = window.sorvia ?? webBridge();
