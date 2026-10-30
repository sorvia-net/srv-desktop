import {
  ArrowRight, Bell, CalendarDays, Check, CheckCheck, CornerDownLeft, LifeBuoy, ListChecks, LogOut, Mail, MessagesSquare, Plus, RefreshCw, Search, Settings, Sparkles, X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AppNotification, Priority, Task, TicketSummary } from "@shared/contracts";
import { routeForNotification } from "@shared/routes";
import { api } from "@/data/api";
import { relative } from "@/data/format";
import { invalidate, useQuery } from "@/data/query";
import { Button, cn, Kbd, PRIORITY_LABEL, Segmented, Spinner } from "@/design/ui";

import { useNav, useOverlay, useSession } from "./context";
import { Tile } from "@/os/icons";
import { useModules, useCatalog } from "@/os/modules";
import { available, launchLink } from "@/os/registry";
import { useOs } from "@/os/state";

const spring = { type: "spring" as const, stiffness: 420, damping: 34 };

function normalize(value: string) {
  return value.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
}

function matches(text: string, query: string) {
  const haystack = normalize(text);
  return normalize(query).split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}

type PaletteItem = { id: string; group: string; title: string; hint?: string; icon: ReactNode; run: () => void };

export function CommandPalette() {
  const overlay = useOverlay();
  const nav = useNav();
  const session = useSession();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const os = useOs();
  const { installed } = useModules();
  const catalog = useCatalog();
  const tasks = useQuery<Task[]>("tasks:mine", () => api.tasks("mine"), { enabled: overlay.palette && installed.has("tasks") });
  const tickets = useQuery<TicketSummary[]>("tickets:mine", () => api.tickets("mine"), { enabled: overlay.palette && installed.has("tickets") });

  useEffect(() => {
    if (overlay.palette) {
      setQuery("");
      setActive(0);
      window.setTimeout(() => input.current?.focus(), 30);
    }
  }, [overlay.palette]);

  const items = useMemo<PaletteItem[]>(() => {
    const done = (run: () => void) => () => {
      overlay.close();
      run();
    };
    const apps = catalog
      .filter((item) => installed.has(item.id) && available(item, session.user))
      .map<PaletteItem>((item) => ({
        id: `m-${item.id}`,
        group: item.kind === "app" ? "Uygulamalar" : "Bağlantılar",
        title: item.title,
        hint: item.subtitle,
        icon: <Tile item={item} size={22} className="shadow-none" />,
        run: done(() => (item.kind === "app" ? os.openApp(item.id) : launchLink(item, (url) => os.openApp("web", { link: item.id, url, title: item.title, at: String(Date.now()) })))),
      }));
    const store = catalog
      .filter((item) => !installed.has(item.id) && available(item, session.user))
      .map<PaletteItem>((item) => ({
        id: `s-${item.id}`,
        group: "Mağaza",
        title: `${item.title} yükle`,
        hint: item.subtitle,
        icon: <Tile item={item} size={22} className="shadow-none" />,
        run: done(() => os.openApp("store", { module: item.id })),
      }));
    const modules = [...apps, ...store];
    const actions: PaletteItem[] = [
      { id: "a-task", group: "Eylemler", title: "Yeni görev oluştur", hint: "Ctrl N", icon: <Plus className="size-4" />, run: () => overlay.open("quickTask") },
      ...(session.user.modules.includes("mail") ? [{ id: "a-mail", group: "Eylemler", title: "E-posta yaz", icon: <Mail className="size-4" />, run: done(() => { nav.go("mail"); overlay.setCompose({}); }) }] : []),
      { id: "a-notes", group: "Eylemler", title: "Bildirimleri göster", icon: <Bell className="size-4" />, run: () => overlay.open("notifications") },
      { id: "a-home", group: "Eylemler", title: "Ana ekrana dön", hint: "Ctrl H", icon: <Sparkles className="size-4" />, run: done(os.goHome) },
      { id: "a-lock", group: "Eylemler", title: "Ekranı kilitle", hint: "Ctrl L", icon: <LogOut className="size-4" />, run: done(os.lock) },
      { id: "a-refresh", group: "Eylemler", title: "Her şeyi yenile", icon: <RefreshCw className="size-4" />, run: done(() => invalidate("")) },
      { id: "a-settings", group: "Eylemler", title: "Ayarları aç", hint: "Ctrl ,", icon: <Settings className="size-4" />, run: done(() => nav.go("settings")) },
      { id: "a-logout", group: "Eylemler", title: session.preview ? "Önizlemeden çık" : "Oturumu kapat", icon: <LogOut className="size-4" />, run: done(session.logout) },
    ];
    const taskItems = (tasks.data ?? []).filter((item) => item.status !== "done").map<PaletteItem>((item) => ({
      id: `t-${item.id}`,
      group: "Görevler",
      title: item.title,
      hint: item.board,
      icon: <ListChecks className="size-4" />,
      run: done(() => nav.go("tasks", { id: item.id })),
    }));
    const ticketItems = (tickets.data ?? []).map<PaletteItem>((item) => ({
      id: `k-${item.id}`,
      group: "Destek",
      title: `${item.number} · ${item.subject}`,
      hint: item.requester,
      icon: <LifeBuoy className="size-4" />,
      run: done(() => nav.go("tickets", { id: item.id })),
    }));
    const all = [...modules, ...actions, ...taskItems, ...ticketItems];
    if (!query.trim()) return [...apps.slice(0, 6), ...actions.slice(0, 3), ...taskItems.slice(0, 3), ...ticketItems.slice(0, 2)];
    return all.filter((item) => matches(`${item.title} ${item.hint ?? ""} ${item.group}`, query)).slice(0, 14);
  }, [query, tasks.data, tickets.data, session, nav, overlay, os, installed, catalog]);

  useEffect(() => setActive(0), [query]);

  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(items.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[active]?.run();
    } else if (event.key === "Escape") {
      overlay.close();
    }
  };

  let lastGroup = "";
  return (
    <AnimatePresence>
      {overlay.palette && (
        <motion.div className="fixed inset-0 z-[70] flex justify-center bg-black/35 pt-[13vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={overlay.close}>
          <motion.div
            role="dialog"
            aria-label="Arama"
            className="glass-float h-fit w-[640px] max-w-[calc(100vw-48px)] overflow-hidden rounded-[26px]"
            initial={{ opacity: 0, scale: 0.94, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={spring}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/8 px-5">
              <Search className="size-5 text-ink-3" />
              <input
                ref={input}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKey}
                placeholder="Uygulama, görev, talep ya da komut ara…"
                className="h-[60px] flex-1 bg-transparent text-[18px] text-ink outline-none placeholder:text-ink-4"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div className="scroll-area max-h-[420px] p-2">
              {items.length === 0 && <p className="px-4 py-8 text-center text-[13.5px] text-ink-3">"{query}" için sonuç yok.</p>}
              {items.map((item, index) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <div key={item.id}>
                    {header && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">{header}</p>}
                    <button
                      onMouseMove={() => setActive(index)}
                      onClick={item.run}
                      className={cn("flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[13.5px] transition-colors", index === active ? "bg-white/[0.11] text-ink" : "text-ink-2")}
                    >
                      <span className={cn("flex size-8 items-center justify-center rounded-[10px]", index === active ? "accent-fill" : "bg-white/8 text-ink-2")}>{item.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.hint && <span className="shrink-0 text-[12px] text-ink-3">{item.hint}</span>}
                      {index === active && <CornerDownLeft className="size-4 shrink-0 text-ink-3" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-white/8 px-5 py-2.5 text-[11.5px] text-ink-3">
              <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> seç</span>
              <span className="flex items-center gap-1.5"><Kbd>Enter</Kbd> aç</span>
              <span className="ml-auto">Her yerden: <Kbd>Ctrl</Kbd> <Kbd>Shift</Kbd> <Kbd>Space</Kbd></span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const NOTE_ICON: Record<string, ReactNode> = {
  ticket: <LifeBuoy className="size-4" />,
  task: <ListChecks className="size-4" />,
  meeting: <CalendarDays className="size-4" />,
  chat: <MessagesSquare className="size-4" />,
  mail: <Mail className="size-4" />,
  career: <Sparkles className="size-4" />,
};

export function NotificationCenter() {
  const overlay = useOverlay();
  const nav = useNav();
  const session = useSession();
  const notes = useQuery<AppNotification[]>("notifications", () => api.notifications(), { refreshMs: 60_000 });
  const list = notes.data ?? [];
  const unread = list.filter((item) => !item.readAt).length;

  const markAll = async () => {
    const result = await api.readNotifications("all");
    if (!result.ok) session.toast(result.message, "bad");
    invalidate("notifications");
    invalidate("home");
  };

  const openNote = async (item: AppNotification) => {
    if (!item.readAt) {
      await api.readNotifications([item.id]);
      invalidate("notifications");
      invalidate("home");
    }
    const target = routeForNotification(item);
    nav.go(target.screen, target.id ? { id: target.id } : undefined);
    overlay.close();
  };

  return (
    <AnimatePresence>
      {overlay.notifications && (
        <motion.div className="fixed inset-0 z-[55]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={overlay.close}>
          <motion.aside
            className="glass-sheet absolute bottom-4 right-4 top-[50px] flex w-[400px] flex-col overflow-hidden rounded-[28px]"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 30, opacity: 0 }}
            transition={spring}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-center gap-3 px-6 pb-3 pt-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-[20px] font-semibold text-ink">Bildirimler</h2>
                <p className="text-[12.5px] text-ink-3">{unread ? `${unread} okunmamış` : "Hepsi okundu"}</p>
              </div>
              {unread > 0 && (
                <Button size="sm" variant="ghost" onClick={() => void markAll()}>
                  <CheckCheck /> Tümü okundu
                </Button>
              )}
              <button onClick={overlay.close} aria-label="Kapat" className="flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink">
                <X className="size-4" />
              </button>
            </header>
            <div className="scroll-area flex-1 px-3 pb-4">
              {notes.loading && Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton mx-2 my-2 h-[68px]" />)}
              {!notes.loading && list.length === 0 && <p className="px-4 py-16 text-center text-[13.5px] text-ink-3">Henüz bildirim yok.</p>}
              {list.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => void openNote(item)}
                  className="group flex w-full items-start gap-3 rounded-[18px] px-3 py-3 text-left transition-colors hover:bg-white/[0.07]"
                >
                  <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", item.readAt ? "bg-white/8 text-ink-3" : "accent-fill")}>
                    {NOTE_ICON[item.type.split(".")[0] ?? ""] ?? <Bell className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={cn("truncate text-[13.5px]", item.readAt ? "text-ink-2" : "font-semibold text-ink")}>{item.title}</span>
                      <span className="ml-auto shrink-0 text-[11.5px] text-ink-4">{relative(item.createdAt)}</span>
                    </span>
                    {item.body && <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-relaxed text-ink-3">{item.body}</span>}
                  </span>
                  {!item.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
                </motion.button>
              ))}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const BOARDS = ["Destek", "Web", "Eklentiler", "Dokümanlar", "Genel"];

export function QuickTask() {
  const overlay = useOverlay();
  const session = useSession();
  const [title, setTitle] = useState("");
  const [board, setBoard] = useState("Genel");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (overlay.quickTask) {
      setTitle("");
      setDue("");
      setPriority("NORMAL");
    }
  }, [overlay.quickTask]);

  const save = async () => {
    if (title.trim().length < 2) return;
    setSaving(true);
    const result = await api.createTask({ title: title.trim(), board, priority, dueAt: due ? new Date(due).toISOString() : null });
    setSaving(false);
    if (!result.ok) {
      session.toast(result.message, "bad");
      return;
    }
    session.toast("Görev eklendi", "ok");
    invalidate("tasks");
    invalidate("home");
    overlay.close();
  };

  return (
    <AnimatePresence>
      {overlay.quickTask && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/45 pt-[16vh] backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={overlay.close}>
          <motion.div
            role="dialog"
            aria-label="Yeni görev"
            className="glass-sheet w-[520px] max-w-[calc(100vw-48px)] rounded-[28px] p-6"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={spring}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") overlay.close();
              if (event.key === "Enter" && (event.ctrlKey || !event.shiftKey)) void save();
            }}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="accent-fill flex size-10 items-center justify-center rounded-full">
                <Plus className="size-5" />
              </span>
              <div>
                <h2 className="text-[18px] font-semibold text-ink">Yeni görev</h2>
                <p className="text-[12.5px] text-ink-3">Sana atanır; panoyu ve önceliği seç.</p>
              </div>
            </div>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ne yapılacak?" className="h-12 w-full rounded-2xl bg-black/30 px-4 text-[15px] text-ink outline-none ring-1 ring-white/10 placeholder:text-ink-4 focus:ring-accent/70" />
            <p className="mb-2 mt-5 text-[12px] font-medium text-ink-3">Pano</p>
            <div className="flex flex-wrap gap-2">
              {BOARDS.map((item) => (
                <button key={item} onClick={() => setBoard(item)} className={cn("h-8 rounded-full px-3.5 text-[12.5px] font-medium transition-colors", board === item ? "accent-fill" : "bg-white/8 text-ink-2 hover:bg-white/12")}>
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-[12px] font-medium text-ink-3">Öncelik</p>
                <Segmented<Priority> size="sm" value={priority} onChange={setPriority} options={(["LOW", "NORMAL", "HIGH", "URGENT"] as Priority[]).map((value) => ({ value, label: PRIORITY_LABEL[value]! }))} />
              </div>
              <label className="block">
                <span className="mb-2 block text-[12px] font-medium text-ink-3">Son tarih</span>
                <input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} className="h-8 rounded-full bg-black/30 px-3 text-[12.5px] text-ink outline-none ring-1 ring-white/10 [color-scheme:dark] focus:ring-accent/70" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={overlay.close}>
                Vazgeç
              </Button>
              <Button variant="accent" loading={saving} disabled={title.trim().length < 2} onClick={() => void save()}>
                {!saving && <Check />} Ekle
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toasts() {
  const session = useSession();
  const position = session.prefs.toastPosition ?? "bottom-center";
  const top = position.startsWith("top");
  const place = {
    "top-left": "top-14 left-6 items-start",
    "top-center": "top-14 left-1/2 -translate-x-1/2 items-center",
    "top-right": "top-14 right-6 items-end",
    "bottom-left": "bottom-6 left-6 items-start",
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2 items-center",
    "bottom-right": "bottom-6 right-6 items-end",
  }[position];
  return (
    <div className={cn("pointer-events-none fixed z-[90] flex flex-col gap-2", top && "flex-col-reverse", place)}>
      <AnimatePresence>
        {session.toasts.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: top ? -16 : 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: top ? -8 : 8, scale: 0.98 }}
            transition={spring}
            className="glass-float flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-medium text-ink"
          >
            <span className={cn("size-2 rounded-full", item.tone === "ok" ? "bg-ok" : item.tone === "bad" ? "bg-bad" : "bg-accent")} />
            {item.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function PreviewBanner({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="no-drag pointer-events-auto absolute left-1/2 top-[50px] z-[61] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-warn/30 bg-[#3a2b12]/80 px-4 py-1.5 text-[12px] text-[#ffd58a] shadow-[0_8px_24px_-10px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <span className="size-1.5 rounded-full bg-warn" />
        Önizleme modu · gösterilen veriler örnektir, gerçek değildir
        <button onClick={onConnect} className="flex items-center gap-1 font-semibold text-white hover:underline">
          Bağlan <ArrowRight className="size-3" />
        </button>
      </div>
    </div>
  );
}

export function Busy() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="size-6" />
    </div>
  );
}
