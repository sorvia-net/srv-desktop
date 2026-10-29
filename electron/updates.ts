import { app, net } from "electron";

import type { UpdateInfo } from "../shared/contracts";
import { newer } from "../shared/version";
import { SERVER, userAgent } from "./config";

export async function checkUpdate(): Promise<UpdateInfo | null> {
  try {
    const response = await net.fetch(`${SERVER}/api/desktop/version`, { headers: { Accept: "application/json", "User-Agent": userAgent() }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { latest?: unknown; url?: unknown; notes?: unknown };
    if (typeof data.latest !== "string" || typeof data.url !== "string") return null;
    const url = new URL(data.url);
    if (url.protocol !== "https:" || !(url.hostname === "sorvia.net" || url.hostname.endsWith(".sorvia.net"))) return null;
    const current = app.getVersion();
    return { current, latest: data.latest, url: url.toString(), notes: typeof data.notes === "string" ? data.notes : null, available: newer(data.latest, current) };
  } catch {
    return null;
  }
}
