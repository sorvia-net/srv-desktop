import { existsSync, readFileSync, writeFileSync } from "node:fs";

import type { Preferences } from "../shared/contracts";
import { auth } from "./auth";
import { call } from "./http";
import { store, type MailAccount } from "./store";

/**
 * Hesaba bağlı eşitleme: tercihler, ana ekran, kurulu uygulamalar, kısayollar,
 * duvar kâğıdı ve posta hesapları sunucuda tutulur. Yeni bir cihazda oturum
 * açınca hepsi kendiliğinden gelir; posta parolaları sunucuda şifreli durur.
 * Cihaza özgü tercihler (açılışta başlat, tepsi, ek ekranlar) eşitlenmez.
 */
const DEVICE_ONLY = new Set<keyof Preferences>(["launchAtLogin", "closeToTray", "extraScreens"]);
const PULL_EVERY = 5 * 60_000;

type RemoteAccount = { id: string; address: string; name: string; password: string };
type RemoteProfile = { prefs: Partial<Preferences>; prefsUpdatedAt: string | null; mailAccounts: RemoteAccount[]; activeMail: string | null; wallpaperAt: string | null };

type Hooks = {
  applyPrefs: (prefs: Preferences) => void;
  reloadMail: () => Promise<void>;
  wallpaperFile: () => string;
};

let hooks: Hooks | null = null;
let timer: NodeJS.Timeout | null = null;
let pushTimer: NodeJS.Timeout | null = null;
let pulling: Promise<void> | null = null;

function request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
  const token = auth.token();
  if (!token) return Promise.resolve(null);
  return call(method, path, { token, body, timeout: 30_000 }).then((result) => (result.ok ? (result.payload as T) : null));
}

function shared(prefs: Preferences) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prefs)) if (!DEVICE_ONLY.has(key as keyof Preferences)) result[key] = value;
  return result;
}

async function pushPrefs() {
  const at = store.sync().prefsAt ?? new Date().toISOString();
  await request("PATCH", "/api/desktop/profile", { prefs: shared(store.prefs()), updatedAt: at });
}

async function uploadAccount(account: MailAccount, active: boolean) {
  const password = store.secret(`mail:${account.id}`);
  if (!password) return false;
  return Boolean(await request("POST", "/api/desktop/profile/mail", { id: account.id, address: account.address, name: account.name, password, active }));
}

async function syncMail(remote: RemoteProfile) {
  const local = store.mailAccounts();
  const known = new Set(store.sync().mailIds);
  let changed = false;

  // İlk eşitleme: sunucu boşsa bu cihazdaki hesaplar yüklenir.
  if (!remote.mailAccounts.length) {
    const uploaded: string[] = [];
    for (const account of local) if (await uploadAccount(account, account.id === store.activeMail())) uploaded.push(account.id);
    store.setSync({ mailIds: uploaded });
    return false;
  }

  const remoteIds = new Set(remote.mailAccounts.map((item) => item.id));
  let next = [...local];

  // Başka cihazda silinenler burada da silinir; hiç eşitlenmemiş yerel hesaplar yüklenir.
  for (const account of local) {
    if (remoteIds.has(account.id)) continue;
    if (known.has(account.id) || remote.mailAccounts.some((item) => item.address === account.address)) {
      next = next.filter((item) => item.id !== account.id);
      store.setSecret(`mail:${account.id}`, null);
      changed = true;
    } else await uploadAccount(account, false);
  }

  for (const account of remote.mailAccounts) {
    const existing = next.find((item) => item.id === account.id);
    if (!existing || existing.name !== account.name || existing.address !== account.address) {
      next = existing ? next.map((item) => (item.id === account.id ? { id: account.id, address: account.address, name: account.name } : item)) : [...next, { id: account.id, address: account.address, name: account.name }];
      changed = true;
    }
    if (store.secret(`mail:${account.id}`) !== account.password) {
      store.setSecret(`mail:${account.id}`, account.password);
      changed = true;
    }
  }

  const active = next.some((item) => item.id === store.activeMail()) ? store.activeMail() : (next.find((item) => item.id === remote.activeMail)?.id ?? next[0]?.id ?? null);
  if (changed || active !== store.activeMail()) store.setMailAccounts(next, active);
  store.setSync({ mailIds: next.map((item) => item.id) });
  return changed;
}

async function syncWallpaper(remote: RemoteProfile) {
  if (!hooks || !remote.wallpaperAt) return false;
  const localAt = store.sync().wallpaperAt;
  if (localAt && localAt >= remote.wallpaperAt && existsSync(hooks.wallpaperFile())) return false;
  const image = await request<{ data: string; wallpaperAt: string }>("GET", "/api/desktop/profile/wallpaper");
  if (!image) return false;
  writeFileSync(hooks.wallpaperFile(), Buffer.from(image.data, "base64"));
  store.setSync({ wallpaperAt: image.wallpaperAt });
  return true;
}

async function pull() {
  const remote = await request<RemoteProfile>("GET", "/api/desktop/profile");
  if (!remote || !hooks) return;

  const localAt = store.sync().prefsAt;
  let prefsChanged = false;
  if (remote.prefsUpdatedAt && (!localAt || remote.prefsUpdatedAt > localAt)) {
    const current = store.prefs();
    const device = Object.fromEntries([...DEVICE_ONLY].map((key) => [key, current[key]]));
    store.setPrefs({ ...current, ...remote.prefs, ...device });
    store.setSync({ prefsAt: remote.prefsUpdatedAt });
    prefsChanged = true;
  } else if (localAt && (!remote.prefsUpdatedAt || localAt > remote.prefsUpdatedAt)) {
    await pushPrefs();
  } else if (!localAt && !remote.prefsUpdatedAt) {
    store.setSync({ prefsAt: new Date().toISOString() });
    await pushPrefs();
  }

  store.setSync({ ready: true });
  const wallpaperChanged = await syncWallpaper(remote);
  if (prefsChanged || wallpaperChanged) hooks.applyPrefs(store.prefs());
  if (await syncMail(remote)) await hooks.reloadMail();
}

export const sync = {
  init(value: Hooks) {
    hooks = value;
  },
  /** Oturum açılınca ve beş dakikada bir sunucudakini alır. */
  start() {
    void sync.pull();
    if (timer) clearInterval(timer);
    timer = setInterval(() => void sync.pull(), PULL_EVERY);
  },
  stop() {
    if (timer) clearInterval(timer);
    if (pushTimer) clearTimeout(pushTimer);
    timer = null;
    pushTimer = null;
  },
  pull() {
    pulling ??= pull()
      .catch(() => undefined)
      .finally(() => {
        pulling = null;
      });
    return pulling;
  },
  /** Yerel tercih değişikliği: zaman damgası şimdi, gönderim birkaç saniye sonra toplu. */
  prefsChanged() {
    // Bu cihaz ilk kez eşitlenmeden yapılan değişiklikler (ilk açılışta oluşan
    // varsayılan düzen gibi) hesaptaki tercihleri ezmesin; ilk çekiş uzlaştırır.
    if (!store.sync().ready) return;
    store.setSync({ prefsAt: new Date().toISOString() });
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void pushPrefs().catch(() => undefined), 3_000);
  },
  mailAdded(account: MailAccount, active: boolean) {
    void uploadAccount(account, active).then((done) => {
      if (done) store.setSync({ mailIds: [...new Set([...store.sync().mailIds, account.id])] });
    });
  },
  mailRemoved(id: string) {
    store.setSync({ mailIds: store.sync().mailIds.filter((item) => item !== id) });
    void request("DELETE", `/api/desktop/profile/mail/${encodeURIComponent(id)}`);
  },
  mailActivated(id: string) {
    void request("PATCH", "/api/desktop/profile", { activeMail: id });
  },
  wallpaperChanged(file: string) {
    if (!existsSync(file)) return;
    void request<{ wallpaperAt: string }>("POST", "/api/desktop/profile/wallpaper", { data: readFileSync(file).toString("base64") }).then((result) => {
      if (result) store.setSync({ wallpaperAt: result.wallpaperAt });
    });
  },
  /** Çıkışta bu cihazın eşitleme izi silinir; sunucudaki kayıtlar kalır. */
  reset() {
    sync.stop();
    store.setSync({ prefsAt: null, wallpaperAt: null, mailIds: [], ready: false });
  },
};
