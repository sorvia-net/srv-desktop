import {
  Disc3, Gamepad2, Headphones, MessageCircle, Music, Send,
  Activity, BookOpen, Bot, CalendarDays, ChartColumn, Code2, Cpu, CreditCard, Crown, FileText, FolderOpen, Globe, Images, LayoutDashboard, LayoutGrid, LifeBuoy, ListChecks, Mail, Megaphone, MessagesSquare, Package, Server, Settings, Shield,
  ShoppingBag, ShoppingCart, Sparkles, Store, Ticket, UserRound, Users, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DesktopUser, HomeLayout, ModuleId, StoreModule } from "@shared/contracts";
import { bridge } from "@/data/bridge";
import { siDiscord, siSpotify, siTelegram, siWhatsapp, siYoutubemusic } from "simple-icons";

export type ModuleDef = {
  id: string;
  kind: "app" | "link";
  title: string;
  subtitle: string;
  description: string;
  category: string;
  icon: LucideIcon;
  brand?: { path: string; fg: string; bg: string; scale?: number };
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
export type LinkDef = ModuleDef & { kind: "link"; url: string; window?: boolean };
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
    kind: "app", id: "users", title: "Kullanıcılar", subtitle: "Hesaplar ve roller", category: "Yönetim", icon: Users, tile: "linear-gradient(160deg,#93c5fd 0%,#3b82f6 55%,#1d4ed8 100%)", folder: "folder-admin", permission: "users.view", version: "1.0", size: "0,6 MB",
    description: "Müşteri ve ekip hesaplarını ara, ayrıntılarını gör; yetkin varsa rol değiştir, askıya al ya da yasakla.",
    features: ["Arama ve ekip filtresi", "Rol ve durum değişikliği", "Sipariş ve lisans özeti"], screenshots: ["store/users.jpg"],
  },
  {
    kind: "app", id: "orders", title: "Siparişler", subtitle: "Ödemeler ve iadeler", category: "Yönetim", icon: ShoppingCart, tile: "linear-gradient(160deg,#86efac 0%,#22c55e 55%,#15803d 100%)", folder: "folder-admin", permission: "orders.view", version: "1.0", size: "0,6 MB",
    description: "Siparişleri izle, bekleyen havaleleri ödendi işaretle, iptal ve iade yap.",
    features: ["Son 30 gün ciro", "Bekleyen ödemeler", "Ödendi / iptal / iade"], screenshots: ["store/orders.jpg"],
  },
  {
    kind: "app", id: "status", title: "Durum", subtitle: "Servis sağlığı", category: "Yönetim", icon: Activity, tile: "linear-gradient(160deg,#6ee7b7 0%,#10b981 55%,#047857 100%)", folder: "folder-admin", version: "1.0", size: "0,3 MB",
    description: "Sorvia servislerinin anlık durumu, gecikmeleri, 30 günlük geçmişi ve açık olaylar.",
    features: ["Anlık durum", "30 günlük geçmiş", "Açık olaylar"], screenshots: ["store/status.jpg"],
  },
  {
    kind: "app", id: "admin", title: "Yönetim", subtitle: "Anlık özet", category: "Yönetim", icon: LayoutDashboard, tile: "linear-gradient(160deg,#c4b5fd 0%,#8b5cf6 55%,#6d28d9 100%)", folder: "folder-admin", permission: "dashboard.view", version: "1.0", size: "0,4 MB",
    description: "Sipariş, ciro, destek, kullanıcı ve hata sayılarını tek ekranda gör; karta tıklayınca ilgili uygulama açılır.",
    features: ["Son 30 gün ciro", "Bekleyen işler", "14 günlük satış grafiği"],
  },
  {
    kind: "app", id: "products", title: "Ürünler", subtitle: "Katalog ve satışlar", category: "Yönetim", icon: Package, tile: "linear-gradient(160deg,#fdba74 0%,#f97316 55%,#c2410c 100%)", folder: "folder-admin", permission: "catalog.view", version: "1.0", size: "0,5 MB",
    description: "Ürünlerin satışlarını, lisanslarını ve sürümlerini gör; fiyatı değiştir, yayınla ya da gizle.",
    features: ["30 günlük satış", "Fiyat ve yayın durumu", "Sürümler ve yorumlar"],
  },
  {
    kind: "app", id: "founder", title: "Kurucu paneli", subtitle: "Finans ve vergi", category: "Yönetim", icon: Crown, tile: "linear-gradient(160deg,#fde68a 0%,#f59e0b 55%,#b45309 100%)", folder: "folder-admin", role: "OWNER", version: "1.0", size: "0,5 MB",
    description: "Gelir, gider, KDV ve kurumlar vergisi tahmini, yaklaşan ödemeler, açık faturalar ve evraklar.",
    features: ["Aylık ve yıllık finans", "Vergi takvimi", "Ödemeler ve evraklar"],
  },
  {
    kind: "app", id: "games", title: "Oyunlar", subtitle: "Ekiple yarış", category: "Eğlence", icon: Gamepad2, tile: "linear-gradient(160deg,#f0abfc 0%,#c026d3 55%,#86198f 100%)", version: "1.0", size: "1,1 MB",
    description: "Mayın Tarlası, Solitaire, Blackjack, Yılan ve 2048. En iyi skorlar ekip sıralamasına girer.",
    features: ["5 oyun", "Ekip sıralaması", "Skorlar sunucuda saklanır"],
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
  link("link-dev", "sorvia.dev", "Geliştirici dokümanları", Code2, "linear-gradient(160deg,#a78bfa 0%,#7c3aed 55%,#4c1d95 100%)", "https://sorvia.dev", "folder-links"),
  link("link-store", "Sorvia Store", "Giyim mağazası", Store, "linear-gradient(160deg,#f9a8d4 0%,#ec4899 55%,#be185d 100%)", "https://sorvia.store", "folder-links"),
  link("link-cc", "Command Center", "Altyapı paneli", Cpu, "linear-gradient(160deg,#5eead4 0%,#14b8a6 55%,#0f766e 100%)", "https://tr-sorvia-panelorg.sorvia.net", "folder-links", { role: "ADMIN" }),
  appWindow("app-spotify", "Spotify", "Müzik ve podcast", Music, "#121212", "https://open.spotify.com", { path: siSpotify.path, fg: "#1ed760", bg: "#121212" }),
  appWindow("app-whatsapp", "WhatsApp", "Mesajlaşma", MessageCircle, "#25d366", "https://web.whatsapp.com", { path: siWhatsapp.path, fg: "#ffffff", bg: "linear-gradient(180deg,#5ff07f 0%,#25d366 55%,#1cb956 100%)" }),
  appWindow("app-discord", "Discord", "Sunucular ve sohbet", Headphones, "#5865f2", "https://discord.com/app", { path: siDiscord.path, fg: "#ffffff", bg: "#5865f2", scale: 0.56 }),
  appWindow("app-ytmusic", "YouTube Music", "Müzik", Disc3, "#000000", "https://music.youtube.com", { path: siYoutubemusic.path, fg: "#ff0000", bg: "#000000", scale: 0.66 }),
  appWindow("app-telegram", "Telegram", "Mesajlaşma", Send, "#ffffff", "https://web.telegram.org/a/", { path: siTelegram.path, fg: "#26a5e4", bg: "#ffffff", scale: 0.7 }),
  link("link-ai", "Yapay zekâ", "9Router ağ geçidi", Sparkles, "linear-gradient(160deg,#93c5fd 0%,#8b5cf6 50%,#db2777 100%)", "https://ai.sorvia.dev", "folder-links", { role: "ADMIN" }),
];

function appWindow(id: string, title: string, subtitle: string, icon: LucideIcon, tile: string, url: string, brand: ModuleDef["brand"]): LinkDef {
  return { kind: "link", id, title, subtitle, brand, description: `${subtitle}. Sorvia'nın içinde kendi uygulaması olarak açılır; oturumun bu bilgisayarda hatırlanır.`, category: "Eğlence", icon, tile, url, window: true, features: ["Uygulama içinde çalışır", "Oturum hatırlanır", "Uygulama değiştiricide görünür"], version: "web", size: "—" };
}

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
  return [...APP_LIST, WEB_APP, ...LINK_LIST, ...remote];
}

export const DEFAULT_LAYOUT: HomeLayout = {
  grid: ["home", "tasks", "calendar", "tickets", "mail", "chat", "folder-admin", "games", "store", "settings"],
  dock: ["home", "tasks", "tickets", "mail", "chat"],
};

const ROLE_LEVEL: Record<string, number> = { DEVELOPER: 40, SUPPORT: 50, MODERATOR: 60, ADMIN: 90, OWNER: 100 };

export function itemById(id: string): HomeItem | null {
  return catalog().find((item) => item.id === id) ?? FOLDERS.find((folder) => folder.id === id) ?? null;
}

const WEB_APP: AppDef = {
  kind: "app", id: "web", title: "Tarayıcı", subtitle: "Sekmeli web tarayıcısı", category: "Sistem", icon: Globe, tile: "linear-gradient(160deg,#9fd0ff 0%,#4b93f2 52%,#2457c8 100%)", system: true, version: "1.0", size: "—",
  description: "Sekmeli, adres çubuklu tarayıcı. Sorvia sayfaları ve diğer siteler uygulamanın içinde açılır.", features: ["Sekmeler (Ctrl+T / Ctrl+W)", "Adres ve arama çubuğu", "Oturumlar hatırlanır"],
};

export function appById(id: ModuleId): AppDef {
  if (id.startsWith("app-")) {
    const link = LINK_LIST.find((item) => item.id === id);
    if (link) return { ...link, kind: "app", id } as AppDef;
  }
  return APP_LIST.find((item) => item.id === id) ?? WEB_APP;
}

export function available(item: AppDef | LinkDef, user: DesktopUser) {
  if (item.kind === "app" && item.id !== "store" && item.id !== "settings" && item.id !== "web" && !user.modules.includes(item.id)) return false;
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
  const ids = new Set([...(installed ?? []), ...all.filter((item) => item.system).map((item) => item.id)]);
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
    return Boolean(item && id !== "folder-links" && visible(item, user, installed) && !(item.kind !== "folder" && item.folder));
  };
  const unique = (ids: string[]) => ids.filter((id, index) => ids.indexOf(id) === index);
  const grid = unique(saved?.grid?.length ? saved.grid : DEFAULT_LAYOUT.grid).filter(fits);
  const dock = unique(saved?.dock?.length ? saved.dock : DEFAULT_LAYOUT.dock).filter((id) => fits(id) && itemById(id)?.kind === "app").slice(0, 7);
  const placed = new Set(grid);
  const missing = [...catalog().filter((item) => !item.folder).map((item) => item.id), ...FOLDERS.map((folder) => folder.id)].filter((id) => !placed.has(id) && fits(id));
  return { grid: [...grid, ...missing], dock };
}

export function itemBadge(item: HomeItem, badges: Partial<Record<string, number>>, user: DesktopUser, installed: Set<string>): number {
  if (item.kind === "app" || (item.kind === "link" && item.window)) return badges[item.id] ?? 0;
  if (item.kind === "folder") return folderItems(item, user, installed).reduce((sum, child) => sum + itemBadge(child, badges, user, installed), 0);
  return 0;
}

export function launchLink(item: LinkDef, open: (url: string) => void, openApp?: (id: ModuleId) => void) {
  if (item.window && openApp) openApp(item.id as ModuleId);
  else if (item.window) void bridge.system.openAppWindow(item.url, item.id).then((done) => done || open(item.url));
  else open(item.url);
}
