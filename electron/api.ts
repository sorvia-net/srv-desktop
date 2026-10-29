import type { ApiResult } from "../shared/contracts";
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
