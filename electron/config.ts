import { app } from "electron";

export const DEV_URL = process.env.VITE_DEV_SERVER_URL ?? "";
export const IS_DEV = Boolean(DEV_URL);
export const SERVER = IS_DEV && process.env.SORVIA_SERVER ? process.env.SORVIA_SERVER.replace(/\/+$/, "") : "https://sorvia.net";
export const APP_ORIGIN = "sorvia://app";

function mailEndpoint(value: string | undefined, fallback: { host: string; port: number; secure: boolean }) {
  if (!IS_DEV || !value) return fallback;
  const [host, port, mode] = value.split(":");
  return { host: host || fallback.host, port: Number(port) || fallback.port, secure: mode !== "starttls" };
}

export const MAIL_HOST = {
  imap: mailEndpoint(process.env.SORVIA_MAIL_IMAP, { host: "mail.sorvia.net", port: 993, secure: true }),
  smtp: mailEndpoint(process.env.SORVIA_MAIL_SMTP, { host: "mail.sorvia.net", port: 465, secure: true }),
};

export function version() {
  return app.getVersion();
}

export function userAgent() {
  return `SorviaDesktop/${app.getVersion()} (Windows; Electron ${process.versions.electron})`;
}
