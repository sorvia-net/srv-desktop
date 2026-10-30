import type { Accent, Density, IconSize, NotificationSound, ToastPosition, UiStyle, Wallpaper } from "./appearance";
export type Role = "DEVELOPER" | "SUPPORT" | "MODERATOR" | "ADMIN" | "OWNER";

export type ModuleId = "home" | "tasks" | "calendar" | "tickets" | "mail" | "chat" | "gallery" | "storage" | "store" | "settings" | "web" | "users" | "orders" | "status" | "products" | "admin" | "founder" | "games" | `app-${string}`;

export type Person = { id: string; name: string; avatarUrl: string | null };

export type DesktopUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  role: Role;
  roleLabel: string;
  title: string | null;
  permissions: string[];
  modules: ModuleId[];
  timeZone: string;
  memberSince: string;
  unlock?: { password: boolean; passkey: boolean; hello?: boolean };
};

export type TaskStatus = "todo" | "doing" | "review" | "done";
export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  board: string;
  labels: string[];
  dueAt: string | null;
  completedAt: string | null;
  assignee: Person | null;
  creator: Person | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketStatus = "OPEN" | "PENDING_STAFF" | "PENDING_CUSTOMER" | "ON_HOLD" | "RESOLVED" | "CLOSED" | "ARCHIVED";

export type TicketSummary = {
  id: string;
  number: string;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  requester: string;
  department: string | null;
  assignee: Person | null;
  source: string;
  lastMessageAt: string;
  createdAt: string;
  preview: string | null;
};

export type TicketMessage = {
  id: string;
  body: string;
  author: string;
  avatarUrl: string | null;
  isStaff: boolean;
  isInternal: boolean;
  isAi: boolean;
  createdAt: string;
};

export type TicketDetail = TicketSummary & { messages: TicketMessage[]; email: string | null; productRef: string | null; tags: string[] };

export type CalendarEvent = {
  id: string;
  kind: "meeting" | "task" | "reminder";
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  status: string | null;
  detail: string | null;
  href: string | null;
};

export type InstalledModule = { version: string; notes: string | null; installedAt: string };

export type ScreenInfo = { id: number; label: string; width: number; height: number; primary: boolean; main: boolean; open: boolean };

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  icon: string | null;
  readAt: string | null;
  createdAt: string;
};

export type VoicePeer = { id: string; userId: string; name: string; avatarUrl: string | null; muted: boolean; deafened: boolean; sharing: boolean; camera: boolean; joinedAt: string };
export type ChatChannel = { id: string; slug: string; name: string; topic: string | null; isPrivate: boolean; unread: number; lastMessageAt: string | null; avatarUrl?: string | null; userId?: string | null; kind?: "text" | "voice" | "dm"; limit?: number | null; minRole?: Role; peers?: VoicePeer[] };
export type VoiceJoin = { peerId: string; channel: { id: string; name: string }; peers: VoicePeer[]; iceServers: RTCIceServer[] };
export type VoiceSync = { peers: VoicePeer[]; signals: { from: string; kind: "offer" | "answer" | "candidate" | "bye" | "streams"; payload: unknown }[] };

export type AdminUserRow = { id: string; name: string; email: string; avatarUrl: string | null; role: Role | "CUSTOMER"; roleLabel: string; status: string; createdAt: string; lastLoginAt: string | null; orders: number };
export type AdminUserPage = { total: number; nextCursor: string | null; items: AdminUserRow[]; canEdit: boolean; canRoles: boolean };
export type AdminUserDetail = Omit<AdminUserRow, "orders"> & {
  username: string | null; lastLoginIp: string | null; loginCount: number; emailVerified: boolean; twoFactorEnabled: boolean; discordUsername: string | null; locale: string | null; walletBalance: number;
  orders: { id: string; number: string; status: string; total: number; currency: string; createdAt: string }[];
  licenses: { id: string; key: string; status: string; product: string }[];
  counts: { orders: number; licenses: number; ticketsRequested: number; sessions: number };
  canEdit: boolean; canRoles: boolean; roles: { value: string; label: string }[];
};
export type AdminOrderRow = { id: string; number: string; email: string; customer: string | null; avatarUrl: string | null; status: string; total: number; currency: string; provider: string | null; items: number; createdAt: string; paidAt: string | null };
export type AdminOrderPage = { total: number; nextCursor: string | null; items: AdminOrderRow[]; summary: { awaiting: number; revenue: { currency: string; total: number; count: number }[] } };
export type AdminOrderDetail = {
  id: string; number: string; email: string; status: string; subtotal: number; discount: number; tax: number; total: number; currency: string; provider: string | null; providerRef: string | null; notes: string | null; country: string | null;
  createdAt: string; paidAt: string | null; refundedAt: string | null; coupon: string | null; invoice: { number: string; status: string } | null; user: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
  items: { id: string; name: string; quantity: number; unitPrice: number; total: number }[]; licenses: { id: string; key: string; status: string; product: string }[];
  actions: { markPaid: boolean; cancel: boolean; refund: boolean };
};
export type StatusService = { id: string; name: string; description: string | null; group: string | null; status: "HEALTHY" | "WARNING" | "DEGRADED" | "DOWN" | "UNKNOWN"; latencyMs: number | null; checkedAt: string | null; uptime: { day: number | null; week: number | null; window: number | null }; days: { date: string; total: number; up: number; slow: number }[] };
export type StatusBoard = { generatedAt: string; windowDays: number; stale: boolean; overall: { status: string; down: string[]; degraded: number; total: number }; services: StatusService[]; incidents: { id: string; title: string; severity: string; status: string; serviceName: string | null; startedAt: string; resolvedAt: string | null }[] };
export type ChatAttachment = { url: string; name: string; mime: string; size: number; kind: "image" | "audio" | "video" | "file"; duration?: number | null };
export type ChatMessage = { id: string; channelId: string; body: string; author: Person | null; createdAt: string; edited: boolean; pinned: boolean; attachments?: ChatAttachment[]; reactions?: Record<string, string[]>; replyTo?: { id: string; body: string; author: Person | null } | null };

export type HomeSummary = {
  greetingName: string;
  counts: { openTasks: number; overdueTasks: number; dueToday: number; myTickets: number; waitingTickets: number; unreadNotifications: number; meetingsToday: number };
  tasks: Task[];
  tickets: TicketSummary[];
  agenda: CalendarEvent[];
  notifications: AppNotification[];
  boards: { board: string; total: number; done: number }[];
  activity: { week: string; tasksDone: number; replies: number }[];
  support: { answered: number; total: number; averageFirstReplyMinutes: number | null };
  generatedAt: string;
};

export type MailFolderId = "INBOX" | "Sent" | "Drafts" | "Archive" | "Trash" | "Junk";

export type MailFolder = { id: string; path: string; name: string; role: MailFolderId | null; unread: number; total: number };

export type MailSummary = {
  uid: number;
  folder: string;
  from: { name: string; address: string };
  to: { name: string; address: string }[];
  subject: string;
  preview: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
};

export type MailAttachment = { id: string; filename: string; contentType: string; size: number };

export type MailMessage = MailSummary & {
  cc: { name: string; address: string }[];
  html: string | null;
  text: string | null;
  remoteImages: boolean;
  attachments: MailAttachment[];
  messageId: string | null;
};

export type MailAccountInfo = { id: string; active: boolean; address: string; name: string; imapHost: string; smtpHost: string; connected: boolean; lastError: string | null };

export type MailDraft = { to: string; cc?: string; subject: string; text: string; inReplyTo?: string | null; references?: string | null };

export type AuthState =
  | { status: "signedOut"; server: string; error?: string | null }
  | { status: "linking"; server: string; userCode: string; verificationUrl: string; expiresAt: string }
  | { status: "signedIn"; server: string; user: DesktopUser; expiresAt: string }
  | { status: "preview"; server: string };

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; message: string };

export type UpdateInfo = { current: string; latest: string; url: string; notes: string | null; available: boolean };

export type DeviceStart = { deviceCode: string; userCode: string; verificationUrl: string; verificationUrlComplete: string; expiresIn: number; interval: number };

export type DeviceToken = { token: string; expiresAt: string; user: DesktopUser };

export type Preferences = {
  launchAtLogin: boolean;
  closeToTray: boolean;
  nativeNotifications: boolean;
  reduceMotion: "system" | "on" | "off";
  wallpaper: Wallpaper;
  showRemoteImages: boolean;
  pollSeconds: number;
  doNotDisturb: boolean;
  autoLockMinutes: number;
  homeLayout: HomeLayout | null;
  installed: string[] | null;
  accent: Accent;
  uiStyle: UiStyle;
  iconSize: IconSize;
  density: Density;
  shortcuts: Record<string, string>;
  toastPosition: ToastPosition;
  notificationSound: NotificationSound;
  faceAuto: boolean;
  widgets: string[] | null;
  extraScreens: boolean;
};

export type UpdateStatus = { state: "idle" | "checking" | "latest" | "downloading" | "ready" | "error" | "unavailable"; version: string | null; percent: number | null; message: string | null };

export type HomeLayout = { grid: string[]; dock: string[] };

export type StoreModule = {
  id: string;
  kind: "native" | "web";
  title: string;
  subtitle: string;
  description: string;
  category: string;
  icon: string;
  tile: string | null;
  url: string | null;
  folder: string | null;
  permission: string | null;
  role: "ADMIN" | "OWNER" | null;
  features: string[];
  version: string;
};

export type StoreCatalog = { featured: string | null; modules: StoreModule[]; notice: string | null };

export type MediaItem = {
  id: string;
  kind: string;
  url: string;
  path: string;
  fileName: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  mimeType: string | null;
  folder: string;
  createdAt: string;
  uploader: Person | null;
  usedIn: string[] | null;
};

export type MediaPage = {
  items: MediaItem[];
  nextCursor: string | null;
  total: number;
  library: { count: number; bytes: number };
  folders: { folder: string; count: number }[];
  canUpload: boolean;
  canDelete: boolean;
};

export type DriveFolder = { id: string; name: string; parentId: string | null; color: string | null; starred: boolean; createdAt: string; updatedAt: string; files: number; bytes: number };

export type DriveFile = {
  id: string;
  name: string;
  folderId: string | null;
  size: number;
  mimeType: string;
  currentVersion: number;
  versions: number;
  starred: boolean;
  tags: string[];
  hasNote: boolean;
  shares: number;
  downloads: number;
  createdAt: string;
  updatedAt: string;
  uploadedBy: string | null;
};

export type DriveTrashItem = { type: "file" | "folder"; id: string; name: string; trashedAt: string; size: number; files: number; origin: string; purgeAt: string };

export type DriveMode = "folder" | "search" | "starred" | "recent" | "shared" | "trash";

export type DriveView = {
  mode: DriveMode;
  folderId: string | null;
  q: string;
  path: { id: string; name: string }[];
  folders: DriveFolder[];
  tree: { id: string; name: string; parentId: string | null }[];
  files: DriveFile[];
  trash: DriveTrashItem[];
  stats: { used: number; quota: number; files: number; folders: number; trashBytes: number; shares: number; diskFree: number | null; diskTotal: number | null };
  settings: { quotaGb: number; maxFileGb: number; trashDays: number; keepVersions: number };
};

export type StorageCategory = { id: string; label: string; bytes: number; count: number | null; color: string };

export type StorageOverview = { categories: StorageCategory[]; disk: { free: number; total: number } | null; scope: "server" | "limited"; generatedAt: string };

export type TransferStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export type Transfer = {
  id: string;
  kind: "upload" | "download";
  target: "media" | "drive";
  name: string;
  size: number;
  done: number;
  status: TransferStatus;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  path: string | null;
  resultId: string | null;
};

export type LocalDownload = { id: string; name: string; path: string; size: number; source: "drive" | "media" | "mail"; savedAt: string; exists: boolean };

export type LocalUsage = { cache: number; downloads: number; downloadCount: number };

export type SorviaBridge = {
  platform: "win32" | "darwin" | "linux" | "web";
  version: string;
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    onMaximizeChange(listener: (maximized: boolean) => void): () => void;
    capture(): Promise<string | null>;
  };
  auth: {
    state(): Promise<AuthState>;
    start(server?: string): Promise<AuthState>;
    poll(): Promise<AuthState>;
    cancel(): Promise<AuthState>;
    preview(): Promise<AuthState>;
    logout(): Promise<AuthState>;
    onChange(listener: (state: AuthState) => void): () => void;
  };
  api: {
    get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<ApiResult<T>>;
    upload<T>(path: string, bytes: Uint8Array, name: string, voice?: boolean): Promise<ApiResult<T>>;
    send<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<ApiResult<T>>;
  };
  mail: {
    account(): Promise<MailAccountInfo | null>;
    accounts(): Promise<MailAccountInfo[]>;
    switchAccount(id: string): Promise<MailAccountInfo | null>;
    connect(input: { address: string; password: string; name?: string }): Promise<ApiResult<MailAccountInfo>>;
    disconnect(id?: string): Promise<void>;
    folders(): Promise<ApiResult<MailFolder[]>>;
    list(folder: string, page: number): Promise<ApiResult<{ total: number; messages: MailSummary[] }>>;
    read(folder: string, uid: number): Promise<ApiResult<MailMessage>>;
    setSeen(folder: string, uid: number, seen: boolean): Promise<ApiResult<true>>;
    move(folder: string, uid: number, target: MailFolderId): Promise<ApiResult<true>>;
    send(draft: MailDraft): Promise<ApiResult<true>>;
    search(folder: string, query: string): Promise<ApiResult<{ total: number; messages: MailSummary[] }>>;
    saveAttachment(folder: string, uid: number, id: string): Promise<ApiResult<string | null>>;
    onNewMail(listener: (count: number) => void): () => void;
  };
  prefs: {
    get(): Promise<Preferences>;
    set(patch: Partial<Preferences>): Promise<Preferences>;
    onChange(listener: (prefs: Preferences) => void): () => void;
  };
  modules: {
    installed(): Promise<Record<string, InstalledModule>>;
    check(): Promise<void>;
    onUpdated(listener: (list: Record<string, InstalledModule>) => void): () => void;
  };
  system: {
    openExternal(url: string): Promise<void>;
    openAppWindow(url: string, id: string): Promise<boolean>;
    openBrowser(url: string): Promise<void>;
    onOpenWeb(listener: (url: string) => void): () => void;
    notify(title: string, body: string): void;
    onCommand(listener: (command: string) => void): () => void;
    setBadge(count: number): void;
    checkUpdate(): Promise<UpdateInfo | null>;
    installUpdate(): void;
    passkeyUnlock(): Promise<ApiResult<true>>;
    passkeySetup(password: string): Promise<ApiResult<true>>;
    unlockedVersion(): Promise<string | null>;
    markUnlocked(): Promise<void>;
    screens(): Promise<ScreenInfo[]>;
    shareLock(locked: boolean): void;
    lockNow(): Promise<boolean | null>;
    reportOpenApps(list: string[]): void;
    shareState(kind: string, payload: unknown): void;
    onSharedState(listener: (value: { kind: string; payload: unknown }) => void): () => void;
    claimApp(id: string, params?: Record<string, string> | null): Promise<boolean>;
    onActivateApp(listener: (value: { id: string; params: Record<string, string> | null }) => void): () => void;
    onLockState(listener: (locked: boolean) => void): () => void;
    screenSources(): Promise<{ id: string; name: string; thumbnail: string; display: boolean }[]>;
    chooseScreen(id: string | null, audio?: boolean): Promise<void>;
    updateNow(): Promise<UpdateStatus>;
    updateStatus(): Promise<UpdateStatus>;
    onUpdateStatus(listener: (status: UpdateStatus) => void): () => void;
    onUpdateReady(listener: (version: string) => void): () => void;
    pickWallpaper(): Promise<string | null>;
    wallpaperImage(): Promise<string | null>;
  };
  account: {
    pickAvatar(): Promise<ApiResult<DesktopUser | null> | null>;
    removeAvatar(): Promise<ApiResult<DesktopUser | null>>;
  };
  files: {
    pick(options: { multiple: boolean; images: boolean }): Promise<string[]>;
    pathFor(file: File): string;
    uploadMedia(paths: string[], options: { folder: string | null }): Promise<ApiResult<string[]>>;
    uploadDrive(paths: string[], options: { folderId: string | null }): Promise<ApiResult<string[]>>;
    downloadDrive(file: { id: string; name: string; size: number }, options: { ask: boolean; open: boolean }): Promise<ApiResult<string | null>>;
    downloadMedia(item: { url: string; fileName: string; size: number }, options: { ask: boolean }): Promise<ApiResult<string | null>>;
    transfers(): Promise<Transfer[]>;
    cancel(id: string): Promise<void>;
    clearFinished(): Promise<void>;
    onTransfer(listener: (transfer: Transfer) => void): () => void;
    downloads(): Promise<LocalDownload[]>;
    open(path: string): Promise<ApiResult<true>>;
    reveal(path: string): void;
    forget(id: string): Promise<void>;
    usage(): Promise<LocalUsage>;
    clearCache(): Promise<number>;
  };
};

export type ChatPerson = { id: string; name: string; avatarUrl: string | null; role: Role; online: boolean; inVoice: boolean };
export type ProductRow = { id: string; slug: string; name: string; tagline: string | null; type: string; status: string; price: number; salePrice: number | null; currency: string; isFree: boolean; image: string | null; cover?: string | null; downloads: number; rating: number | null; featured: boolean; licenses: number; versions: number; sold30: number; updatedAt: string };
export type ProductPage = { canEdit: boolean; items: ProductRow[] };
export type ProductDetail = Omit<ProductRow, "licenses" | "versions" | "sold30" | "rating" | "updatedAt"> & {
  summary: string | null; views: number; bestSeller: boolean; isNew: boolean; licenseCode: string | null; createdAt: string; publishedAt: string | null;
  versions: { id: string; version: string; channel: string; isLatest: boolean; downloads: number; releasedAt: string }[];
  reviews: { id: string; rating: number; body: string | null; author: string; createdAt: string }[];
  counts: { licenses: number; orderItems: number; wishlisted: number };
  canEdit: boolean;
};
export type AdminOverview = {
  ordersToday: number; revenue: { currency: string; total: number; count: number }[]; awaiting: number; claims: number; openTickets: number; waitingTickets: number;
  newUsersWeek: number; users: number; errors24: number; contacts: number; meetings: number; applications: number; licenses: number; salesChart: { day: string; count: number }[];
};
export type FounderOverview = {
  month: { income: number; expense: number; vatOut: number; vatIn: number; missingRate: number };
  year: { income: number; expense: number; vatOut: number; vatIn: number; missingRate: number };
  sales: { count: number; totalTry: number };
  taxEstimate: { vatPayable: number; corporate: number; rate: number };
  due: { id: string; name: string; amount: number; currency: string; nextDueAt: string }[];
  invoices: { id: string; title: string; vendor: string | null; dueAt: string | null; total: number | null; currency: string; paymentState: string }[];
  documents: { id: string; title: string; kind: string; vendor: string | null; total: number | null; currency: string; createdAt: string }[];
  notes: { id: string; title: string; category: string | null }[];
  calendar: { title: string; date: string; detail: string }[];
};
export type GameId = "solitaire" | "minesweeper" | "blackjack" | "snake" | "game2048";
export type Leaderboard = { game: GameId; title: string; lowerIsBetter: boolean; board: { userId: string; name: string; avatarUrl: string | null; best: number; plays: number; me: boolean; rank: number }[]; recent: { score: number; createdAt: string; name: string }[] };
