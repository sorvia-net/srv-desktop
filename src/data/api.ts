import type {
  AdminOrderDetail, AdminOrderPage, AdminOverview, ChatPerson, FounderOverview, GameId, Leaderboard, ProductDetail, ProductPage, AdminUserDetail, AdminUserPage, StatusBoard, VoiceJoin, VoiceSync,
  ApiResult, AppNotification, CalendarEvent, ChatChannel, ChatMessage, DriveView, HomeSummary, MailAccountInfo, MailFolder, MailMessage, MailSummary, MediaItem, MediaPage, Priority, StorageOverview, StoreCatalog, Task,
  TicketDetail, TicketSummary,
} from "@shared/contracts";

import { bridge } from "./bridge";
import { preview, previewUser } from "./preview";

let previewMode = false;

export function setPreviewMode(value: boolean) {
  previewMode = value;
}

export function isPreview() {
  return previewMode;
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function missing<T>(message = "Kayıt bulunamadı."): ApiResult<T> {
  return { ok: false, status: 404, error: "not_found", message };
}

async function get<T>(path: string, query: Record<string, string | number | boolean | undefined> | undefined, local: () => T | null): Promise<ApiResult<T>> {
  if (previewMode) {
    await new Promise((resolve) => setTimeout(resolve, 160));
    const value = local();
    return value === null ? missing() : ok(value);
  }
  return bridge.api.get<T>(path, query);
}

async function send<T>(method: "POST" | "PATCH" | "DELETE", path: string, body: unknown, local: () => T | null): Promise<ApiResult<T>> {
  if (previewMode) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const value = local();
    return value === null ? missing() : ok(value);
  }
  return bridge.api.send<T>(method, path, body);
}

export type TaskScope = "mine" | "created" | "all";
export type TicketScope = "mine" | "waiting" | "open" | "all";

export const api = {
  home: () => get<HomeSummary>("/api/desktop/home", undefined, () => preview.home()),
  tasks: (scope: TaskScope = "mine") => get<Task[]>("/api/desktop/tasks", { scope }, () => preview.tasks()),
  createTask: (input: { title: string; board: string; priority: Priority; dueAt: string | null; description?: string | null; assigneeId?: string | null }) =>
    send<Task>("POST", "/api/desktop/tasks", input, () => preview.createTask(input)),
  updateTask: (id: string, patch: Partial<Pick<Task, "status" | "priority" | "title" | "dueAt" | "board" | "description">> & { assigneeId?: string }) =>
    send<Task>("PATCH", `/api/desktop/tasks/${id}`, patch, () => preview.updateTask(id, patch)),
  tickets: (scope: TicketScope = "mine") => get<TicketSummary[]>("/api/desktop/tickets", { scope }, () => preview.tickets()),
  ticket: (id: string) => get<TicketDetail>(`/api/desktop/tickets/${id}`, undefined, () => preview.ticket(id)),
  replyTicket: (id: string, body: string, internal: boolean) =>
    send<TicketDetail>("POST", `/api/desktop/tickets/${id}/reply`, { body, internal }, () => preview.reply(id, body, internal)),
  calendar: (from: string, to: string) => get<CalendarEvent[]>("/api/desktop/calendar", { from, to }, () => preview.calendar()),
  notifications: () => get<AppNotification[]>("/api/desktop/notifications", undefined, () => preview.notifications()),
  readNotifications: (ids: string[] | "all") => send<true>("POST", "/api/desktop/notifications/read", { ids }, () => preview.readNotifications(ids)),
  channels: () => get<ChatChannel[]>("/api/desktop/chat", undefined, () => preview.channels()),
  messages: (channelId: string) => get<ChatMessage[]>(`/api/desktop/chat/${channelId}`, undefined, () => preview.messages(channelId)),
  postMessage: (channelId: string, body: string) => send<ChatMessage>("POST", `/api/desktop/chat/${channelId}`, { body }, () => preview.post(channelId, body)),
  store: () => get<StoreCatalog>("/api/desktop/store", undefined, () => preview.store()),
  unlockPassword: (password: string) => send<{ unlocked: true }>("POST", "/api/desktop/unlock/password", { password }, () => ({ unlocked: true as const })),
};

export const adminApi = {
  users: (params: { q?: string; role?: string; status?: string; cursor?: string }) => get<AdminUserPage>("/api/desktop/users", params, () => preview.users(params)),
  user: (id: string) => get<AdminUserDetail>(`/api/desktop/users/${id}`, undefined, () => preview.user(id)),
  updateUser: (id: string, patch: { role?: string; status?: string }) => send<AdminUserDetail>("PATCH", `/api/desktop/users/${id}`, patch, () => preview.user(id)),
  orders: (params: { q?: string; status?: string; cursor?: string }) => get<AdminOrderPage>("/api/desktop/orders", params, () => preview.orders(params)),
  order: (id: string) => get<AdminOrderDetail>(`/api/desktop/orders/${id}`, undefined, () => preview.order(id)),
  orderAction: (id: string, action: "mark-paid" | "cancel" | "refund") => send<AdminOrderDetail>("POST", `/api/desktop/orders/${id}`, { action }, () => preview.order(id)),
  status: () => get<StatusBoard>("/api/desktop/status", undefined, () => preview.status()),
  products: (params: { q?: string; status?: string }) => get<ProductPage>("/api/desktop/products", params, () => preview.products()),
  product: (id: string) => get<ProductDetail>(`/api/desktop/products/${id}`, undefined, () => preview.product(id)),
  updateProduct: (id: string, patch: { status?: string; featured?: boolean; price?: number; salePrice?: number | null }) => send<ProductDetail>("PATCH", `/api/desktop/products/${id}`, patch, () => preview.product(id)),
  overview: () => get<AdminOverview>("/api/desktop/overview", undefined, () => preview.overview()),
  founder: () => get<FounderOverview>("/api/desktop/founder", undefined, () => preview.founder()),
};

export const gamesApi = {
  board: (game: GameId) => get<Leaderboard>(`/api/desktop/games/${game}`, undefined, () => preview.board(game)),
  submit: (game: GameId, score: number, meta?: Record<string, unknown>) => send<Leaderboard>("POST", `/api/desktop/games/${game}`, { score, meta }, () => preview.board(game, score)),
};

export const peopleApi = {
  list: () => get<ChatPerson[]>("/api/desktop/chat/people", undefined, () => preview.people()),
  openDirect: (userId: string) => send<{ id: string }>("POST", "/api/desktop/chat/dm", { userId }, () => preview.openDirect(userId)),
};

export const voiceApi = {
  createChannel: (input: { name: string; kind: "text" | "voice"; topic?: string; limit?: number | null; minRole?: string }) => send<{ id: string }>("POST", "/api/desktop/chat/channels", input, () => null),
  updateChannel: (id: string, patch: { name?: string; topic?: string; limit?: number | null; minRole?: string; order?: number }) => send<{ id: string }>("PATCH", `/api/desktop/chat/channels/${id}`, patch, () => null),
  deleteChannel: (id: string) => send<{ deleted: true }>("DELETE", `/api/desktop/chat/channels/${id}`, undefined, () => null),
  join: (channelId: string) => send<VoiceJoin>("POST", `/api/desktop/voice/${channelId}`, {}, () => null),
  sync: (body: { peerId: string; state: Record<string, boolean>; signals: { to: string; kind: string; payload: unknown }[] }) => send<VoiceSync>("POST", "/api/desktop/voice/sync", body, () => null),
  leave: (peerId: string) => send<{ left: true }>("POST", "/api/desktop/voice/leave", { peerId }, () => null),
};

export const galleryApi = {
  list: (params: { q?: string; folder?: string; cursor?: string }) => get<MediaPage>("/api/desktop/media", params, () => preview.media(params)),
  update: (id: string, patch: Partial<Pick<MediaItem, "alt" | "folder" | "fileName">>) => send<MediaItem>("PATCH", `/api/desktop/media/${id}`, patch, () => preview.updateMedia(id, patch)),
  remove: (id: string, force: boolean) => send<{ deleted: boolean; places: string[] }>("DELETE", `/api/desktop/media/${id}`, { force }, () => preview.removeMedia(id)),
};

export type DriveAction = { action: "rename" | "move" | "star" | "unstar" | "trash" | "restore" | "purge" | "empty-trash"; fileIds?: string[]; folderIds?: string[]; targetId?: string | null; kind?: "file" | "folder"; id?: string; name?: string };

export const filesApi = {
  overview: () => get<StorageOverview>("/api/desktop/storage", undefined, () => preview.storage()),
  drive: (params: { folder?: string; mode?: string; q?: string }) => get<DriveView>("/api/desktop/drive", params, () => preview.drive(params)),
  createFolder: (parentId: string | null, name: string) => send<{ id: string }>("POST", "/api/desktop/drive/folders", { parentId, name }, () => preview.createFolder(parentId, name)),
  act: (body: DriveAction) => send<{ message: string | null }>("POST", "/api/desktop/drive/items", body, () => preview.driveAction(body)),
};

export const mailApi = {
  account: async (): Promise<ApiResult<MailAccountInfo | null>> =>
    ok(previewMode ? { id: "preview", active: true, address: previewUser.email, name: previewUser.name, imapHost: "önizleme", smtpHost: "önizleme", connected: true, lastError: null } : await bridge.mail.account()),
  folders: async (): Promise<ApiResult<MailFolder[]>> => (previewMode ? ok(preview.mailFolders()) : bridge.mail.folders()),
  list: async (folder: string, page: number): Promise<ApiResult<{ total: number; messages: MailSummary[] }>> => (previewMode ? ok(preview.mailList(folder)) : bridge.mail.list(folder, page)),
  read: async (folder: string, uid: number): Promise<ApiResult<MailMessage>> => {
    if (!previewMode) return bridge.mail.read(folder, uid);
    const message = preview.mailRead(uid);
    return message ? ok(message) : missing("İleti bulunamadı.");
  },
};
