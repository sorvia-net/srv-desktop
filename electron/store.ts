import { app, safeStorage } from "electron";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { DesktopUser, Preferences } from "../shared/contracts";

export const DEFAULT_PREFS: Preferences = {
  launchAtLogin: false,
  closeToTray: true,
  nativeNotifications: true,
  reduceMotion: "system",
  wallpaper: "ember",
  showRemoteImages: false,
  pollSeconds: 45,
};

type Shape = {
  prefs: Preferences;
  user: DesktopUser | null;
  session: { expiresAt: string } | null;
  mail: { address: string; name: string } | null;
  secrets: Record<string, string>;
  lastNotificationAt: string | null;
  trayHintShown: boolean;
};

const EMPTY: Shape = { prefs: DEFAULT_PREFS, user: null, session: null, mail: null, secrets: {}, lastNotificationAt: null, trayHintShown: false };

let cache: Shape | null = null;

function file() {
  return join(app.getPath("userData"), "sorvia-desktop.json");
}

function load(): Shape {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(readFileSync(file(), "utf8")) as Partial<Shape>;
    cache = { ...EMPTY, ...parsed, prefs: sanitizePrefs({ ...DEFAULT_PREFS, ...(parsed.prefs ?? {}) }), secrets: parsed.secrets ?? {} };
  } catch {
    cache = structuredClone(EMPTY);
  }
  return cache;
}

function save() {
  const target = file();
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.tmp`;
  writeFileSync(temp, JSON.stringify(cache, null, 2), { encoding: "utf8", mode: 0o600 });
  renameSync(temp, target);
}

function update(change: (shape: Shape) => void) {
  const shape = load();
  change(shape);
  save();
}

function sanitizePrefs(input: Record<string, unknown>): Preferences {
  const prefs = { ...DEFAULT_PREFS };
  if (typeof input.launchAtLogin === "boolean") prefs.launchAtLogin = input.launchAtLogin;
  if (typeof input.closeToTray === "boolean") prefs.closeToTray = input.closeToTray;
  if (typeof input.nativeNotifications === "boolean") prefs.nativeNotifications = input.nativeNotifications;
  if (typeof input.showRemoteImages === "boolean") prefs.showRemoteImages = input.showRemoteImages;
  if (input.reduceMotion === "system" || input.reduceMotion === "on" || input.reduceMotion === "off") prefs.reduceMotion = input.reduceMotion;
  if (input.wallpaper === "ember" || input.wallpaper === "dusk" || input.wallpaper === "noir") prefs.wallpaper = input.wallpaper;
  if (typeof input.pollSeconds === "number" && Number.isFinite(input.pollSeconds)) prefs.pollSeconds = Math.min(600, Math.max(15, Math.round(input.pollSeconds)));
  return prefs;
}

export function canEncrypt() {
  return safeStorage.isEncryptionAvailable();
}

export const store = {
  prefs: () => load().prefs,
  setPrefs(patch: unknown) {
    const current = load().prefs;
    const next = sanitizePrefs({ ...current, ...(patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {}) });
    update((shape) => {
      shape.prefs = next;
    });
    return next;
  },
  user: () => load().user,
  session: () => load().session,
  setSession(user: DesktopUser | null, expiresAt: string | null) {
    update((shape) => {
      shape.user = user;
      shape.session = expiresAt ? { expiresAt } : null;
    });
  },
  mailAccount: () => load().mail,
  setMailAccount(account: { address: string; name: string } | null) {
    update((shape) => {
      shape.mail = account;
    });
  },
  secret(name: string): string | null {
    const value = load().secrets[name];
    if (!value || !canEncrypt()) return null;
    try {
      return safeStorage.decryptString(Buffer.from(value, "base64"));
    } catch {
      return null;
    }
  },
  setSecret(name: string, value: string | null) {
    if (value !== null && !canEncrypt()) throw new Error("Bu bilgisayarda güvenli saklama kullanılamıyor.");
    update((shape) => {
      if (value === null) delete shape.secrets[name];
      else shape.secrets[name] = safeStorage.encryptString(value).toString("base64");
    });
  },
  lastNotificationAt: () => load().lastNotificationAt,
  setLastNotificationAt(value: string | null) {
    update((shape) => {
      shape.lastNotificationAt = value;
    });
  },
  trayHintShown: () => load().trayHintShown,
  setTrayHintShown() {
    update((shape) => {
      shape.trayHintShown = true;
    });
  },
};
