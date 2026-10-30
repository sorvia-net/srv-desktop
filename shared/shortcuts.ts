export const SHORTCUT_ACTIONS = [
  { id: "palette", label: "Arama ve komutlar", fallback: "Ctrl+K" },
  { id: "quickTask", label: "Yeni görev", fallback: "Ctrl+N" },
  { id: "notifications", label: "Bildirimler", fallback: "Ctrl+B" },
  { id: "control", label: "Kontrol merkezi", fallback: "Ctrl+J" },
  { id: "settings", label: "Ayarlar", fallback: "Ctrl+," },
  { id: "home", label: "Ana ekran", fallback: "Ctrl+H" },
  { id: "closeApp", label: "Açık uygulamayı kapat", fallback: "Ctrl+Shift+W" },
  { id: "closeBackground", label: "Arka plandaki uygulamaları kapat", fallback: "Ctrl+Shift+Q" },
  { id: "switcher", label: "Uygulama değiştirici", fallback: "Ctrl+Tab" },
  { id: "lock", label: "Ekranı kilitle", fallback: "Ctrl+L" },
  { id: "refresh", label: "Yenile", fallback: "F5" },
  { id: "mail", label: "Posta", fallback: "Ctrl+Shift+M" },
  { id: "nextAccount", label: "Sonraki posta hesabı", fallback: "Ctrl+Shift+A" },
  { id: "global", label: "Sorvia'yı her yerden aç (Windows geneli)", fallback: "Ctrl+Shift+Space" },
] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number]["id"];

const MODIFIERS = ["Ctrl", "Alt", "Shift"] as const;
const NAMES: Record<string, string> = { " ": "Space", arrowleft: "Left", arrowright: "Right", arrowup: "Up", arrowdown: "Down", escape: "Esc", ",": ",", ".": "." };

export function normalizeCombo(value: string): string | null {
  const parts = value.split("+").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const key = parts[parts.length - 1]!;
  const mods = MODIFIERS.filter((mod) => parts.slice(0, -1).some((part) => part.toLowerCase() === mod.toLowerCase()));
  if (parts.length - 1 !== mods.length) return null;
  if (!/^(F([1-9]|1[0-2])|[A-Z0-9]|Space|Tab|Left|Right|Up|Down|Esc|,|\.|\/|-|=)$/i.test(key)) return null;
  const finalKey = key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1);
  if (!mods.length && !/^F\d+$/.test(finalKey)) return null;
  return [...mods, finalKey].join("+");
}

export function comboFromEvent(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): string | null {
  const lower = event.key.toLowerCase();
  if (["control", "shift", "alt", "meta"].includes(lower)) return null;
  const key = NAMES[lower] ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key);
  const mods = [event.ctrlKey || event.metaKey ? "Ctrl" : null, event.altKey ? "Alt" : null, event.shiftKey ? "Shift" : null].filter(Boolean);
  return normalizeCombo([...mods, key].join("+"));
}

export function resolveShortcuts(saved: Record<string, string> | null | undefined): Record<ShortcutAction, string> {
  const result = {} as Record<ShortcutAction, string>;
  for (const action of SHORTCUT_ACTIONS) {
    const custom = saved?.[action.id];
    result[action.id] = custom === "" ? "" : (custom && normalizeCombo(custom)) || action.fallback;
  }
  return result;
}

export function sanitizeShortcuts(input: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!input || typeof input !== "object") return result;
  for (const action of SHORTCUT_ACTIONS) {
    const value = (input as Record<string, unknown>)[action.id];
    if (value === "") result[action.id] = "";
    else if (typeof value === "string") {
      const combo = normalizeCombo(value);
      if (combo && combo !== action.fallback) result[action.id] = combo;
    }
  }
  return result;
}

export function toAccelerator(combo: string) {
  return combo.replace(/^Ctrl\+/, "CommandOrControl+").replace("Esc", "Escape");
}
