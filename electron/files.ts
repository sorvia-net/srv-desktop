import { app, dialog, net, session, shell, type BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { open, stat, unlink } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import type { ApiResult, LocalDownload, LocalUsage, Transfer } from "../shared/contracts";
import { auth } from "./auth";
import { SERVER, userAgent } from "./config";

type Job = { transfer: Transfer; run: (job: Job) => Promise<void>; abort: AbortController };

const IMAGE = /\.(png|jpe?g|gif|webp|avif)$/i;
const MAX_UPLOAD = 4 * 1024 * 1024 * 1024;

const jobs: Job[] = [];
let running = 0;
let emit: (transfer: Transfer) => void = () => undefined;
let windowRef: () => BrowserWindow | null = () => null;

function fail<T>(message: string, status = 400): ApiResult<T> {
  return { ok: false, status, error: "files", message };
}

function headers(extra: Record<string, string> = {}) {
  const token = auth.token();
  return { "User-Agent": userAgent(), "X-Sorvia-Client": "desktop", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function api<T>(method: string, path: string, body?: unknown, raw?: Uint8Array, signal?: AbortSignal): Promise<T> {
  const response = await net.fetch(new URL(path, `${SERVER}/`).toString(), {
    method,
    headers: headers(raw ? { "Content-Type": "application/octet-stream" } : body !== undefined ? { "Content-Type": "application/json" } : {}),
    body: raw ? Buffer.from(raw) : body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }
  if (response.status === 401) auth.expire();
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `Sunucu hatası (${response.status}).`);
  return payload as T;
}

function update(job: Job, patch: Partial<Transfer>) {
  job.transfer = { ...job.transfer, ...patch };
  emit(job.transfer);
}

function pump() {
  while (running < 2) {
    const job = jobs.find((item) => item.transfer.status === "queued");
    if (!job) return;
    running += 1;
    update(job, { status: "running" });
    job
      .run(job)
      .then(() => update(job, { status: "done", done: job.transfer.size, finishedAt: new Date().toISOString() }))
      .catch((error: Error) => {
        if (job.transfer.status === "cancelled") return;
        update(job, { status: job.abort.signal.aborted ? "cancelled" : "failed", error: job.abort.signal.aborted ? null : error.message.slice(0, 200), finishedAt: new Date().toISOString() });
      })
      .finally(() => {
        running -= 1;
        pump();
      });
  }
}

function enqueue(kind: Transfer["kind"], target: Transfer["target"], name: string, size: number, path: string | null, run: Job["run"]) {
  const job: Job = {
    transfer: { id: randomUUID(), kind, target, name, size, done: 0, status: "queued", error: null, startedAt: new Date().toISOString(), finishedAt: null, path, resultId: null },
    run,
    abort: new AbortController(),
  };
  jobs.unshift(job);
  if (jobs.length > 80) jobs.splice(80);
  emit(job.transfer);
  pump();
  return job.transfer.id;
}

async function readSlice(path: string, start: number, length: number) {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function checkedPaths(paths: unknown, images: boolean) {
  if (!Array.isArray(paths) || !paths.length || paths.length > 50) return null;
  const result: { path: string; size: number }[] = [];
  for (const path of paths) {
    if (typeof path !== "string") return null;
    const info = await stat(path).catch(() => null);
    if (!info?.isFile() || info.size > MAX_UPLOAD) return null;
    if (images && !IMAGE.test(path)) return null;
    result.push({ path, size: info.size });
  }
  return result;
}

const downloadsFile = () => join(app.getPath("userData"), "sorvia-downloads.json");

function readDownloads(): LocalDownload[] {
  try {
    return JSON.parse(readFileSync(downloadsFile(), "utf8")) as LocalDownload[];
  } catch {
    return [];
  }
}

function writeDownloads(list: LocalDownload[]) {
  const target = downloadsFile();
  writeFileSync(`${target}.tmp`, JSON.stringify(list.slice(0, 300)), "utf8");
  renameSync(`${target}.tmp`, target);
}

function uniquePath(folder: string, name: string) {
  const clean = name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 180) || "dosya";
  let candidate = join(folder, clean);
  const ext = extname(clean);
  for (let index = 2; existsSync(candidate); index += 1) candidate = join(folder, `${clean.slice(0, clean.length - ext.length)} (${index})${ext}`);
  return candidate;
}

async function target(name: string, ask: boolean) {
  if (ask) {
    const win = windowRef();
    const options = { defaultPath: join(app.getPath("downloads"), name) };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    return result.canceled || !result.filePath ? null : result.filePath;
  }
  const folder = join(app.getPath("downloads"), "Sorvia");
  mkdirSync(folder, { recursive: true });
  return uniquePath(folder, name);
}

async function stream(job: Job, url: string, path: string, withAuth: boolean) {
  const response = await net.fetch(url, { headers: withAuth ? headers() : { "User-Agent": userAgent() }, signal: job.abort.signal });
  if (!response.ok || !response.body) throw new Error(response.status === 404 ? "Dosya bulunamadı." : `İndirme başarısız (${response.status}).`);
  const temp = `${path}.sorvia-part`;
  mkdirSync(dirname(path), { recursive: true });
  const out = createWriteStream(temp);
  let done = 0;
  let last = 0;
  try {
    const reader = response.body.getReader();
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      done += value.length;
      if (!out.write(value)) await new Promise((resolve) => out.once("drain", resolve));
      if (Date.now() - last > 200) {
        last = Date.now();
        update(job, { done });
      }
    }
    await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())));
    renameSync(temp, path);
  } catch (error) {
    out.destroy();
    await unlink(temp).catch(() => undefined);
    throw error;
  }
  update(job, { done, size: Math.max(job.transfer.size, done) });
}

function remember(entry: Omit<LocalDownload, "id" | "savedAt" | "exists">) {
  writeDownloads([{ ...entry, id: randomUUID(), savedAt: new Date().toISOString(), exists: true }, ...readDownloads()]);
}

export const files = {
  init(options: { emit: (transfer: Transfer) => void; window: () => BrowserWindow | null }) {
    emit = options.emit;
    windowRef = options.window;
  },

  async pick(options: unknown) {
    const { multiple, images } = (options ?? {}) as { multiple?: boolean; images?: boolean };
    const win = windowRef();
    const config: Electron.OpenDialogOptions = {
      properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
      filters: images ? [{ name: "Görseller", extensions: ["png", "jpg", "jpeg", "gif", "webp", "avif"] }] : undefined,
    };
    const result = win ? await dialog.showOpenDialog(win, config) : await dialog.showOpenDialog(config);
    return result.canceled ? [] : result.filePaths;
  },

  async uploadMedia(paths: unknown, options: unknown): Promise<ApiResult<string[]>> {
    if (!auth.token()) return fail("Oturum açık değil.", 401);
    const list = await checkedPaths(paths, true);
    if (!list) return fail("Yalnızca görsel dosyaları yüklenebilir.");
    const folder = typeof (options as { folder?: unknown })?.folder === "string" ? (options as { folder: string }).folder.slice(0, 60) : undefined;
    const ids = list.map((file) =>
      enqueue("upload", "media", basename(file.path), file.size, file.path, async (job) => {
        const started = await api<{ id: string; chunkSize: number }>("POST", "/api/desktop/uploads", { name: basename(file.path), size: file.size, folder }, undefined, job.abort.signal);
        try {
          for (let offset = 0; offset < file.size; offset += started.chunkSize) {
            const chunk = await readSlice(file.path, offset, Math.min(started.chunkSize, file.size - offset));
            await api("PUT", `/api/desktop/uploads/${started.id}?offset=${offset}`, undefined, chunk, job.abort.signal);
            update(job, { done: offset + chunk.length });
          }
          const media = await api<{ id: string }>("POST", `/api/desktop/uploads/${started.id}/complete`, undefined, undefined, job.abort.signal);
          update(job, { resultId: media.id });
        } catch (error) {
          await api("DELETE", `/api/desktop/uploads/${started.id}`).catch(() => undefined);
          throw error;
        }
      }),
    );
    return { ok: true, data: ids };
  },

  async uploadDrive(paths: unknown, options: unknown): Promise<ApiResult<string[]>> {
    if (!auth.token()) return fail("Oturum açık değil.", 401);
    const list = await checkedPaths(paths, false);
    if (!list) return fail("Dosyalar okunamadı ya da çok büyük.");
    const folderId = typeof (options as { folderId?: unknown })?.folderId === "string" ? (options as { folderId: string }).folderId : null;
    const ids = list.map((file) =>
      enqueue("upload", "drive", basename(file.path), file.size, file.path, async (job) => {
        const info = await stat(file.path);
        const started = await api<{ id: string; chunkSize: number; chunkCount: number; received: number[] }>(
          "POST",
          "/api/desktop/drive/uploads",
          { name: basename(file.path), size: file.size, folderId, lastModified: info.mtimeMs, conflict: "version" },
          undefined,
          job.abort.signal,
        );
        const received = new Set(started.received);
        try {
          for (let index = 0; index < started.chunkCount; index += 1) {
            const offset = index * started.chunkSize;
            if (!received.has(index)) {
              const chunk = await readSlice(file.path, offset, Math.min(started.chunkSize, file.size - offset));
              await api("PUT", `/api/desktop/drive/uploads/${started.id}?part=${index}`, undefined, chunk, job.abort.signal);
            }
            update(job, { done: Math.min(file.size, offset + started.chunkSize) });
          }
          const result = await api<{ fileId: string }>("POST", `/api/desktop/drive/uploads/${started.id}`, undefined, undefined, job.abort.signal);
          update(job, { resultId: result.fileId });
        } catch (error) {
          if (job.abort.signal.aborted) await api("DELETE", `/api/desktop/drive/uploads/${started.id}`).catch(() => undefined);
          throw error;
        }
      }),
    );
    return { ok: true, data: ids };
  },

  async downloadDrive(file: unknown, options: unknown): Promise<ApiResult<string | null>> {
    const { id, name, size } = (file ?? {}) as { id?: unknown; name?: unknown; size?: unknown };
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,60}$/.test(id) || typeof name !== "string") return fail("Dosya geçersiz.");
    const { ask, open: openAfter } = (options ?? {}) as { ask?: boolean; open?: boolean };
    const path = await target(name, Boolean(ask));
    if (!path) return { ok: true, data: null };
    const transferId = enqueue("download", "drive", name, Number(size) || 0, path, async (job) => {
      await stream(job, new URL(`/api/desktop/drive/files/${id}`, `${SERVER}/`).toString(), path, true);
      remember({ name: basename(path), path, size: job.transfer.done, source: "drive" });
      if (openAfter) await shell.openPath(path);
    });
    return { ok: true, data: transferId };
  },

  async downloadMedia(item: unknown, options: unknown): Promise<ApiResult<string | null>> {
    const { url, fileName, size } = (item ?? {}) as { url?: unknown; fileName?: unknown; size?: unknown };
    if (typeof url !== "string" || typeof fileName !== "string") return fail("Dosya geçersiz.");
    let parsed: URL;
    try {
      parsed = new URL(url, `${SERVER}/`);
    } catch {
      return fail("Adres geçersiz.");
    }
    if (parsed.origin !== new URL(SERVER).origin) return fail("Yalnızca Sorvia adresleri indirilebilir.");
    const path = await target(fileName, Boolean((options as { ask?: boolean })?.ask));
    if (!path) return { ok: true, data: null };
    const transferId = enqueue("download", "media", fileName, Number(size) || 0, path, async (job) => {
      await stream(job, parsed.toString(), path, false);
      remember({ name: basename(path), path, size: job.transfer.done, source: "media" });
    });
    return { ok: true, data: transferId };
  },

  transfers: () => jobs.map((job) => job.transfer),

  cancel(id: unknown) {
    const job = jobs.find((item) => item.transfer.id === id);
    if (!job || (job.transfer.status !== "queued" && job.transfer.status !== "running")) return;
    job.abort.abort();
    update(job, { status: "cancelled", finishedAt: new Date().toISOString() });
  },

  clearFinished() {
    for (let index = jobs.length - 1; index >= 0; index -= 1) if (!["queued", "running"].includes(jobs[index]!.transfer.status)) jobs.splice(index, 1);
  },

  downloads: (): LocalDownload[] => readDownloads().map((item) => ({ ...item, exists: existsSync(item.path) })),

  async open(path: unknown): Promise<ApiResult<true>> {
    if (typeof path !== "string" || !readDownloads().some((item) => item.path === path)) return fail("Dosya bulunamadı.", 404);
    const error = await shell.openPath(path);
    return error ? fail(error) : { ok: true, data: true };
  },

  reveal(path: unknown) {
    if (typeof path === "string" && readDownloads().some((item) => item.path === path)) shell.showItemInFolder(path);
  },

  forget(id: unknown) {
    writeDownloads(readDownloads().filter((item) => item.id !== id));
  },

  async usage(): Promise<LocalUsage> {
    const list = files.downloads().filter((item) => item.exists);
    return { cache: await session.defaultSession.getCacheSize(), downloads: list.reduce((sum, item) => sum + item.size, 0), downloadCount: list.length };
  },

  async clearCache() {
    const before = await session.defaultSession.getCacheSize();
    await session.defaultSession.clearCache();
    return before;
  },
};
