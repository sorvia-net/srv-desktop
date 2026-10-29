import type {
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
  createTask: (input: { title: string; board: string; priority: Priority; dueAt: string | null; description?: string | null }) =>
    send<Task>("POST", "/api/desktop/tasks", input, () => preview.createTask(input)),
  updateTask: (id: string, patch: Partial<Pick<Task, "status" | "priority" | "title" | "dueAt" | "board" | "description">>) =>
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
