import { app, safeStorage } from "electron";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ACCENTS, DENSITIES, ICON_SIZES, isOneOf, SOUNDS, TOAST_POSITIONS, UI_STYLES, WALLPAPERS } from "../shared/appearance";
import type { DesktopUser, Preferences } from "../shared/contracts";
import { sanitizeShortcuts } from "../shared/shortcuts";

export const DEFAULT_PREFS: Preferences = {
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
  toastPosition: "bottom-center",
  notificationSound: "ses1",
};

type Shape = {
  prefs: Preferences;
  user: DesktopUser | null;
  session: { expiresAt: string } | null;
  mail: { address: string; name: string } | null;
  mailAccounts: MailAccount[];
  activeMail: string | null;
  secrets: Record<string, string>;
  lastNotificationAt: string | null;
  trayHintShown: boolean;
  unlockedVersion: string | null;
};

export type MailAccount = { id: string; address: string; name: string };

const EMPTY: Shape = { prefs: DEFAULT_PREFS, user: null, session: null, mail: null, mailAccounts: [], activeMail: null, secrets: {}, lastNotificationAt: null, trayHintShown: false, unlockedVersion: null };

let cache: Shape | null = null;

function file() {
  return join(app.getPath("userData"), "sorvia-desktop.json");
}

function load(): Shape {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(readFileSync(file(), "utf8")) as Partial<Shape>;
    cache = { ...EMPTY, ...parsed, mailAccounts: Array.isArray(parsed.mailAccounts) ? parsed.mailAccounts : [], prefs: sanitizePrefs({ ...DEFAULT_PREFS, ...(parsed.prefs ?? {}) }), secrets: parsed.secrets ?? {} };
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
  if (isOneOf(WALLPAPERS, input.wallpaper)) prefs.wallpaper = input.wallpaper;
  if (isOneOf(ACCENTS, input.accent)) prefs.accent = input.accent;
  if (isOneOf(UI_STYLES, input.uiStyle)) prefs.uiStyle = input.uiStyle;
  if (isOneOf(ICON_SIZES, input.iconSize)) prefs.iconSize = input.iconSize;
  if (isOneOf(DENSITIES, input.density)) prefs.density = input.density;
  prefs.shortcuts = sanitizeShortcuts(input.shortcuts);
  if (isOneOf(TOAST_POSITIONS, input.toastPosition)) prefs.toastPosition = input.toastPosition;
  if (isOneOf(SOUNDS, input.notificationSound)) prefs.notificationSound = input.notificationSound;
  if (typeof input.pollSeconds === "number" && Number.isFinite(input.pollSeconds)) prefs.pollSeconds = Math.min(600, Math.max(15, Math.round(input.pollSeconds)));
  if (typeof input.doNotDisturb === "boolean") prefs.doNotDisturb = input.doNotDisturb;
  if (typeof input.autoLockMinutes === "number" && [0, 5, 15, 30, 60].includes(input.autoLockMinutes)) prefs.autoLockMinutes = input.autoLockMinutes;
  prefs.homeLayout = cleanLayout(input.homeLayout);
  prefs.installed = Array.isArray(input.installed) ? [...new Set(input.installed.filter((item): item is string => typeof item === "string" && /^[a-z][a-z0-9-]{0,40}$/.test(item)))].slice(0, 100) : null;
  return prefs;
}

function cleanLayout(value: unknown): Preferences["homeLayout"] {
  if (!value || typeof value !== "object") return null;
  const ids = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is string => typeof item === "string" && /^[a-z][a-z0-9-]{0,40}$/.test(item)).slice(0, 120) : []);
  const layout = value as { grid?: unknown; dock?: unknown };
  return { grid: ids(layout.grid), dock: ids(layout.dock).slice(0, 7) };
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
  mailAccounts(): MailAccount[] {
    const shape = load();
    if (shape.mail && !shape.mailAccounts.length) {
      const legacy = shape.mail;
      const secret = shape.secrets.mail;
      update((next) => {
        next.mailAccounts = [{ id: "m1", address: legacy.address, name: legacy.name }];
        next.activeMail = "m1";
        next.mail = null;
        if (secret) next.secrets["mail:m1"] = secret;
        delete next.secrets.mail;
      });
    }
    return load().mailAccounts;
  },
  activeMail: () => load().activeMail,
  setMailAccounts(list: MailAccount[], active: string | null) {
    update((shape) => {
      shape.mailAccounts = list;
      shape.activeMail = active;
      shape.mail = null;
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
  unlockedVersion: () => load().unlockedVersion ?? null,
  setUnlockedVersion(value: string | null) {
    update((shape) => {
      shape.unlockedVersion = value;
    });
  },
  trayHintShown: () => load().trayHintShown,
  setTrayHintShown() {
    update((shape) => {
      shape.trayHintShown = true;
    });
  },
};
