export const WALLPAPERS = ["ember", "dusk", "noir", "ocean", "forest", "graphite", "custom"] as const;
export type Wallpaper = (typeof WALLPAPERS)[number];

export const WALLPAPER_LABEL: Record<Wallpaper, string> = {
  ember: "Kor",
  dusk: "Alacakaranlık",
  noir: "Gece",
  ocean: "Okyanus",
  forest: "Orman",
  graphite: "Grafit",
  custom: "Kendi görselim",
};

export const ACCENTS = {
  ember: { label: "Turuncu", base: "#ff7a1a", light: "#ff9b42", soft: "#ffb877", ink: "#1c0d03" },
  rose: { label: "Gül", base: "#f43f5e", light: "#fb7185", soft: "#fda4af", ink: "#2a0610" },
  violet: { label: "Mor", base: "#8b5cf6", light: "#a78bfa", soft: "#c4b5fd", ink: "#14082e" },
  ocean: { label: "Mavi", base: "#2f80ed", light: "#5aa2ff", soft: "#93c5fd", ink: "#04132b" },
  mint: { label: "Yeşil", base: "#10b981", light: "#34d399", soft: "#6ee7b7", ink: "#03221a" },
  gold: { label: "Altın", base: "#eab308", light: "#facc15", soft: "#fde68a", ink: "#231a02" },
  graphite: { label: "Grafit", base: "#8e8a86", light: "#b4afaa", soft: "#d6d1cc", ink: "#141210" },
} as const;
export type Accent = keyof typeof ACCENTS;

export const UI_STYLES = { glass: "Cam", frosted: "Buzlu", solid: "Mat" } as const;
export type UiStyle = keyof typeof UI_STYLES;

export const ICON_SIZES = { small: 62, medium: 76, large: 90 } as const;
export type IconSize = keyof typeof ICON_SIZES;

export const DENSITIES = { comfortable: "Ferah", compact: "Sık" } as const;
export type Density = keyof typeof DENSITIES;

export const TOAST_POSITIONS = {
  "top-left": "Sol üst",
  "top-center": "Üst orta",
  "top-right": "Sağ üst",
  "bottom-left": "Sol alt",
  "bottom-center": "Alt orta",
  "bottom-right": "Sağ alt",
} as const;
export type ToastPosition = keyof typeof TOAST_POSITIONS;

export const SOUNDS = { ses1: "Sorvia 1", ses2: "Sorvia 2", off: "Sessiz" } as const;
export type NotificationSound = keyof typeof SOUNDS;

export function isOneOf<T extends string>(list: readonly T[] | Record<T, unknown>, value: unknown): value is T {
  const keys = Array.isArray(list) ? list : Object.keys(list);
  return typeof value === "string" && (keys as string[]).includes(value);
}
