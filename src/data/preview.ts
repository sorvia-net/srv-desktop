import type {
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
  permissions: ["dashboard.view", "tickets.view", "tickets.reply", "chat.use", "meetings.view", "content.view"],
  modules: ["home", "tasks", "calendar", "tickets", "mail", "chat", "settings"],
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
};
