import type { NotificationSound } from "@shared/appearance";

const FILES: Record<Exclude<NotificationSound, "off">, string> = { ses1: "sounds/bildirim-1.mp3", ses2: "sounds/bildirim-2.mp3" };
let last = 0;

export function playSound(sound: NotificationSound, force = false) {
  if (sound === "off") return;
  if (!force && Date.now() - last < 1500) return;
  last = Date.now();
  const audio = new Audio(FILES[sound]);
  audio.volume = 0.8;
  void audio.play().catch(() => undefined);
}
