export type Role = "DEVELOPER" | "SUPPORT" | "MODERATOR" | "ADMIN" | "OWNER";

export type ModuleId = "home" | "tasks" | "calendar" | "tickets" | "mail" | "chat" | "settings";

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

export type ChatChannel = { id: string; slug: string; name: string; topic: string | null; isPrivate: boolean; unread: number; lastMessageAt: string | null };
export type ChatMessage = { id: string; channelId: string; body: string; author: Person | null; createdAt: string; edited: boolean; pinned: boolean };

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

export type MailAccountInfo = { address: string; name: string; imapHost: string; smtpHost: string; connected: boolean; lastError: string | null };

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
  wallpaper: "ember" | "dusk" | "noir";
  showRemoteImages: boolean;
  pollSeconds: number;
};

export type SorviaBridge = {
  platform: "win32" | "darwin" | "linux" | "web";
  version: string;
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    onMaximizeChange(listener: (maximized: boolean) => void): () => void;
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
    send<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<ApiResult<T>>;
  };
  mail: {
    account(): Promise<MailAccountInfo | null>;
    connect(input: { address: string; password: string; name?: string }): Promise<ApiResult<MailAccountInfo>>;
    disconnect(): Promise<void>;
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
  system: {
    openExternal(url: string): Promise<void>;
    notify(title: string, body: string): void;
    onCommand(listener: (command: string) => void): () => void;
    setBadge(count: number): void;
    checkUpdate(): Promise<UpdateInfo | null>;
  };
};
