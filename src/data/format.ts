const TIME_ZONE = "Europe/Istanbul";

const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const dayFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: TIME_ZONE });
const shortDayFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: TIME_ZONE });
const weekdayFormat = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: TIME_ZONE });
const fullFormat = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE });
const keyFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE });
const hourFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: TIME_ZONE });

export function time(value: string | Date) {
  return timeFormat.format(new Date(value));
}

export function day(value: string | Date) {
  return dayFormat.format(new Date(value));
}

export function shortDay(value: string | Date) {
  return shortDayFormat.format(new Date(value));
}

export function weekday(value: string | Date) {
  return weekdayFormat.format(new Date(value));
}

export function fullDay(value: string | Date) {
  return fullFormat.format(new Date(value));
}

export function dayKey(value: string | Date) {
  return keyFormat.format(new Date(value));
}

export function isToday(value: string | Date) {
  return dayKey(value) === dayKey(new Date());
}

export function isPast(value: string | Date) {
  return new Date(value).getTime() < Date.now();
}

export function relative(value: string | Date) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 1) return "şimdi";
  if (minutes > 0 && minutes < 60) return `${minutes} dk önce`;
  if (minutes < 0 && minutes > -60) return `${-minutes} dk sonra`;
  const hours = Math.round(minutes / 60);
  if (hours > 0 && hours < 24) return `${hours} sa önce`;
  if (hours < 0 && hours > -24) return `${-hours} sa sonra`;
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000));
  const key = dayKey(date);
  if (key === yesterday) return `dün ${time(date)}`;
  if (key === tomorrow) return `yarın ${time(date)}`;
  if (key === today) return time(date);
  return shortDay(date);
}

export function dueLabel(value: string | null) {
  if (!value) return "Tarih yok";
  const key = dayKey(value);
  if (key === dayKey(new Date())) return `Bugün ${time(value)}`;
  if (key === dayKey(new Date(Date.now() + 86_400_000))) return `Yarın ${time(value)}`;
  if (key === dayKey(new Date(Date.now() - 86_400_000))) return "Dün";
  return shortDay(value);
}

export function greeting(date = new Date()) {
  const hour = Number(hourFormat.format(date));
  if (hour < 5) return "İyi geceler";
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase("tr"))
    .join("");
}

export function plural(count: number, word: string) {
  return `${count.toLocaleString("tr-TR")} ${word}`;
}

export function bytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10_240 ? 1 : 0)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size < 1024 ** 4) return `${(size / 1024 ** 3).toFixed(1)} GB`;
  return `${(size / 1024 ** 4).toFixed(2)} TB`;
}
