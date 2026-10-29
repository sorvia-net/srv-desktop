import {
  Activity, BookOpen, Bot, CalendarDays, ChartColumn, Code2, Cpu, CreditCard, Crown, FileText, FolderOpen, Globe, Images, LayoutDashboard, LayoutGrid, LifeBuoy, ListChecks, Mail, Megaphone, MessagesSquare, Package, Server, Settings, Shield,
  ShoppingBag, ShoppingCart, Sparkles, Store, Ticket, UserRound, Users, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DesktopUser, HomeLayout, ModuleId, StoreModule } from "@shared/contracts";

export type ModuleDef = {
  id: string;
  kind: "app" | "link";
  title: string;
  subtitle: string;
  description: string;
  category: string;
  icon: LucideIcon;
  tile: string;
  url?: string;
  system?: boolean;
  folder?: string;
  permission?: string;
  role?: "ADMIN" | "OWNER";
  features: string[];
  screenshots?: string[];
  version: string;
  size: string;
};

export type AppDef = ModuleDef & { kind: "app"; id: ModuleId };
export type LinkDef = ModuleDef & { kind: "link"; url: string };
export type FolderDef = { kind: "folder"; id: string; title: string };
export type HomeItem = AppDef | LinkDef | FolderDef;

const SITE = "https://sorvia.net";

export const ICONS: Record<string, LucideIcon> = {
  Activity, BookOpen, Bot, ChartColumn, Code2, Cpu, CreditCard, Crown, FileText, Globe, LayoutDashboard, Megaphone, Package, Server, Shield, ShoppingBag, ShoppingCart, Sparkles, Store, Ticket, UserRound, Users, Wrench,
};

export const FOLDERS: FolderDef[] = [
  { kind: "folder", id: "folder-admin", title: "Yönetim" },
  { kind: "folder", id: "folder-links", title: "Bağlantılar" },
];

const APP_LIST: AppDef[] = [
  {
    kind: "app", id: "home", title: "My Sorvia", subtitle: "Günün özeti", category: "Sistem", icon: LayoutGrid, tile: "linear-gradient(160deg,#ffbf7a 0%,#ff8a2b 48%,#e4560c 100%)", system: true, version: "1.0", size: "1,2 MB",
    description: "Açık görevlerin, bekleyen talepler, bildirimler ve haftalık çalışma ritmin tek ekranda.",
    features: ["Haftalık tempo grafiği", "Panolar ve destek hedefi", "Ajanda ve hızlı eylemler"], screenshots: ["store/home.jpg"],
  },
  {
    kind: "app", id: "tasks", title: "Görevler", subtitle: "Pano ve liste", category: "Verimlilik", icon: ListChecks, tile: "linear-gradient(160deg,#ffe08a 0%,#f7b32b 50%,#e08a0c 100%)", version: "1.0", size: "0,9 MB",
    description: "Ekip panolarında görevleri sürükle bırak ile yönet, son tarihleri ve öncelikleri takip et.",
    features: ["Sürükle bırak pano", "Hızlı görev (Ctrl+N)", "Atama ve tamamlanma bildirimleri"], screenshots: ["store/tasks.jpg"],
  },
  {
    kind: "app", id: "calendar", title: "Takvim", subtitle: "Görüşmeler ve son tarihler", category: "Verimlilik", icon: CalendarDays, tile: "#fbfaf8", version: "1.0", size: "0,7 MB",
    description: "Müşteri görüşmeleri, görev son tarihleri ve hatırlatmalar ay ve hafta görünümünde.",
    features: ["Ay ve hafta görünümü", "Görüşme kanalları", "Yaklaşan kayıtlar"], screenshots: ["store/calendar.jpg"],
  },
  {
    kind: "app", id: "tickets", title: "Destek", subtitle: "Talepler ve yanıtlar", category: "Destek", icon: LifeBuoy, tile: "linear-gradient(160deg,#8ee6cf 0%,#33b597 50%,#147a66 100%)", permission: "tickets.view", version: "1.0", size: "1,1 MB",
    description: "Sana atanan ve yanıt bekleyen talepleri gör, müşteriye yanıt ver ya da ekip için iç not bırak.",
    features: ["Yanıt ve iç not", "Discord ve e-posta ile aynı akış", "Yapay zekâ karşılaması"], screenshots: ["store/tickets.jpg"],
  },
  {
    kind: "app", id: "mail", title: "Sorvia Mail", subtitle: "Kurumsal e-posta", category: "İletişim", icon: Mail, tile: "linear-gradient(160deg,#9fd0ff 0%,#4b93f2 52%,#2457c8 100%)", version: "1.0", size: "2,4 MB",
    description: "Kurumsal posta kutun mail.sorvia.net ile doğrudan bağlanır. Yeni posta anında düşer, dış görseller ve betikler engellenir.",
    features: ["Anlık yeni posta (IDLE)", "Güvenli HTML görüntüleme", "Ekler ve klasörler"], screenshots: ["store/mail.jpg"],
  },
  {
    kind: "app", id: "chat", title: "Ekip", subtitle: "Ekip sohbeti", category: "İletişim", icon: MessagesSquare, tile: "linear-gradient(160deg,#8ff0a4 0%,#34c759 52%,#1f8f3c 100%)", permission: "chat.use", version: "1.0", size: "0,6 MB",
    description: "Ekip kanallarında yazış, sabitlenen duyuruları gör.",
    features: ["Kanallar ve okunmamış sayısı", "Sabitlenen mesajlar", "Anında gönderim"], screenshots: ["store/chat.jpg"],
  },
  {
    kind: "app", id: "gallery", title: "Galeri", subtitle: "Medya kütüphanesi", category: "Yönetim", icon: Images, tile: "#fbfaf8", folder: "folder-admin", permission: "media.view", version: "1.0", size: "0,8 MB",
    description: "Sitedeki tüm görselleri gör, sürükle bırak ile yükle, açıklamaları düzenle; kullanılan görseller silinmeden önce uyarır.",
    features: ["Sürükle bırak yükleme", "Klasörler ve arama", "Kullanım yerleri"], screenshots: ["store/gallery.jpg"],
  },
  {
    kind: "app", id: "storage", title: "Depolama", subtitle: "Dosyalar ve alan", category: "Yönetim", icon: FolderOpen, tile: "#fbfaf8", folder: "folder-admin", version: "1.0", size: "0,9 MB",
    description: "Sunucudaki alanın nereye gittiğini gör, kurucu deposundaki dosyaları yükle, indir ve düzenle.",
    features: ["Depolama özeti", "Şifreli kurucu deposu", "İndirilenler"], screenshots: ["store/storage.jpg"],
  },
  {
    kind: "app", id: "store", title: "Mağaza", subtitle: "Modülleri keşfet", category: "Sistem", icon: ShoppingBag, tile: "linear-gradient(160deg,#7cc7ff 0%,#2f80ed 55%,#1c4fd1 100%)", system: true, version: "1.0", size: "0,5 MB",
    description: "Sorvia modüllerini yükle, kaldır ve güncelle.",
    features: [],
  },
  {
    kind: "app", id: "settings", title: "Ayarlar", subtitle: "Hesap ve tercihler", category: "Sistem", icon: Settings, tile: "linear-gradient(160deg,#d9d6d2 0%,#9d9893 55%,#6c6762 100%)", system: true, version: "1.0", size: "0,4 MB",
    description: "Hesap, bildirimler, görünüm ve sistem tercihleri.",
    features: [],
  },
];

const LINK_LIST: LinkDef[] = [
  link("link-site", "Sorvia.net", "Ana site", Globe, "linear-gradient(160deg,#3a2c22 0%,#1d1612 100%)", SITE, "folder-links"),
  link("link-panel", "Panelim", "Müşteri paneli görünümü", UserRound, "linear-gradient(160deg,#a5b4fc 0%,#6366f1 55%,#4338ca 100%)", `${SITE}/panel`, "folder-links"),
  link("link-admin", "Yönetim", "Yönetim paneli", LayoutDashboard, "linear-gradient(160deg,#c4b5fd 0%,#8b5cf6 55%,#6d28d9 100%)", `${SITE}/admin`, "folder-admin", { permission: "dashboard.view" }),
  link("link-orders", "Siparişler", "Siparişler ve ödemeler", ShoppingCart, "linear-gradient(160deg,#86efac 0%,#22c55e 55%,#15803d 100%)", `${SITE}/admin/siparisler`, "folder-admin", { permission: "orders.view" }),
  link("link-users", "Kullanıcılar", "Hesaplar ve roller", Users, "linear-gradient(160deg,#93c5fd 0%,#3b82f6 55%,#1d4ed8 100%)", `${SITE}/admin/kullanicilar`, "folder-admin", { permission: "users.view" }),
  link("link-products", "Ürünler", "Katalog ve sürümler", Package, "linear-gradient(160deg,#fdba74 0%,#f97316 55%,#c2410c 100%)", `${SITE}/admin/urunler`, "folder-admin", { permission: "catalog.view" }),
  link("link-owners", "Kurucu paneli", "Finans, depo, evraklar", Crown, "linear-gradient(160deg,#fde68a 0%,#f59e0b 55%,#b45309 100%)", `${SITE}/owners`, "folder-admin", { role: "OWNER" }),
  link("link-status", "Durum", "Servis durumu", Activity, "linear-gradient(160deg,#6ee7b7 0%,#10b981 55%,#047857 100%)", `${SITE}/durum`, "folder-links"),
  link("link-dev", "sorvia.dev", "Geliştirici dokümanları", Code2, "linear-gradient(160deg,#a78bfa 0%,#7c3aed 55%,#4c1d95 100%)", "https://sorvia.dev", "folder-links"),
  link("link-store", "Sorvia Store", "Giyim mağazası", Store, "linear-gradient(160deg,#f9a8d4 0%,#ec4899 55%,#be185d 100%)", "https://sorvia.store", "folder-links"),
  link("link-cc", "Command Center", "Altyapı paneli", Cpu, "linear-gradient(160deg,#5eead4 0%,#14b8a6 55%,#0f766e 100%)", "https://tr-sorvia-panelorg.sorvia.net", "folder-links", { role: "ADMIN" }),
  link("link-ai", "Yapay zekâ", "9Router ağ geçidi", Sparkles, "linear-gradient(160deg,#93c5fd 0%,#8b5cf6 50%,#db2777 100%)", "https://ai.sorvia.dev", "folder-links", { role: "ADMIN" }),
];

function link(id: string, title: string, subtitle: string, icon: LucideIcon, tile: string, url: string, folder: string, extra: { permission?: string; role?: "ADMIN" | "OWNER" } = {}): LinkDef {
  return { kind: "link", id, title, subtitle, description: `${subtitle}. Tarayıcında açılır.`, category: "Web", icon, tile, url, folder, features: [], version: "web", size: "—", ...extra };
}

let remote: LinkDef[] = [];

export function setRemoteModules(list: StoreModule[]) {
  remote = list
    .filter((item) => item.kind === "web" && item.url && !APP_LIST.some((app) => app.id === item.id) && !LINK_LIST.some((entry) => entry.id === item.id))
    .map((item) => ({
      kind: "link" as const,
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      category: item.category || "Web",
      icon: ICONS[item.icon] ?? Globe,
      tile: item.tile || "linear-gradient(160deg,#94a3b8 0%,#475569 100%)",
      url: item.url!,
      folder: item.folder ?? "folder-links",
      permission: item.permission ?? undefined,
      role: item.role ?? undefined,
      features: item.features,
      version: item.version || "web",
      size: "—",
    }));
}

export function catalog(): (AppDef | LinkDef)[] {
  return [...APP_LIST, ...LINK_LIST, ...remote];
}

export const DEFAULT_LAYOUT: HomeLayout = {
  grid: ["home", "tasks", "calendar", "tickets", "mail", "chat", "folder-admin", "folder-links", "store", "settings"],
  dock: ["home", "tasks", "tickets", "mail", "chat"],
};

const ROLE_LEVEL: Record<string, number> = { DEVELOPER: 40, SUPPORT: 50, MODERATOR: 60, ADMIN: 90, OWNER: 100 };

export function itemById(id: string): HomeItem | null {
  return catalog().find((item) => item.id === id) ?? FOLDERS.find((folder) => folder.id === id) ?? null;
}

export function appById(id: ModuleId) {
  return APP_LIST.find((item) => item.id === id)!;
}

export function available(item: AppDef | LinkDef, user: DesktopUser) {
  if (item.kind === "app" && item.id !== "store" && item.id !== "settings" && !user.modules.includes(item.id)) return false;
  if (item.role && (ROLE_LEVEL[user.role] ?? 0) < ROLE_LEVEL[item.role]!) return false;
  if (item.permission && user.role !== "OWNER" && !user.permissions.includes(item.permission)) return false;
  return true;
}

export function lockReason(item: AppDef | LinkDef, user: DesktopUser) {
  if (available(item, user)) return null;
  if (item.role === "OWNER") return "Yalnız kurucular";
  if (item.role === "ADMIN") return "Yönetici ve üstü";
  return item.permission ? `Yetki gerekir: ${item.permission}` : "Bu hesapta kullanılamaz";
}

export function installedSet(installed: string[] | null, user: DesktopUser) {
  const all = catalog().filter((item) => available(item, user));
  const ids = installed ? new Set([...installed, ...all.filter((item) => item.system).map((item) => item.id)]) : new Set(all.map((item) => item.id));
  return new Set(all.filter((item) => ids.has(item.id)).map((item) => item.id));
}

export function visible(item: HomeItem, user: DesktopUser, installed: Set<string>): boolean {
  if (item.kind === "folder") return folderItems(item, user, installed).length > 0;
  return installed.has(item.id) && available(item, user);
}

export function folderItems(folder: FolderDef, user: DesktopUser, installed: Set<string>) {
  return catalog().filter((item) => item.folder === folder.id && installed.has(item.id) && available(item, user));
}

export function resolveLayout(saved: HomeLayout | null, user: DesktopUser, installed: Set<string>) {
  const fits = (id: string) => {
    const item = itemById(id);
    return Boolean(item && visible(item, user, installed) && !(item.kind !== "folder" && item.folder));
  };
  const unique = (ids: string[]) => ids.filter((id, index) => ids.indexOf(id) === index);
  const grid = unique(saved?.grid?.length ? saved.grid : DEFAULT_LAYOUT.grid).filter(fits);
  const dock = unique(saved?.dock?.length ? saved.dock : DEFAULT_LAYOUT.dock).filter((id) => fits(id) && itemById(id)?.kind === "app").slice(0, 7);
  const placed = new Set(grid);
  const missing = [...catalog().filter((item) => !item.folder).map((item) => item.id), ...FOLDERS.map((folder) => folder.id)].filter((id) => !placed.has(id) && fits(id));
  return { grid: [...grid, ...missing], dock };
}

export function itemBadge(item: HomeItem, badges: Partial<Record<string, number>>, user: DesktopUser, installed: Set<string>): number {
  if (item.kind === "app") return badges[item.id] ?? 0;
  if (item.kind === "folder") return folderItems(item, user, installed).reduce((sum, child) => sum + itemBadge(child, badges, user, installed), 0);
  return 0;
}
