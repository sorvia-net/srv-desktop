import type { ApiResult } from "../shared/contracts";
import { net } from "electron";

import { SERVER, userAgent } from "./config";
import { auth } from "./auth";
import { call } from "./http";

const PATH = /^\/api\/desktop\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;
const METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);
const MAX_BODY = 256 * 1024;

function fail<T>(status: number, error: string, message: string): ApiResult<T> {
  return { ok: false, status, error, message };
}

function cleanQuery(query: unknown) {
  const result: Record<string, string | number | boolean> = {};
  if (!query || typeof query !== "object") return result;
  for (const [key, value] of Object.entries(query)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,30}$/.test(key)) continue;
    if (typeof value === "string") result[key] = value.slice(0, 200);
    else if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
    else if (typeof value === "boolean") result[key] = value;
  }
  return result;
}

export async function request<T>(method: unknown, path: unknown, query?: unknown, body?: unknown): Promise<ApiResult<T>> {
  if (typeof method !== "string" || !METHODS.has(method)) return fail(400, "bad_request", "Geçersiz istek.");
  if (typeof path !== "string" || !PATH.test(path) || path.startsWith("/api/desktop/auth/")) return fail(400, "bad_request", "Geçersiz istek.");
  if (body !== undefined && JSON.stringify(body).length > MAX_BODY) return fail(413, "too_large", "Gönderilen içerik çok büyük.");
  const token = auth.token();
  if (!token) return fail(401, "unauthorized", "Oturum açık değil.");
  const result = await call(method as "GET", path, { token, query: cleanQuery(query), body: method === "GET" ? undefined : body });
  if (!result.ok) {
    if (result.status === 401) auth.expire();
    return fail(result.status, result.error, result.message);
  }
  return { ok: true, data: result.payload as T };
}

const STREAM_PATHS = new Set(["/api/desktop/assistant"]);
const streams = new Map<string, AbortController>();

/**
 * Sunucu olaylarını (SSE) satır satır okuyup `api:stream` kanalına iletir.
 * Yalnızca beyaz listedeki uçlar; belirteç ana süreçte kalır.
 */
export async function streamRequest(emit: (payload: unknown) => void, id: unknown, path: unknown, body: unknown): Promise<ApiResult<{ ok: true }>> {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(id)) return fail(400, "bad_request", "Geçersiz istek.");
  if (typeof path !== "string" || !STREAM_PATHS.has(path)) return fail(400, "bad_request", "Geçersiz istek.");
  if (JSON.stringify(body ?? null).length > MAX_BODY) return fail(413, "too_large", "Gönderilen içerik çok büyük.");
  const token = auth.token();
  if (!token) return fail(401, "unauthorized", "Oturum açık değil.");

  const controller = new AbortController();
  streams.set(id, controller);
  try {
    const response = await net.fetch(new URL(path, `${SERVER}/`).toString(), {
      method: "POST",
      headers: { Accept: "text/event-stream", "Content-Type": "application/json", Authorization: `Bearer ${token}`, "User-Agent": userAgent(), "X-Sorvia-Client": "desktop" },
      body: JSON.stringify(body ?? {}),
      redirect: "manual",
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      if (response.status === 401) auth.expire();
      const payload = (await response.json().catch(() => ({}))) as { message?: unknown; error?: unknown };
      const message = typeof payload.message === "string" ? payload.message : typeof payload.error === "string" ? payload.error : `Sunucu hatası (${response.status}).`;
      return fail(response.status, "http_error", message);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const data = chunk.split("\n").filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n");
        if (!data) continue;
        try {
          emit({ id, event: JSON.parse(data) });
        } catch {
          /* bozuk satır atlanır */
        }
      }
    }
    return { ok: true, data: { ok: true } };
  } catch (error) {
    if ((error as Error).name === "AbortError") return { ok: true, data: { ok: true } };
    return fail(0, "network", "Sorvia'ya ulaşılamadı. İnternet bağlantını kontrol et.");
  } finally {
    streams.delete(id);
  }
}

export function abortStream(id: unknown) {
  if (typeof id === "string") streams.get(id)?.abort();
}
