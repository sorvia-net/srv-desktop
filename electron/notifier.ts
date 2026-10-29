import { Notification, type NativeImage } from "electron";

import type { AppNotification } from "../shared/contracts";
import { commandForNotification } from "../shared/routes";
import { request } from "./api";
import { store } from "./store";

type Deps = { focused: () => boolean; open: (command: string) => void; icon: () => NativeImage; attention: () => void };

const live = new Set<Notification>();

export function toast(deps: Pick<Deps, "open" | "icon">, title: string, body: string, command: string | null) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body: body.slice(0, 240), icon: deps.icon(), silent: false });
  live.add(notification);
  const release = () => live.delete(notification);
  notification.on("click", () => {
    release();
    if (command) deps.open(command);
  });
  notification.on("close", release);
  notification.on("failed", release);
  notification.show();
}

export function createNotifier(deps: Deps) {
  let timer: NodeJS.Timeout | null = null;
  let busy = false;

  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const result = await request<AppNotification[]>("GET", "/api/desktop/notifications", { unread: true, limit: 20 });
      if (!result.ok) return;
      const items = result.data.filter((item) => !item.readAt);
      const last = store.lastNotificationAt();
      const newest = result.data.reduce<string | null>((best, item) => (!best || item.createdAt > best ? item.createdAt : best), null);
      if (newest && (!last || newest > last)) store.setLastNotificationAt(newest);
      if (!last) return;
      const fresh = items.filter((item) => item.createdAt > last).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (!fresh.length || !store.prefs().nativeNotifications || deps.focused()) return;
      for (const item of fresh.slice(-3)) toast(deps, item.title, item.body ?? "", commandForNotification(item));
      if (fresh.length > 3) toast(deps, "Sorvia", `${fresh.length - 3} bildirim daha var.`, "notifications");
      deps.attention();
    } finally {
      busy = false;
    }
  };

  return {
    start() {
      this.stop();
      if (!store.lastNotificationAt()) store.setLastNotificationAt(new Date().toISOString());
      void tick();
      timer = setInterval(() => void tick(), store.prefs().pollSeconds * 1000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    restart() {
      if (timer) this.start();
    },
  };
}
