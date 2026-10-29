import { net } from "electron";

import { SERVER, userAgent } from "./config";

export type HttpResult = { ok: true; status: number; payload: unknown } | { ok: false; status: number; error: string; message: string };

type Options = {
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
};

const STATUS_MESSAGES: Record<number, string> = {
  400: "İstek geçersiz.",
  403: "Bu işlem için yetkin yok.",
  404: "Kayıt bulunamadı.",
  409: "Kayıt başka biri tarafından değiştirildi. Yenileyip tekrar dene.",
  413: "Gönderilen içerik çok büyük.",
  429: "Çok fazla istek gönderildi. Biraz bekleyip tekrar dene.",
  503: "Sorvia şu an bakımda. Biraz sonra tekrar dene.",
};

export async function call(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, options: Options = {}): Promise<HttpResult> {
  const url = new URL(path, `${SERVER}/`);
  for (const [key, value] of Object.entries(options.query ?? {})) if (value !== undefined) url.searchParams.set(key, String(value));
  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": userAgent(), "X-Sorvia-Client": "desktop" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const response = await net.fetch(url.toString(), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeout ?? 20_000),
    });
    if (response.status >= 300 && response.status < 400) return { ok: false, status: response.status, error: "redirect", message: "Sunucu beklenmeyen bir yönlendirme döndürdü." };
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const body = (payload ?? {}) as { error?: unknown; message?: unknown };
      return {
        ok: false,
        status: response.status,
        error: typeof body.error === "string" ? body.error : `http_${response.status}`,
        message: typeof body.message === "string" ? body.message : (STATUS_MESSAGES[response.status] ?? `Sunucu hatası (${response.status}).`),
      };
    }
    return { ok: true, status: response.status, payload };
  } catch (error) {
    if ((error as Error).name === "TimeoutError") return { ok: false, status: 0, error: "timeout", message: "Sorvia yanıt vermedi. Biraz sonra tekrar dene." };
    return { ok: false, status: 0, error: "network", message: "Sorvia'ya ulaşılamadı. İnternet bağlantını kontrol et." };
  }
}
