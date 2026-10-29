import { CalendarDays, LayoutGrid, LifeBuoy, ListChecks, Mail, MessagesSquare, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ModuleId } from "@shared/contracts";

export type ModuleDef = {
  id: ModuleId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  shortcut: string;
  tile: string;
};

export const MODULES: ModuleDef[] = [
  { id: "home", title: "My Sorvia", subtitle: "Günün özeti", icon: LayoutGrid, shortcut: "Ctrl 1", tile: "from-[#ffb36b] via-[#ff8a2b] to-[#e8560c]" },
  { id: "tasks", title: "Görevler", subtitle: "Bana atanan işler", icon: ListChecks, shortcut: "Ctrl 2", tile: "from-[#ffd36b] via-[#f5a524] to-[#d9770c]" },
  { id: "calendar", title: "Takvim", subtitle: "Görüşmeler ve son tarihler", icon: CalendarDays, shortcut: "Ctrl 3", tile: "from-[#ff8f8f] via-[#f05a5a] to-[#c9303f]" },
  { id: "tickets", title: "Destek", subtitle: "Talepler ve yanıtlar", icon: LifeBuoy, shortcut: "Ctrl 4", tile: "from-[#8fd6c4] via-[#3fae94] to-[#1f7f6c]" },
  { id: "mail", title: "Sorvia Mail", subtitle: "Kurumsal e-posta", icon: Mail, shortcut: "Ctrl 5", tile: "from-[#9cc8ff] via-[#5a95f0] to-[#2f62c9]" },
  { id: "chat", title: "Ekip", subtitle: "Ekip sohbeti", icon: MessagesSquare, shortcut: "Ctrl 6", tile: "from-[#c9b2ff] via-[#9671ef] to-[#6a43c9]" },
  { id: "settings", title: "Ayarlar", subtitle: "Hesap ve tercihler", icon: Settings, shortcut: "Ctrl ,", tile: "from-[#cfc6bf] via-[#9a918a] to-[#6b635d]" },
];

export function moduleOf(id: ModuleId) {
  return MODULES.find((item) => item.id === id) ?? MODULES[0]!;
}
