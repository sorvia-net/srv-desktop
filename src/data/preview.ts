import type {
  AdminOrderDetail, AdminOrderPage, AdminOrderRow, AdminUserDetail, AdminUserPage, AdminUserRow, StatusBoard,
  DriveFile, DriveFolder, DriveView, MediaItem, MediaPage, StorageOverview, StoreCatalog,
  AppNotification, CalendarEvent, ChatChannel, ChatMessage, DesktopUser, HomeSummary, MailFolder, MailMessage, MailSummary, Person, Task, TicketDetail, TicketSummary,
} from "@shared/contracts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function at(dayOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function ago(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

const people: Record<string, Person> = {
  me: { id: "p-me", name: "Deniz Arslan", avatarUrl: null },
  ece: { id: "p-ece", name: "Ece Yıldız", avatarUrl: null },
  mert: { id: "p-mert", name: "Mert Kaya", avatarUrl: null },
  selin: { id: "p-selin", name: "Selin Demir", avatarUrl: null },
  baris: { id: "p-baris", name: "Barış Aydın", avatarUrl: null },
};

export const previewUser: DesktopUser = {
  id: people.me!.id,
  name: people.me!.name,
  email: "deniz@ornek.sorvia.net",
  username: "deniz",
  avatarUrl: null,
  role: "SUPPORT",
  roleLabel: "Destek",
  title: "Müşteri Destek Uzmanı",
  permissions: ["dashboard.view", "tickets.view", "tickets.reply", "chat.use", "meetings.view", "content.view", "media.view", "media.upload", "media.delete", "users.view", "orders.view"],
  modules: ["home", "tasks", "calendar", "tickets", "mail", "chat", "gallery", "storage", "settings", "users", "orders", "status"],
  timeZone: "Europe/Istanbul",
  memberSince: at(-410, 9),
};

let tasks: Task[] = [
  task("t1", "Lisans yenileme e-postasının metnini güncelle", "doing", "HIGH", "Destek", at(0, 17), ["e-posta"]),
  task("t2", "srv-uber kurulum rehberine Qbox adımlarını ekle", "todo", "NORMAL", "Dokümanlar", at(1, 12), ["doküman"]),
  task("t3", "Ödeme bildirimi ekranındaki boş durum metnini düzelt", "review", "LOW", "Web", at(0, 15, 30), ["arayüz"]),
  task("t4", "BuiltByBit eşitleme hatası için müşteriye dönüş", "todo", "URGENT", "Destek", at(-1, 18), ["müşteri"]),
  task("t5", "Discord destek kanalı karşılama mesajı", "done", "NORMAL", "Destek", at(-2, 11), ["discord"]),
  task("t6", "Eklenti sayfası ekran görüntülerini yenile", "todo", "NORMAL", "Eklentiler", at(3, 10), ["tasarım"]),
  task("t7", "Hafta sonu nöbet devri notları", "doing", "NORMAL", "Destek", at(2, 18), []),
  task("t8", "SSS: alan adı transferi sorularını gözden geçir", "done", "LOW", "Web", at(-4, 16), ["sss"]),
];

function task(id: string, title: string, status: Task["status"], priority: Task["priority"], board: string, dueAt: string, labels: string[]): Task {
  return {
    id,
    title,
    description: "Önizleme görevi. Gerçek görevler bağlandıktan sonra Sorvia.net'ten gelir.",
    status,
    priority,
    board,
    labels,
    dueAt,
    completedAt: status === "done" ? ago(2 * DAY) : null,
    assignee: people.me!,
    creator: people.ece!,
    createdAt: ago(6 * DAY),
    updatedAt: ago(3 * HOUR),
  };
}

const tickets: TicketDetail[] = [
  ticket("k1", "T-1042", "Lisans anahtarı sunucuda doğrulanmıyor", "OPEN", "HIGH", "Kuzey Yazılım", 25 * 60_000, "Merhaba, dün aldığımız eklentinin lisansı sunucuyu yeniden başlatınca doğrulanmıyor."),
  ticket("k2", "T-1041", "srv-uber kurulumunda veritabanı hatası", "PENDING_STAFF", "NORMAL", "Ada Oyun Stüdyosu", 2 * HOUR, "oxmysql bağlantısı kuruluyor ama tablolar oluşmuyor, hata çıktısını ekliyorum."),
  ticket("k3", "T-1039", "Fatura bilgilerimi güncellemek istiyorum", "PENDING_CUSTOMER", "LOW", "Mavi Medya", 9 * HOUR, "Vergi numaramız değişti, kesilecek faturalarda yenisi yazsın lütfen."),
  ticket("k4", "T-1036", "Alan adı transfer kodu", "ON_HOLD", "NORMAL", "Ege Teknoloji", 30 * HOUR, "Transfer kodu e-postama gelmedi, tekrar gönderebilir misiniz?"),
  ticket("k5", "T-1033", "Eklenti güncellemesi sonrası menü açılmıyor", "RESOLVED", "HIGH", "Pixel Krallığı", 3 * DAY, "Teşekkürler, son sürümle düzeldi."),
];

function ticket(id: string, number: string, subject: string, status: TicketDetail["status"], priority: TicketDetail["priority"], requester: string, age: number, body: string): TicketDetail {
  return {
    id,
    number,
    subject,
    status,
    priority,
    requester,
    department: "Teknik destek",
    assignee: people.me!,
    source: "web",
    lastMessageAt: ago(age),
    createdAt: ago(age + 2 * HOUR),
    preview: body,
    email: null,
    productRef: null,
    tags: [],
    messages: [
      { id: `${id}-m1`, body, author: requester, avatarUrl: null, isStaff: false, isInternal: false, isAi: false, createdAt: ago(age + 2 * HOUR) },
      { id: `${id}-m2`, body: "Talebinizi aldık; ekibimiz inceliyor. Kısa süre içinde dönüş yapacağız.", author: "Sorvia Asistan", avatarUrl: null, isStaff: true, isInternal: false, isAi: true, createdAt: ago(age + 110 * 60_000) },
    ],
  };
}

const notifications: AppNotification[] = [
  note("n1", "ticket.assigned", "Yeni talep sana atandı", "T-1042 · Lisans anahtarı sunucuda doğrulanmıyor", 25 * 60_000, false),
  note("n2", "task.due", "Görevin bugün bitiyor", "Lisans yenileme e-postasının metnini güncelle", 70 * 60_000, false),
  note("n3", "meeting.accepted", "Görüşme onaylandı", "Kuzey Yazılım · bugün 14:30", 3 * HOUR, false),
  note("n4", "chat.mention", "Ece seni andı", "#destek kanalında: \"Deniz, T-1041'e bakabilir misin?\"", 5 * HOUR, true),
  note("n5", "ticket.reply", "Müşteri yanıt verdi", "T-1039 · Fatura bilgilerimi güncellemek istiyorum", 9 * HOUR, true),
  note("n6", "system", "Sorvia Desktop'a hoş geldin", "Bağlanınca gerçek bildirimlerin burada görünür.", 2 * DAY, true),
];

function note(id: string, type: string, title: string, body: string, age: number, read: boolean): AppNotification {
  return { id, type, title, body, href: null, icon: null, readAt: read ? ago(age - 60_000) : null, createdAt: ago(age) };
}

const events: CalendarEvent[] = [
  { id: "e1", kind: "meeting", title: "Kuzey Yazılım ile kurulum görüşmesi", startsAt: at(0, 14, 30), endsAt: at(0, 15, 15), allDay: false, status: "ACCEPTED", detail: "Google Meet", href: null },
  { id: "e2", kind: "task", title: "Lisans yenileme e-postası teslim", startsAt: at(0, 17), endsAt: null, allDay: false, status: "doing", detail: "Destek", href: null },
  { id: "e3", kind: "meeting", title: "Haftalık destek değerlendirmesi", startsAt: at(1, 10), endsAt: at(1, 10, 45), allDay: false, status: "ACCEPTED", detail: "Ekip", href: null },
  { id: "e4", kind: "reminder", title: "Nöbet devri", startsAt: at(2, 18), endsAt: null, allDay: false, status: null, detail: null, href: null },
  { id: "e5", kind: "meeting", title: "Ada Oyun Stüdyosu demo", startsAt: at(4, 16), endsAt: at(4, 16, 40), allDay: false, status: "PENDING", detail: "Discord", href: null },
  { id: "e6", kind: "task", title: "Eklenti ekran görüntüleri", startsAt: at(3, 10), endsAt: null, allDay: false, status: "todo", detail: "Eklentiler", href: null },
  { id: "e7", kind: "meeting", title: "Ege Teknoloji transfer görüşmesi", startsAt: at(-2, 11), endsAt: at(-2, 11, 30), allDay: false, status: "COMPLETED", detail: null, href: null },
];

const channels: ChatChannel[] = [
  { id: "c1", slug: "genel", name: "genel", topic: "Herkesin gördüğü duyurular", isPrivate: false, unread: 2, lastMessageAt: ago(40 * 60_000) },
  { id: "c2", slug: "destek", name: "destek", topic: "Destek talepleri ve devirler", isPrivate: false, unread: 1, lastMessageAt: ago(5 * HOUR) },
  { id: "c3", slug: "gelistirme", name: "gelistirme", topic: "Sürümler ve hata kayıtları", isPrivate: false, unread: 0, lastMessageAt: ago(DAY) },
];

let messages: ChatMessage[] = [
  { id: "m1", channelId: "c1", body: "Bu akşam 23:00'te kısa bir bakım var, site 5 dakika kapalı kalabilir.", author: people.baris!, createdAt: ago(3 * HOUR), edited: false, pinned: true },
  { id: "m2", channelId: "c1", body: "Yeni ürün sayfaları yayında, göz atmayı unutmayın 🎉", author: people.selin!, createdAt: ago(40 * 60_000), edited: false, pinned: false },
  { id: "m3", channelId: "c2", body: "Deniz, T-1041'e bakabilir misin? Veritabanı tarafı gibi duruyor.", author: people.ece!, createdAt: ago(5 * HOUR), edited: false, pinned: false },
  { id: "m4", channelId: "c2", body: "Bakıyorum, oxmysql sürümü eski olabilir.", author: people.me!, createdAt: ago(4.8 * HOUR), edited: false, pinned: false },
  { id: "m5", channelId: "c3", body: "v2.0.5 canlıda; yükleme sınırı düzeltildi.", author: people.mert!, createdAt: ago(DAY), edited: false, pinned: false },
];

const mailFolders: MailFolder[] = [
  { id: "INBOX", path: "INBOX", name: "Gelen kutusu", role: "INBOX", unread: 3, total: 9 },
  { id: "Sent", path: "Sent", name: "Gönderilenler", role: "Sent", unread: 0, total: 4 },
  { id: "Drafts", path: "Drafts", name: "Taslaklar", role: "Drafts", unread: 0, total: 1 },
  { id: "Archive", path: "Archive", name: "Arşiv", role: "Archive", unread: 0, total: 12 },
  { id: "Trash", path: "Trash", name: "Çöp", role: "Trash", unread: 0, total: 2 },
];

const mails: MailMessage[] = [
  mail(9, "Kuzey Yazılım", "destek@kuzey.example", "Lisans doğrulama hatası hakkında", "Merhaba, talebimizle ilgili ek bir log dosyası paylaşmak istiyoruz. Sunucu yeniden başladıktan sonra…", 22 * 60_000, false, true),
  mail(8, "Ece Yıldız", "ece@ornek.sorvia.net", "Haftalık destek raporu", "Bu haftanın raporunu ekte bulabilirsin; ortalama ilk yanıt süresi 18 dakikaya indi.", 2 * HOUR, false, false),
  mail(7, "Sorvia.net", "bildirim@sorvia.net", "Yeni görüşme talebi: Ada Oyun Stüdyosu", "Ada Oyun Stüdyosu perşembe 16:00 için demo görüşmesi talep etti. Onaylamak için yönetim paneline gidin.", 6 * HOUR, false, false),
  mail(6, "Mavi Medya", "muhasebe@mavimedya.example", "Vergi numarası değişikliği", "Yeni vergi numaramızı ekte iletiyoruz, bundan sonraki faturalarda kullanılmasını rica ederiz.", 9 * HOUR, true, false),
  mail(5, "Barış Aydın", "baris@ornek.sorvia.net", "Bakım duyurusu taslağı", "Duyuru metnini kısalttım, uygunsa bu akşam yayımlayalım.", DAY + 3 * HOUR, true, false),
  mail(4, "BuiltByBit", "no-reply@builtbybit.example", "Yeni satış: srv-pawnshop", "Tebrikler! srv-pawnshop için yeni bir satış gerçekleşti.", 2 * DAY, true, false),
];

function mail(uid: number, name: string, address: string, subject: string, text: string, age: number, seen: boolean, attachments: boolean): MailMessage {
  return {
    uid,
    folder: "INBOX",
    from: { name, address },
    to: [{ name: previewUser.name, address: previewUser.email }],
    cc: [],
    subject,
    preview: text,
    date: ago(age),
    seen,
    flagged: false,
    hasAttachments: attachments,
    html: null,
    text: `${text}\n\nSaygılarımızla,\n${name}`,
    remoteImages: false,
    attachments: attachments ? [{ id: "a1", filename: "sunucu-log.txt", contentType: "text/plain", size: 18_420 }] : [],
    messageId: `<${uid}@onizleme>`,
  };
}

function summaryOf(item: TicketDetail): TicketSummary {
  const { messages: _messages, email: _email, productRef: _productRef, tags: _tags, ...rest } = item;
  return rest;
}


const PALETTES = [
  ["#ff9a3d", "#ff5e3a", "#ffd166"],
  ["#4facfe", "#00f2fe", "#a18cd1"],
  ["#43e97b", "#38f9d7", "#2c7a7b"],
  ["#fa709a", "#fee140", "#ff8a65"],
  ["#a18cd1", "#fbc2eb", "#6a5acd"],
  ["#f6d365", "#fda085", "#e76f51"],
  ["#30cfd0", "#330867", "#5ee7df"],
  ["#ff6a88", "#ff99ac", "#c2185b"],
  ["#89f7fe", "#66a6ff", "#1e3a8a"],
];

function art(index: number, label: string) {
  const [a, b, c] = PALETTES[index % PALETTES.length]!;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480' viewBox='0 0 640 480'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='640' height='480' fill='url(#g)'/><circle cx='${120 + (index * 53) % 400}' cy='${140 + (index * 37) % 200}' r='${90 + (index * 13) % 60}' fill='${c}' opacity='0.55'/><circle cx='${460 - (index * 29) % 300}' cy='${330 - (index * 17) % 160}' r='${60 + (index * 11) % 50}' fill='white' opacity='0.22'/><text x='32' y='446' font-family='Segoe UI, sans-serif' font-size='30' font-weight='600' fill='white' opacity='0.9'>${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const MEDIA_NAMES = [
  ["urun-kapagi-uber.png", "/urunler"], ["blog-kapak-ekim.png", "/blog"], ["discord-bot-tanitim.png", "/urunler"], ["fivem-paket.png", "/urunler"], ["kampanya-cuma.png", "/kampanya"], ["ekip-fotografi.png", "/"],
  ["logo-koyu.png", "/marka"], ["logo-acik.png", "/marka"], ["mc-eklenti-ekran-1.png", "/urunler"], ["mc-eklenti-ekran-2.png", "/urunler"], ["referans-kuzey.png", "/referanslar"], ["blog-kapak-guvenlik.png", "/blog"],
  ["hizmet-web.png", "/hizmetler"], ["hizmet-bot.png", "/hizmetler"], ["sss-gorsel.png", "/"], ["partner-ada.png", "/partnerler"], ["store-sweatshirt.png", "/magaza"], ["kampanya-yilbasi.png", "/kampanya"],
] as const;

let media: MediaItem[] = MEDIA_NAMES.map(([name, folder], index) => ({
  id: `m${index + 1}`,
  kind: "IMAGE",
  url: art(index, name.replace(/\.png$/, "").replace(/-/g, " ")),
  path: `/media/2026/10/${name}`,
  fileName: name,
  alt: index % 3 === 0 ? null : `${name.replace(/\.png$/, "").replace(/-/g, " ")} görseli`,
  width: 1600,
  height: 1200,
  sizeBytes: 180_000 + index * 41_337,
  mimeType: "image/png",
  folder,
  createdAt: ago(index * 9 * HOUR),
  uploader: index % 2 ? people.ece! : people.mert!,
  usedIn: index % 4 === 0 ? ["Ürün kapağı"] : index % 5 === 0 ? ["Blog kapağı"] : [],
}));

const driveFolders: DriveFolder[] = [
  { id: "f-sozlesme", name: "Sözleşmeler", parentId: null, color: "blue", starred: true, createdAt: ago(40 * DAY), updatedAt: ago(2 * DAY), files: 3, bytes: 3_400_000 },
  { id: "f-finans", name: "Finans", parentId: null, color: "green", starred: false, createdAt: ago(60 * DAY), updatedAt: ago(DAY), files: 2, bytes: 1_900_000 },
  { id: "f-marka", name: "Marka", parentId: null, color: "orange", starred: false, createdAt: ago(80 * DAY), updatedAt: ago(9 * DAY), files: 2, bytes: 12_400_000 },
  { id: "f-yedek", name: "Yedekler", parentId: null, color: "slate", starred: false, createdAt: ago(20 * DAY), updatedAt: ago(3 * HOUR), files: 1, bytes: 412_000_000 },
];

function driveFile(id: string, name: string, folderId: string | null, size: number, mimeType: string, days: number, starred = false): DriveFile {
  return { id, name, folderId, size, mimeType, currentVersion: 1, versions: 1, starred, tags: [], hasNote: false, shares: 0, downloads: 2, createdAt: ago(days * DAY), updatedAt: ago(days * DAY), uploadedBy: previewUserName() };
}

function previewUserName() {
  return "Deniz Arslan";
}

let driveFiles: DriveFile[] = [
  driveFile("d1", "Hizmet sözleşmesi - Kuzey Yazılım.pdf", "f-sozlesme", 1_240_000, "application/pdf", 3, true),
  driveFile("d2", "Gizlilik sözleşmesi şablonu.docx", "f-sozlesme", 860_000, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 12),
  driveFile("d3", "Ortaklık protokolü.pdf", "f-sozlesme", 1_300_000, "application/pdf", 30),
  driveFile("d4", "Ekim gelir gider.xlsx", "f-finans", 640_000, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 1),
  driveFile("d5", "Vergi beyannamesi Q3.pdf", "f-finans", 1_260_000, "application/pdf", 18),
  driveFile("d6", "Sorvia logo paketi.zip", "f-marka", 11_800_000, "application/zip", 9),
  driveFile("d7", "Marka renkleri.png", "f-marka", 600_000, "image/png", 9),
  driveFile("d8", "veritabani-2026-10-28.dump", "f-yedek", 412_000_000, "application/octet-stream", 0),
  driveFile("d9", "Şirket bilgileri.txt", null, 4_200, "text/plain", 2, true),
];

let trashed: DriveFile[] = [driveFile("d10", "Eski teklif.pdf", null, 320_000, "application/pdf", 6)];


const CUSTOMER_NAMES = ["Ada Oyun Stüdyosu", "Kuzey Yazılım", "Mavi Medya", "Barış Aydın", "Ece Yıldız", "Mert Kaya", "Selin Acar", "Onur Demir", "Zeynep Şahin", "Can Yurt", "Elif Koç", "Deniz Arı"];
const ROLE_NAMES: Record<string, string> = { CUSTOMER: "Müşteri", SUPPORT: "Destek", DEVELOPER: "Geliştirici", MODERATOR: "Moderatör", ADMIN: "Yönetici", OWNER: "Kurucu" };
const previewUsers: AdminUserRow[] = CUSTOMER_NAMES.map((name, index) => {
  const role = (index === 3 ? "SUPPORT" : index === 5 ? "DEVELOPER" : index === 7 ? "MODERATOR" : "CUSTOMER") as AdminUserRow["role"];
  return {
    id: `u${index + 1}`,
    name,
    email: `${name.toLocaleLowerCase("tr").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@ornek.com`,
    avatarUrl: null,
    role,
    roleLabel: ROLE_NAMES[role]!,
    status: index === 10 ? "SUSPENDED" : "ACTIVE",
    createdAt: at(-30 * (index + 1), 10),
    lastLoginAt: at(-index, 9 + (index % 8)),
    orders: (index * 3) % 7,
  };
});

const ORDER_STATUS = ["PAID", "FULFILLED", "AWAITING_PAYMENT", "PENDING", "REFUNDED", "CANCELLED", "FULFILLED", "FULFILLED"];
const previewOrders: AdminOrderRow[] = Array.from({ length: 18 }, (_, index) => ({
  id: `o${index + 1}`,
  number: `SRV-2026-${String(1840 - index).padStart(5, "0")}`,
  email: previewUsers[index % previewUsers.length]!.email,
  customer: previewUsers[index % previewUsers.length]!.name,
  avatarUrl: null,
  status: ORDER_STATUS[index % ORDER_STATUS.length]!,
  total: [24.99, 49.9, 119, 9.99, 299, 39.5][index % 6]!,
  currency: index % 3 === 0 ? "TRY" : "EUR",
  provider: ["paytr", "stripe", "bank", "tebex"][index % 4]!,
  items: 1 + (index % 3),
  createdAt: at(-index, 8 + (index % 10)),
  paidAt: ["PAID", "FULFILLED", "REFUNDED"].includes(ORDER_STATUS[index % ORDER_STATUS.length]!) ? at(-index, 9 + (index % 10)) : null,
}));

export const preview = {
  home(): HomeSummary {
    const open = tasks.filter((item) => item.status !== "done");
    const today = new Date().toDateString();
    return {
      greetingName: previewUser.name.split(" ")[0]!,
      counts: {
        openTasks: open.length,
        overdueTasks: open.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < Date.now()).length,
        dueToday: open.filter((item) => item.dueAt && new Date(item.dueAt).toDateString() === today).length,
        myTickets: tickets.filter((item) => !["RESOLVED", "CLOSED", "ARCHIVED"].includes(item.status)).length,
        waitingTickets: tickets.filter((item) => item.status === "OPEN" || item.status === "PENDING_STAFF").length,
        unreadNotifications: notifications.filter((item) => !item.readAt).length,
        meetingsToday: events.filter((item) => item.kind === "meeting" && new Date(item.startsAt).toDateString() === today).length,
      },
      tasks: open.slice(0, 5),
      tickets: tickets.filter((item) => !["RESOLVED", "CLOSED", "ARCHIVED"].includes(item.status)).map(summaryOf),
      agenda: events.filter((item) => new Date(item.startsAt).getTime() > Date.now() - 6 * HOUR).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 5),
      notifications: notifications.slice(0, 4),
      boards: ["Destek", "Web", "Eklentiler"].map((board) => ({ board, total: tasks.filter((item) => item.board === board).length, done: tasks.filter((item) => item.board === board && item.status === "done").length })),
      activity: [
        { week: "Ağu 25", tasksDone: 6, replies: 22 },
        { week: "Eyl 1", tasksDone: 9, replies: 31 },
        { week: "Eyl 8", tasksDone: 7, replies: 26 },
        { week: "Eyl 15", tasksDone: 12, replies: 38 },
        { week: "Eyl 22", tasksDone: 10, replies: 33 },
        { week: "Eyl 29", tasksDone: 14, replies: 41 },
      ],
      support: { answered: 18, total: 21, averageFirstReplyMinutes: 18 },
      generatedAt: new Date().toISOString(),
    };
  },
  tasks: () => tasks,
  updateTask(id: string, patch: Partial<Task>) {
    tasks = tasks.map((item) => (item.id === id ? { ...item, ...patch, completedAt: patch.status === "done" ? new Date().toISOString() : item.completedAt, updatedAt: new Date().toISOString() } : item));
    return tasks.find((item) => item.id === id)!;
  },
  createTask(input: { title: string; board: string; priority: Task["priority"]; dueAt: string | null }) {
    const created: Task = { ...task(`t${Date.now()}`, input.title, "todo", input.priority, input.board, input.dueAt ?? at(1, 17), []), dueAt: input.dueAt, description: null, createdAt: new Date().toISOString() };
    tasks = [created, ...tasks];
    return created;
  },
  tickets: () => tickets.map(summaryOf),
  ticket: (id: string) => tickets.find((item) => item.id === id) ?? null,
  reply(id: string, body: string, internal: boolean) {
    const item = tickets.find((entry) => entry.id === id);
    if (!item) return null;
    item.messages.push({ id: `${id}-${Date.now()}`, body, author: previewUser.name, avatarUrl: null, isStaff: true, isInternal: internal, isAi: false, createdAt: new Date().toISOString() });
    if (!internal) item.status = "PENDING_CUSTOMER";
    item.lastMessageAt = new Date().toISOString();
    return item;
  },
  calendar: () => events,
  notifications: () => notifications,
  readNotifications(ids: string[] | "all") {
    for (const item of notifications) if (ids === "all" || ids.includes(item.id)) item.readAt = item.readAt ?? new Date().toISOString();
    return true as const;
  },
  channels: () => channels,
  messages: (channelId: string) => messages.filter((item) => item.channelId === channelId),
  post(channelId: string, body: string) {
    const created: ChatMessage = { id: `m${Date.now()}`, channelId, body, author: people.me!, createdAt: new Date().toISOString(), edited: false, pinned: false };
    messages = [...messages, created];
    const channel = channels.find((item) => item.id === channelId);
    if (channel) channel.lastMessageAt = created.createdAt;
    return created;
  },
  mailFolders: () => mailFolders,
  mailList: (folder: string): { total: number; messages: MailSummary[] } => {
    const list = folder === "INBOX" ? mails : [];
    return { total: list.length, messages: list.map(({ cc: _cc, html: _html, text: _text, remoteImages: _remote, attachments: _attachments, messageId: _id, ...rest }) => rest) };
  },
  mailRead: (uid: number) => {
    const item = mails.find((entry) => entry.uid === uid) ?? null;
    if (item) item.seen = true;
    return item;
  },
  store(): StoreCatalog {
    return {
      featured: "mail",
      notice: null,
      modules: [
        { id: "web-wiki", kind: "web", title: "Ekip Wiki", subtitle: "İç bilgi bankası", description: "Süreçler, nöbet notları ve ekip rehberleri tek yerde.", category: "Verimlilik", icon: "BookOpen", tile: "linear-gradient(160deg,#fcd34d 0%,#f97316 100%)", url: "https://sorvia.net/admin/dokumanlar", folder: "folder-links", permission: null, role: null, features: ["Arama", "Kategoriler"], version: "web" },
        { id: "web-reports", kind: "web", title: "Raporlar", subtitle: "Satış ve destek raporları", description: "Haftalık satış, destek ve trafik raporları.", category: "Yönetim", icon: "ChartColumn", tile: "linear-gradient(160deg,#a5f3fc 0%,#0891b2 100%)", url: "https://sorvia.net/admin/analitik", folder: "folder-admin", permission: null, role: "ADMIN", features: ["Grafikler"], version: "web" },
      ],
    };
  },
  media(params: { q?: string; folder?: string; cursor?: string }): MediaPage {
    const q = (params.q ?? "").toLocaleLowerCase("tr");
    const items = media.filter((item) => (!params.folder || item.folder === params.folder) && (!q || item.fileName.toLocaleLowerCase("tr").includes(q) || (item.alt ?? "").toLocaleLowerCase("tr").includes(q)));
    const folders = [...new Set(media.map((item) => item.folder))].sort().map((folder) => ({ folder, count: media.filter((item) => item.folder === folder).length }));
    return { items, nextCursor: null, total: items.length, library: { count: media.length, bytes: media.reduce((sum, item) => sum + item.sizeBytes, 0) }, folders, canUpload: true, canDelete: true };
  },
  updateMedia(id: string, patch: Partial<Pick<MediaItem, "alt" | "folder" | "fileName">>) {
    media = media.map((item) => (item.id === id ? { ...item, ...patch } : item));
    return media.find((item) => item.id === id) ?? null;
  },
  removeMedia(id: string) {
    media = media.filter((item) => item.id !== id);
    return { deleted: true, places: [] };
  },
  storage(): StorageOverview {
    return {
      categories: [
        { id: "drive", label: "Kurucu deposu", bytes: driveFiles.reduce((sum, item) => sum + item.size, 0), count: driveFiles.length, color: "#bf5af2" },
        { id: "releases", label: "Ürün dosyaları", bytes: 2_840_000_000, count: 64, color: "#ff9f0a" },
        { id: "database", label: "Veritabanı", bytes: 412_000_000, count: null, color: "#ffd60a" },
        { id: "media", label: "Galeri", bytes: media.reduce((sum, item) => sum + item.sizeBytes, 0), count: media.length, color: "#5ac8fa" },
        { id: "desktop", label: "Masaüstü kurulumları", bytes: 122_000_000, count: 1, color: "#30d158" },
        { id: "bugs", label: "Hata ekleri", bytes: 38_000_000, count: 41, color: "#ff453a" },
        { id: "tmp", label: "Geçici dosyalar", bytes: 6_200_000, count: 3, color: "#8e8e93" },
      ],
      disk: { total: 98 * 1024 ** 3, free: 82 * 1024 ** 3 },
      scope: "server",
      generatedAt: new Date().toISOString(),
    };
  },
  drive(params: { folder?: string; mode?: string; q?: string }): DriveView {
    const q = (params.q ?? "").trim().toLocaleLowerCase("tr");
    const mode = q ? "search" : params.mode === "starred" || params.mode === "recent" || params.mode === "trash" ? params.mode : "folder";
    const folderId = mode === "folder" && params.folder && driveFolders.some((item) => item.id === params.folder) ? params.folder : null;
    const path = folderId ? [{ id: folderId, name: driveFolders.find((item) => item.id === folderId)!.name }] : [];
    const files =
      mode === "search" ? driveFiles.filter((item) => item.name.toLocaleLowerCase("tr").includes(q))
      : mode === "starred" ? driveFiles.filter((item) => item.starred)
      : mode === "recent" ? [...driveFiles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12)
      : mode === "trash" ? []
      : driveFiles.filter((item) => item.folderId === folderId);
    const folders = mode === "folder" ? driveFolders.filter((item) => item.parentId === folderId) : mode === "starred" ? driveFolders.filter((item) => item.starred) : [];
    const used = driveFiles.reduce((sum, item) => sum + item.size, 0);
    return {
      mode,
      folderId,
      q,
      path,
      folders,
      tree: driveFolders.map((item) => ({ id: item.id, name: item.name, parentId: item.parentId })),
      files,
      trash: mode === "trash" ? trashed.map((item) => ({ type: "file" as const, id: item.id, name: item.name, trashedAt: ago(2 * DAY), size: item.size, files: 1, origin: "Depo", purgeAt: at(28, 12) })) : [],
      stats: { used, quota: 50 * 1024 ** 3, files: driveFiles.length, folders: driveFolders.length, trashBytes: trashed.reduce((sum, item) => sum + item.size, 0), shares: 1, diskFree: 82 * 1024 ** 3, diskTotal: 98 * 1024 ** 3 },
      settings: { quotaGb: 50, maxFileGb: 5, trashDays: 30, keepVersions: 20 },
    };
  },
  createFolder(parentId: string | null, name: string) {
    const id = `f-${Date.now()}`;
    driveFolders.push({ id, name, parentId, color: null, starred: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), files: 0, bytes: 0 });
    return { id };
  },
  driveAction(body: { action: string; fileIds?: string[]; folderIds?: string[]; targetId?: string | null; id?: string; name?: string; kind?: string }) {
    const ids = new Set(body.fileIds ?? []);
    if (body.action === "rename" && body.id && body.name) {
      driveFiles = driveFiles.map((item) => (item.id === body.id ? { ...item, name: body.name! } : item));
      driveFolders.forEach((item) => {
        if (item.id === body.id) item.name = body.name!;
      });
    } else if (body.action === "star" || body.action === "unstar") {
      driveFiles = driveFiles.map((item) => (ids.has(item.id) ? { ...item, starred: body.action === "star" } : item));
    } else if (body.action === "move") {
      driveFiles = driveFiles.map((item) => (ids.has(item.id) ? { ...item, folderId: body.targetId ?? null } : item));
    } else if (body.action === "trash") {
      trashed = [...trashed, ...driveFiles.filter((item) => ids.has(item.id))];
      driveFiles = driveFiles.filter((item) => !ids.has(item.id));
    } else if (body.action === "restore") {
      driveFiles = [...driveFiles, ...trashed.filter((item) => ids.has(item.id))];
      trashed = trashed.filter((item) => !ids.has(item.id));
    } else if (body.action === "purge" || body.action === "empty-trash") {
      trashed = body.action === "empty-trash" ? [] : trashed.filter((item) => !ids.has(item.id));
    }
    return { message: null };
  },
  users(params: { q?: string; role?: string; status?: string }) {
    const q = (params.q ?? "").toLocaleLowerCase("tr");
    const items = previewUsers.filter((user) => (!q || `${user.name} ${user.email}`.toLocaleLowerCase("tr").includes(q)) && (!params.role || (params.role === "staff" ? user.role !== "CUSTOMER" : user.role === params.role)) && (!params.status || user.status === params.status));
    return { total: items.length, nextCursor: null, items, canEdit: false, canRoles: false } satisfies AdminUserPage;
  },
  user(id: string) {
    const user = previewUsers.find((item) => item.id === id);
    if (!user) return null;
    return {
      ...user,
      username: null,
      lastLoginIp: "88.230.12.4",
      loginCount: 42,
      emailVerified: true,
      twoFactorEnabled: false,
      discordUsername: null,
      locale: "tr",
      walletBalance: 12.5,
      orders: previewOrders.filter((order) => order.email === user.email).map((order) => ({ id: order.id, number: order.number, status: order.status, total: order.total, currency: order.currency, createdAt: order.createdAt })),
      licenses: [{ id: "l1", key: "••••4F2A", status: "ACTIVE", product: "SrvReward" }],
      counts: { orders: user.orders, licenses: 1, ticketsRequested: 2, sessions: 3 },
      canEdit: false,
      canRoles: false,
      roles: Object.entries(ROLE_NAMES).map(([value, label]) => ({ value, label })),
    } satisfies AdminUserDetail;
  },
  orders(params: { q?: string; status?: string }) {
    const q = (params.q ?? "").toLocaleLowerCase("tr");
    const items = previewOrders.filter((order) => (!q || `${order.number} ${order.email}`.toLocaleLowerCase("tr").includes(q)) && (!params.status || (params.status === "open" ? ["PENDING", "AWAITING_PAYMENT"].includes(order.status) : order.status === params.status)));
    return { total: items.length, nextCursor: null, items, summary: { awaiting: previewOrders.filter((order) => ["PENDING", "AWAITING_PAYMENT"].includes(order.status)).length, revenue: [{ currency: "EUR", total: 1849.6, count: 23 }, { currency: "TRY", total: 12450, count: 9 }] } } satisfies AdminOrderPage;
  },
  order(id: string) {
    const order = previewOrders.find((item) => item.id === id);
    if (!order) return null;
    return {
      id: order.id, number: order.number, email: order.email, status: order.status, subtotal: order.total, discount: 0, tax: 0, total: order.total, currency: order.currency, provider: order.provider, providerRef: "pi_3Q8x…", notes: null, country: "TR",
      createdAt: order.createdAt, paidAt: order.paidAt, refundedAt: null, coupon: null, invoice: { number: "SRV2026000184", status: "PAID" }, user: { id: "u1", name: order.customer, email: order.email, avatarUrl: null },
      items: [{ id: "i1", name: "SrvReward — Günlük Ödül", quantity: 1, unitPrice: order.total, total: order.total }],
      licenses: [{ id: "l1", key: "••••4F2A", status: "ACTIVE", product: "SrvReward" }],
      actions: { markPaid: false, cancel: false, refund: false },
    } satisfies AdminOrderDetail;
  },
  status() {
    const services = ["sorvia.net", "Lisans sunucusu", "Discord botu", "Ödeme altyapısı", "Command Center", "E-posta", "Yapay zekâ ağ geçidi"].map((name, index) => ({
      id: `s${index}`,
      name,
      description: null,
      group: index < 3 ? "Çekirdek" : "Altyapı",
      status: (index === 3 ? "WARNING" : "HEALTHY") as StatusBoard["services"][number]["status"],
      latencyMs: 40 + index * 23,
      checkedAt: new Date().toISOString(),
      uptime: { day: 100, week: index === 3 ? 99.2 : 99.98, window: 99.9 },
      days: Array.from({ length: 30 }, (_, day) => ({ date: at(day - 29, 0).slice(0, 10), total: 288, up: day === 20 && index === 3 ? 270 : 288, slow: day % 9 === 0 ? 4 : 0 })),
    }));
    return { generatedAt: new Date().toISOString(), windowDays: 30, stale: false, overall: { status: "DEGRADED", down: [], degraded: 1, total: services.length }, services, incidents: [{ id: "i1", title: "Ödeme sağlayıcısında yavaşlık", severity: "MINOR", status: "monitoring", serviceName: "Ödeme altyapısı", startedAt: at(0, 9), resolvedAt: null }] } satisfies StatusBoard;
  },
};
