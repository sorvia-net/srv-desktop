import { createHash, createPublicKey, verify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

import { app, net } from "electron";

import type { InstalledModule } from "../shared/contracts";
import { request } from "./api";
import { auth } from "./auth";
import { SERVER, userAgent } from "./config";

const PUBLIC_KEY = createPublicKey(`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAa1ORv1ROMAaC8UoI+0+swtmLKsHNcdktpXzmAF12AAs=
-----END PUBLIC KEY-----`);

const FILES = ["bundle.js", "bundle.css"] as const;
const ID = /^[a-z][a-z0-9-]{0,40}$/;
const VERSION = /^\d{1,4}(\.\d{1,4}){1,3}$/;

type Remote = { id: string; version: string; minApp: string; notes: string | null; files: Record<string, string>; signature: string };

let notify: (list: Record<string, InstalledModule>) => void = () => undefined;
let running: Promise<void> | null = null;

function root() {
  return join(app.getPath("userData"), "modules");
}

function indexFile() {
  return join(root(), "index.json");
}

export function installedModules(): Record<string, InstalledModule> {
  try {
    const data = JSON.parse(readFileSync(indexFile(), "utf8")) as Record<string, InstalledModule>;
    return Object.fromEntries(Object.entries(data).filter(([id, item]) => ID.test(id) && VERSION.test(item.version) && existsSync(join(root(), id, item.version, "bundle.js"))));
  } catch {
    return {};
  }
}

function compare(a: string, b: string) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function signedMessage(item: { id: string; version: string; files: Record<string, string> }) {
  return [item.id, item.version, ...FILES.map((file) => `${file}:${item.files[file] ?? ""}`)].join("\n");
}

async function download(item: Remote, file: string) {
  const token = auth.token();
  if (!token) throw new Error("Oturum yok");
  const response = await net.fetch(`${SERVER}/api/desktop/modules/${item.id}/${item.version}/${file}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent(), "X-Sorvia-Client": "desktop" } });
  if (!response.ok) throw new Error(`${file} indirilemedi (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== item.files[file]) throw new Error(`${file} doğrulanamadı`);
  return bytes;
}

async function install(item: Remote) {
  if (!verify(null, Buffer.from(signedMessage(item)), PUBLIC_KEY, Buffer.from(item.signature, "base64"))) throw new Error("İmza geçersiz");
  const payload = await Promise.all(FILES.map(async (file) => [file, await download(item, file)] as const));
  const target = join(root(), item.id, item.version);
  mkdirSync(target, { recursive: true });
  for (const [file, bytes] of payload) writeFileSync(join(target, file), bytes);
  const index = installedModules();
  index[item.id] = { version: item.version, notes: item.notes, installedAt: new Date().toISOString() };
  writeFileSync(indexFile(), JSON.stringify(index, null, 2));
  for (const old of readdirSync(join(root(), item.id))) if (old !== item.version) rmSync(join(root(), item.id, old), { recursive: true, force: true });
}

async function run() {
  const result = await request<Remote[]>("GET", "/api/desktop/modules");
  if (!result.ok) return;
  const index = installedModules();
  let changed = false;
  for (const item of result.data) {
    if (!ID.test(item.id) || !VERSION.test(item.version)) continue;
    if (compare(item.minApp || "0.0.0", app.getVersion()) > 0) continue;
    if (index[item.id] && compare(item.version, index[item.id]!.version) <= 0) continue;
    try {
      await install(item);
      changed = true;
    } catch (error) {
      console.error(`[modüller] ${item.id} ${item.version}: ${(error as Error).message}`);
    }
  }
  if (changed) notify(installedModules());
}

export const modules = {
  init(listener: (list: Record<string, InstalledModule>) => void) {
    notify = listener;
    mkdirSync(root(), { recursive: true });
  },
  check() {
    running ??= run().finally(() => {
      running = null;
    });
    return running;
  },
  resolveFile(relative: string) {
    const parts = relative.split("/");
    if (parts.length !== 4 || parts[0] !== "modules" || !ID.test(parts[1]!) || !VERSION.test(parts[2]!) || !(FILES as readonly string[]).includes(parts[3]!)) return null;
    const file = resolve(root(), parts[1]!, parts[2]!, parts[3]!);
    return file.startsWith(resolve(root()) + sep) ? file : null;
  },
};
