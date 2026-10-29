import { shell } from "electron";
import { EventEmitter } from "node:events";
import { hostname } from "node:os";

import type { AuthState, DesktopUser, DeviceStart, DeviceToken } from "../shared/contracts";
import { IS_DEV, SERVER, version } from "./config";
import { call } from "./http";
import { canEncrypt, store } from "./store";

const events = new EventEmitter();
let state: AuthState = { status: "signedOut", server: SERVER };
let pending: { deviceCode: string; interval: number; expiresAt: number } | null = null;
let timer: NodeJS.Timeout | null = null;
let polling = false;

function set(next: AuthState) {
  state = next;
  events.emit("change", state);
}

function stopPolling() {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
}

function schedule() {
  if (timer) clearTimeout(timer);
  if (!pending) return;
  timer = setTimeout(() => void auth.poll(), pending.interval);
}

function forget() {
  store.setSecret("token", null);
  store.setSession(null, null);
}

function isUser(value: unknown): value is DesktopUser {
  const user = value as DesktopUser | null;
  return Boolean(user && typeof user.id === "string" && typeof user.name === "string" && Array.isArray(user.permissions) && Array.isArray(user.modules));
}

function sameServer(url: string) {
  try {
    return new URL(url).origin === new URL(SERVER).origin;
  } catch {
    return false;
  }
}

export const auth = {
  get state() {
    return state;
  },
  onChange(listener: (state: AuthState) => void) {
    events.on("change", listener);
    return () => events.off("change", listener);
  },
  onSignedOut(listener: (reason: "logout" | "expired") => void) {
    events.on("signed-out", listener);
    return () => events.off("signed-out", listener);
  },
  onSignedIn(listener: () => void) {
    events.on("signed-in", listener);
    return () => events.off("signed-in", listener);
  },
  token() {
    return state.status === "signedIn" ? store.secret("token") : null;
  },
  restore() {
    const token = store.secret("token");
    const user = store.user();
    const session = store.session();
    if (!token || !user || !session) {
      if (token || user) forget();
      set({ status: "signedOut", server: SERVER });
      return;
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      forget();
      set({ status: "signedOut", server: SERVER, error: "Oturumunun süresi doldu. Yeniden bağlan." });
      return;
    }
    set({ status: "signedIn", server: SERVER, user, expiresAt: session.expiresAt });
    events.emit("signed-in");
    void auth.refresh();
  },
  async refresh() {
    const token = store.secret("token");
    if (!token || state.status !== "signedIn") return;
    const result = await call("GET", "/api/desktop/me", { token });
    if (!result.ok) {
      if (result.status === 401) auth.expire();
      return;
    }
    const payload = result.payload as { user?: unknown; expiresAt?: unknown };
    if (!isUser(payload.user) || typeof payload.expiresAt !== "string") return;
    store.setSession(payload.user, payload.expiresAt);
    set({ status: "signedIn", server: SERVER, user: payload.user, expiresAt: payload.expiresAt });
  },
  async start() {
    stopPolling();
    if (!canEncrypt()) {
      set({ status: "signedOut", server: SERVER, error: "Windows güvenli saklama alanına erişilemedi; oturum anahtarı korunamayacağı için bağlantı kurulmadı." });
      return state;
    }
    const result = await call("POST", "/api/desktop/auth/start", { body: { device: hostname().slice(0, 80), version: version(), platform: "windows" } });
    if (!result.ok) {
      set({ status: "signedOut", server: SERVER, error: result.status === 404 ? "Sorvia sunucusu masaüstü bağlantısını henüz desteklemiyor. Güncelleme yayınlanınca tekrar dene." : result.message });
      return state;
    }
    const data = result.payload as Partial<DeviceStart>;
    if (typeof data.deviceCode !== "string" || typeof data.userCode !== "string" || typeof data.verificationUrlComplete !== "string" || !sameServer(data.verificationUrlComplete)) {
      set({ status: "signedOut", server: SERVER, error: "Sunucudan beklenmeyen bir yanıt geldi." });
      return state;
    }
    const expiresIn = Math.min(1800, Math.max(60, Number(data.expiresIn) || 600));
    pending = { deviceCode: data.deviceCode, interval: Math.max(2, Number(data.interval) || 3) * 1000, expiresAt: Date.now() + expiresIn * 1000 };
    set({ status: "linking", server: SERVER, userCode: data.userCode, verificationUrl: data.verificationUrlComplete, expiresAt: new Date(pending.expiresAt).toISOString() });
    if (!(IS_DEV && process.env.SORVIA_E2E === "1")) void shell.openExternal(data.verificationUrlComplete);
    schedule();
    return state;
  },
  async poll() {
    if (!pending || polling) return state;
    if (Date.now() > pending.expiresAt) {
      stopPolling();
      set({ status: "signedOut", server: SERVER, error: "Doğrulama kodunun süresi doldu. Yeniden bağlan." });
      return state;
    }
    polling = true;
    try {
      const result = await call("POST", "/api/desktop/auth/token", { body: { deviceCode: pending.deviceCode } });
      if (!pending) return state;
      if (result.ok) {
        const data = result.payload as Partial<DeviceToken>;
        if (typeof data.token !== "string" || typeof data.expiresAt !== "string" || !isUser(data.user)) {
          stopPolling();
          set({ status: "signedOut", server: SERVER, error: "Sunucudan beklenmeyen bir yanıt geldi." });
          return state;
        }
        stopPolling();
        store.setSecret("token", data.token);
        store.setSession(data.user, data.expiresAt);
        set({ status: "signedIn", server: SERVER, user: data.user, expiresAt: data.expiresAt });
        events.emit("signed-in");
        return state;
      }
      if (result.error === "authorization_pending" || result.status === 0 || result.status >= 500) schedule();
      else if (result.error === "slow_down") {
        pending.interval += 3000;
        schedule();
      } else {
        stopPolling();
        const message = result.error === "access_denied" ? "Bağlantı isteği reddedildi." : result.error === "expired_token" ? "Doğrulama kodunun süresi doldu. Yeniden bağlan." : result.message;
        set({ status: "signedOut", server: SERVER, error: message });
      }
      return state;
    } finally {
      polling = false;
    }
  },
  cancel() {
    stopPolling();
    set({ status: "signedOut", server: SERVER });
    return state;
  },
  preview() {
    if (state.status === "signedIn") return state;
    stopPolling();
    set({ status: "preview", server: SERVER });
    return state;
  },
  async logout() {
    stopPolling();
    const token = store.secret("token");
    if (token && state.status === "signedIn") await call("POST", "/api/desktop/auth/logout", { token, timeout: 6000 });
    forget();
    events.emit("signed-out", "logout");
    set({ status: "signedOut", server: SERVER });
    return state;
  },
  expire() {
    if (state.status !== "signedIn") return;
    forget();
    events.emit("signed-out", "expired");
    set({ status: "signedOut", server: SERVER, error: "Oturumun kapatıldı ya da süresi doldu. Yeniden bağlan." });
  },
};
