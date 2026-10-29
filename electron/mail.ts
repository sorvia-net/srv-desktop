import { app, dialog, type BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { ImapFlow, type FetchMessageObject, type MessageStructureObject } from "imapflow";
import { simpleParser, type AddressObject, type Attachment } from "mailparser";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";

import type { ApiResult, MailAccountInfo, MailDraft, MailFolder, MailFolderId, MailMessage, MailSummary } from "../shared/contracts";
import { MAIL_HOST, version } from "./config";
import { addresses, cleanHtml, decodeText, decodeTransfer, EMAIL, previewText, safeName } from "./mail-content";
import { canEncrypt, store } from "./store";

const PAGE = 40;
const ROLE: Record<string, MailFolderId> = { "\\Inbox": "INBOX", "\\Sent": "Sent", "\\Drafts": "Drafts", "\\Archive": "Archive", "\\Trash": "Trash", "\\Junk": "Junk" };
const ROLE_NAME: Record<MailFolderId, string> = { INBOX: "Gelen kutusu", Drafts: "Taslaklar", Sent: "Gönderilenler", Archive: "Arşiv", Junk: "Gereksiz", Trash: "Çöp" };
const ORDER: MailFolderId[] = ["INBOX", "Drafts", "Sent", "Archive", "Junk", "Trash"];
const RISKY = new Set([".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".ps1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".hta", ".lnk", ".jar", ".reg", ".cpl", ".msc", ".iso", ".img"]);

class MailFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const events = new EventEmitter();
const attachmentCache = new Map<string, Attachment[]>();
let worker: ImapFlow | null = null;
let workerPending: Promise<ImapFlow> | null = null;
let watcher: ImapFlow | null = null;
let watchTimer: NodeJS.Timeout | null = null;
let enabled = false;
let lastError: string | null = null;
let folderCache: { at: number; folders: MailFolder[] } | null = null;

function activeAccount() {
  const list = store.mailAccounts();
  return list.find((item) => item.id === store.activeMail()) ?? list[0] ?? null;
}

function credentials() {
  const account = activeAccount();
  const password = account ? store.secret(`mail:${account.id}`) : null;
  return account && password ? { ...account, password } : null;
}

function describeAccount(account: { id: string; address: string; name: string }, active: boolean): MailAccountInfo {
  return {
    id: account.id,
    active,
    address: account.address,
    name: account.name,
    imapHost: MAIL_HOST.imap.host,
    smtpHost: MAIL_HOST.smtp.host,
    connected: active && Boolean(worker?.usable || watcher?.usable),
    lastError: active ? lastError : null,
  };
}

function createClient(user: string, pass: string) {
  return new ImapFlow({
    ...MAIL_HOST.imap,
    auth: { user, pass },
    logger: false,
    clientInfo: { name: "Sorvia Desktop", version: version(), vendor: "Sorvia" },
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 5 * 60_000,
  });
}

function describe(error: unknown): { error: string; message: string } {
  if (error instanceof MailFailure) return { error: error.code, message: error.message };
  const value = (error ?? {}) as { authenticationFailed?: boolean; code?: string; responseText?: string; serverResponseCode?: string; message?: string };
  if (value.authenticationFailed || value.serverResponseCode === "AUTHENTICATIONFAILED" || value.code === "EAUTH") return { error: "auth", message: "E-posta adresi ya da parola hatalı." };
  if (["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ESOCKET", "ECONNECTION", "NoConnection", "ETIMEOUT"].includes(value.code ?? "")) {
    return { error: "network", message: "mail.sorvia.net'e ulaşılamadı. Bağlantını kontrol et." };
  }
  return { error: "mail", message: value.responseText || value.message || "Posta sunucusu isteği tamamlayamadı." };
}

async function guard<T>(work: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    const info = describe(error);
    if (info.error !== "invalid" && info.error !== "not_found") lastError = info.message;
    return { ok: false, status: info.error === "auth" ? 401 : info.error === "invalid" ? 400 : info.error === "not_found" ? 404 : 502, ...info };
  }
}

async function client(): Promise<ImapFlow> {
  if (worker?.usable) return worker;
  if (workerPending) return workerPending;
  const creds = credentials();
  if (!creds) throw new MailFailure("not_connected", "Posta hesabı bağlı değil.");
  workerPending = (async () => {
    const next = createClient(creds.address, creds.password);
    next.on("error", (error: Error) => {
      lastError = describe(error).message;
    });
    next.on("close", () => {
      if (worker === next) worker = null;
    });
    await next.connect();
    worker = next;
    lastError = null;
    return next;
  })();
  try {
    return await workerPending;
  } finally {
    workerPending = null;
  }
}

async function withMailbox<T>(path: string, readOnly: boolean, work: (connection: ImapFlow) => Promise<T>) {
  if (typeof path !== "string" || !path || path.length > 300) throw new MailFailure("invalid", "Klasör geçersiz.");
  const connection = await client();
  const lock = await connection.getMailboxLock(path, { readOnly });
  try {
    return await work(connection);
  } finally {
    lock.release();
  }
}

async function folders(connection: ImapFlow, fresh = false): Promise<MailFolder[]> {
  if (!fresh && folderCache && Date.now() - folderCache.at < 30_000) return folderCache.folders;
  const list = await connection.list({ statusQuery: { messages: true, unseen: true } });
  const result = list
    .filter((item) => !item.flags.has("\\Noselect") && !item.flags.has("\\NonExistent"))
    .map((item): MailFolder => {
      const role = item.path.toUpperCase() === "INBOX" ? "INBOX" : item.specialUse ? (ROLE[item.specialUse] ?? null) : null;
      return { id: item.path, path: item.path, name: role ? ROLE_NAME[role] : item.name, role, unread: item.status?.unseen ?? 0, total: item.status?.messages ?? 0 };
    })
    .sort((a, b) => {
      const rank = (folder: MailFolder) => (folder.role ? ORDER.indexOf(folder.role) : ORDER.length);
      return rank(a) - rank(b) || a.name.localeCompare(b.name, "tr");
    });
  folderCache = { at: Date.now(), folders: result };
  return result;
}

function person(value?: { name?: string; address?: string }) {
  return { name: value?.name?.trim() ?? "", address: value?.address?.trim() ?? "" };
}

function parsedPeople(value: AddressObject | AddressObject[] | undefined) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.flatMap((item) => item.value.map((entry) => person({ name: entry.name, address: entry.address })));
}

function validDate(...values: (Date | string | undefined)[]) {
  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function findPart(node: MessageStructureObject, type: string): MessageStructureObject | null {
  if (node.type === type && node.disposition !== "attachment") return node;
  for (const child of node.childNodes ?? []) {
    const found = findPart(child, type);
    if (found) return found;
  }
  return null;
}

function hasAttachment(node: MessageStructureObject): boolean {
  if (node.disposition === "attachment") return true;
  return (node.childNodes ?? []).some(hasAttachment);
}

function summary(message: FetchMessageObject, folder: string, preview: string): MailSummary {
  const envelope = message.envelope;
  return {
    uid: message.uid,
    folder,
    from: person(envelope?.from?.[0]),
    to: (envelope?.to ?? []).map(person),
    subject: envelope?.subject?.trim() || "(Konu yok)",
    preview,
    date: validDate(envelope?.date, message.internalDate),
    seen: message.flags?.has("\\Seen") ?? false,
    flagged: message.flags?.has("\\Flagged") ?? false,
    hasAttachments: message.bodyStructure ? hasAttachment(message.bodyStructure) : false,
  };
}

async function previews(connection: ImapFlow, messages: FetchMessageObject[]) {
  const texts = new Map<number, string>();
  const groups = new Map<string, number[]>();
  const nodes = new Map<number, { node: MessageStructureObject; html: boolean }>();
  for (const message of messages) {
    if (!message.bodyStructure) continue;
    const plain = findPart(message.bodyStructure, "text/plain");
    const node = plain ?? findPart(message.bodyStructure, "text/html");
    if (!node) continue;
    const key = node.part ?? "1";
    nodes.set(message.uid, { node, html: !plain });
    groups.set(key, [...(groups.get(key) ?? []), message.uid]);
  }
  for (const [key, uids] of groups) {
    const fetched = await connection.fetchAll(uids.join(","), { uid: true, bodyParts: [{ key, maxLength: 2048 }] }, { uid: true });
    for (const item of fetched) {
      const info = nodes.get(item.uid);
      const raw = item.bodyParts ? [...item.bodyParts.values()][0] : undefined;
      if (!info || !raw) continue;
      const binary = item.binaryParts ? item.binaryParts.size > 0 : false;
      const bytes = binary ? raw : decodeTransfer(raw, info.node.encoding);
      texts.set(item.uid, previewText(decodeText(bytes, info.node.parameters?.charset), info.html));
    }
  }
  return texts;
}

async function page(connection: ImapFlow, folder: string, range: string, byUid: boolean) {
  const fetched = await connection.fetchAll(range, { uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true }, { uid: byUid });
  const texts = await previews(connection, fetched);
  return fetched.sort((a, b) => b.seq - a.seq).map((message) => summary(message, folder, texts.get(message.uid) ?? ""));
}

function remember(key: string, attachments: Attachment[]) {
  attachmentCache.delete(key);
  attachmentCache.set(key, attachments);
  while (attachmentCache.size > 6) attachmentCache.delete(attachmentCache.keys().next().value!);
}

async function stopClients() {
  if (watchTimer) clearTimeout(watchTimer);
  watchTimer = null;
  const closing = [worker, watcher].filter((item): item is ImapFlow => Boolean(item));
  worker = null;
  watcher = null;
  folderCache = null;
  await Promise.all(closing.map((item) => item.logout().catch(() => item.close())));
}

function retryWatch(delay = 60_000) {
  if (!enabled) return;
  if (watchTimer) clearTimeout(watchTimer);
  watchTimer = setTimeout(() => void watch(), delay);
}

async function announce(connection: ImapFlow, from: number, to: number) {
  try {
    const fresh = (await connection.fetchAll(`${from}:${to}`, { uid: true, flags: true, envelope: true })).filter((item) => !item.flags?.has("\\Seen"));
    folderCache = null;
    if (fresh.length) {
      events.emit(
        "new",
        fresh.map((item) => ({ from: item.envelope?.from?.[0]?.name || item.envelope?.from?.[0]?.address || "Bilinmeyen gönderen", subject: item.envelope?.subject?.trim() || "(Konu yok)" })),
      );
    }
  } catch {
    folderCache = null;
  }
}

async function watch() {
  if (!enabled || watcher?.usable) return;
  const creds = credentials();
  if (!creds) return;
  const next = createClient(creds.address, creds.password);
  next.on("error", () => undefined);
  next.on("close", () => {
    if (watcher === next) {
      watcher = null;
      retryWatch(15_000);
    }
  });
  next.on("exists", (data: { path: string; count: number; prevCount: number }) => {
    if (data.count > data.prevCount) setTimeout(() => void announce(next, data.prevCount + 1, data.count), 300);
  });
  try {
    await next.connect();
    await next.mailboxOpen("INBOX");
    watcher = next;
  } catch (error) {
    const info = describe(error);
    lastError = info.message;
    next.close();
    if (info.error !== "auth") retryWatch();
  }
}

export const mail = {
  onSwitched(listener: () => void) {
    events.on("switched", listener);
    return () => events.off("switched", listener);
  },
  onNew(listener: (items: { from: string; subject: string }[]) => void) {
    events.on("new", listener);
    return () => events.off("new", listener);
  },
  start() {
    if (!credentials()) return;
    enabled = true;
    void watch();
  },
  async stop() {
    enabled = false;
    await stopClients();
  },
  resume() {
    if (!enabled) return;
    void stopClients().then(() => retryWatch(3_000));
  },
  info(): MailAccountInfo | null {
    const account = activeAccount();
    return account ? describeAccount(account, true) : null;
  },
  accounts(): MailAccountInfo[] {
    const active = activeAccount();
    return store.mailAccounts().map((item) => describeAccount(item, item.id === active?.id));
  },
  async switchAccount(id: unknown) {
    const target = store.mailAccounts().find((item) => item.id === id);
    if (!target) return mail.info();
    await mail.stop();
    attachmentCache.clear();
    lastError = null;
    store.setMailAccounts(store.mailAccounts(), target.id);
    mail.start();
    events.emit("switched");
    return mail.info();
  },
  connect: (input: unknown) =>
    guard(async () => {
      const value = (input ?? {}) as { address?: unknown; password?: unknown; name?: unknown };
      const address = String(value.address ?? "").trim().toLowerCase();
      const password = String(value.password ?? "");
      if (!EMAIL.test(address)) throw new MailFailure("invalid", "Geçerli bir e-posta adresi gir.");
      if (!password) throw new MailFailure("invalid", "Parolanı gir.");
      if (!canEncrypt()) throw new MailFailure("invalid", "Windows güvenli saklama alanına erişilemedi; parola saklanamaz.");
      const probe = createClient(address, password);
      probe.on("error", () => undefined);
      await probe.connect();
      await probe.logout().catch(() => probe.close());
      await mail.stop();
      attachmentCache.clear();
      const list = store.mailAccounts();
      const existing = list.find((item) => item.address === address);
      if (!existing && list.length >= 8) throw new MailFailure("invalid", "En fazla 8 posta hesabı ekleyebilirsin.");
      const id = existing?.id ?? `m${randomUUID().slice(0, 8)}`;
      const entry = { id, address, name: String(value.name ?? "").trim().slice(0, 120) || existing?.name || address };
      store.setSecret(`mail:${id}`, password);
      store.setMailAccounts(existing ? list.map((item) => (item.id === id ? entry : item)) : [...list, entry], id);
      lastError = null;
      mail.start();
      return mail.info()!;
    }),
  async disconnect(id?: unknown) {
    const list = store.mailAccounts();
    const active = activeAccount();
    const target = list.find((item) => item.id === id) ?? active;
    if (!target) return;
    const removingActive = target.id === active?.id;
    if (removingActive) {
      await mail.stop();
      attachmentCache.clear();
      lastError = null;
    }
    store.setSecret(`mail:${target.id}`, null);
    const rest = list.filter((item) => item.id !== target.id);
    store.setMailAccounts(rest, removingActive ? (rest[0]?.id ?? null) : (active?.id ?? null));
    if (removingActive && rest.length) mail.start();
  },
  async disconnectAll() {
    await mail.stop();
    attachmentCache.clear();
    for (const item of store.mailAccounts()) store.setSecret(`mail:${item.id}`, null);
    store.setMailAccounts([], null);
    lastError = null;
  },
  folders: () => guard(async () => folders(await client(), true)),
  list: (folder: unknown, pageIndex: unknown) =>
    guard(() =>
      withMailbox(String(folder), true, async (connection) => {
        const total = connection.mailbox ? connection.mailbox.exists : 0;
        const index = Math.min(1000, Math.max(0, Math.floor(Number(pageIndex) || 0)));
        const end = total - index * PAGE;
        if (end < 1) return { total, messages: [] };
        return { total, messages: await page(connection, String(folder), `${Math.max(1, end - PAGE + 1)}:${end}`, false) };
      }),
    ),
  search: (folder: unknown, query: unknown) =>
    guard(() =>
      withMailbox(String(folder), true, async (connection) => {
        const term = String(query ?? "").trim().slice(0, 120);
        if (!term) return { total: 0, messages: [] };
        const uids = (await connection.search({ or: [{ subject: term }, { from: term }, { to: term }, { body: term }] }, { uid: true })) || [];
        const latest = uids.slice(-PAGE);
        if (!latest.length) return { total: 0, messages: [] };
        return { total: uids.length, messages: await page(connection, String(folder), latest.join(","), true) };
      }),
    ),
  read: (folder: unknown, uid: unknown): Promise<ApiResult<MailMessage>> =>
    guard(() =>
      withMailbox(String(folder), false, async (connection) => {
        const id = Math.floor(Number(uid));
        if (!Number.isFinite(id) || id < 1) throw new MailFailure("invalid", "İleti geçersiz.");
        const message = await connection.fetchOne(String(id), { uid: true, flags: true, envelope: true, internalDate: true, bodyStructure: true, source: true }, { uid: true });
        if (!message || !message.source) throw new MailFailure("not_found", "İleti bulunamadı.");
        const parsed = await simpleParser(message.source);
        remember(`${folder}:${id}`, parsed.attachments);
        if (!message.flags?.has("\\Seen")) {
          await connection.messageFlagsAdd(String(id), ["\\Seen"], { uid: true });
          folderCache = null;
        }
        const html = parsed.html ? cleanHtml(parsed.html) : null;
        return {
          ...summary(message, String(folder), ""),
          seen: true,
          cc: parsedPeople(parsed.cc),
          html: html?.html ?? null,
          text: parsed.text ?? null,
          remoteImages: html?.remote ?? false,
          attachments: parsed.attachments
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => !item.related)
            .map(({ item, index }) => ({ id: String(index), filename: item.filename ?? `ek-${index + 1}`, contentType: item.contentType, size: item.size })),
          messageId: parsed.messageId ?? null,
        };
      }),
    ),
  setSeen: (folder: unknown, uid: unknown, seen: unknown) =>
    guard(() =>
      withMailbox(String(folder), false, async (connection) => {
        const id = String(Math.floor(Number(uid)));
        if (seen) await connection.messageFlagsAdd(id, ["\\Seen"], { uid: true });
        else await connection.messageFlagsRemove(id, ["\\Seen"], { uid: true });
        folderCache = null;
        return true as const;
      }),
    ),
  move: (folder: unknown, uid: unknown, target: unknown) =>
    guard(async () => {
      if (typeof target !== "string" || !ORDER.includes(target as MailFolderId)) throw new MailFailure("invalid", "Hedef klasör geçersiz.");
      const destination = (await folders(await client())).find((item) => item.role === target);
      if (!destination) throw new MailFailure("not_found", `${ROLE_NAME[target as MailFolderId]} klasörü bulunamadı.`);
      return withMailbox(String(folder), false, async (connection) => {
        const id = String(Math.floor(Number(uid)));
        if (destination.path === folder) {
          if (target === "Trash") await connection.messageDelete(id, { uid: true });
        } else await connection.messageMove(id, destination.path, { uid: true });
        folderCache = null;
        return true as const;
      });
    }),
  send: (input: unknown) =>
    guard(async () => {
      const draft = (input ?? {}) as Partial<MailDraft>;
      const creds = credentials();
      if (!creds) throw new MailFailure("not_connected", "Posta hesabı bağlı değil.");
      const to = addresses(draft.to);
      const cc = addresses(draft.cc);
      if (!to.length) throw new MailFailure("invalid", "En az bir alıcı gir.");
      const invalid = [...to, ...cc].find((item) => !EMAIL.test(item));
      if (invalid) throw new MailFailure("invalid", `Geçersiz adres: ${invalid}`);
      if (to.length + cc.length > 50) throw new MailFailure("invalid", "Bir iletiye en fazla 50 alıcı eklenebilir.");
      const domain = creds.address.split("@")[1] ?? "sorvia.net";
      const message = {
        from: { name: creds.name, address: creds.address },
        to,
        cc: cc.length ? cc : undefined,
        subject: String(draft.subject ?? "").slice(0, 300),
        text: String(draft.text ?? "").slice(0, 200_000),
        messageId: `<${randomUUID()}@${domain}>`,
        date: new Date(),
        inReplyTo: draft.inReplyTo || undefined,
        references: draft.references || draft.inReplyTo || undefined,
        headers: { "X-Mailer": `Sorvia Desktop ${version()}` },
      };
      const raw = await new MailComposer(message).compile().build();
      const transport = nodemailer.createTransport({ ...MAIL_HOST.smtp, auth: { user: creds.address, pass: creds.password } });
      try {
        await transport.sendMail({ envelope: { from: creds.address, to: [...to, ...cc] }, raw });
      } finally {
        transport.close();
      }
      try {
        const connection = await client();
        const sent = (await folders(connection)).find((item) => item.role === "Sent");
        if (sent) await connection.append(sent.path, raw, ["\\Seen"]);
        folderCache = null;
      } catch {
        folderCache = null;
      }
      return true as const;
    }),
  saveAttachment: (window: BrowserWindow | null, folder: unknown, uid: unknown, attachmentId: unknown) =>
    guard(async () => {
      const id = Math.floor(Number(uid));
      const key = `${folder}:${id}`;
      let list = attachmentCache.get(key);
      if (!list) {
        list = await withMailbox(String(folder), true, async (connection) => {
          const message = await connection.fetchOne(String(id), { uid: true, source: true }, { uid: true });
          if (!message || !message.source) throw new MailFailure("not_found", "İleti bulunamadı.");
          return (await simpleParser(message.source)).attachments;
        });
        remember(key, list);
      }
      const item = list[Number(attachmentId)];
      if (!item) throw new MailFailure("not_found", "Ek bulunamadı.");
      const name = safeName(item.filename ?? `ek-${Number(attachmentId) + 1}`);
      if (RISKY.has(extname(name).toLowerCase())) {
        const box = {
          type: "warning" as const,
          buttons: ["Vazgeç", "Yine de kaydet"],
          defaultId: 0,
          cancelId: 0,
          title: "Çalıştırılabilir dosya",
          message: `${name} bilgisayarında komut çalıştırabilir.`,
          detail: "Yalnızca gönderene güveniyorsan kaydet. Dosya internetten gelmiş olarak işaretlenir.",
        };
        const answer = window ? await dialog.showMessageBox(window, box) : await dialog.showMessageBox(box);
        if (answer.response !== 1) return null;
      }
      const options = { defaultPath: join(app.getPath("downloads"), name) };
      const choice = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
      if (choice.canceled || !choice.filePath) return null;
      await writeFile(choice.filePath, item.content);
      await writeFile(`${choice.filePath}:Zone.Identifier`, "[ZoneTransfer]\r\nZoneId=3\r\n").catch(() => undefined);
      return choice.filePath;
    }),
};
