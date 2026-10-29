import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ListChecks, Video } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

import type { CalendarEvent } from "@shared/contracts";
import { api } from "@/data/api";
import { dayKey, fullDay, isToday, time } from "@/data/format";
import { useQuery } from "@/data/query";
import { Button, cn, Empty, ErrorNote, Pill, Segmented, Skeleton } from "@/design/ui";
import { useNav } from "@/shell/context";

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
const KIND_STYLE: Record<CalendarEvent["kind"], { chip: string; icon: React.ReactNode; label: string }> = {
  meeting: { chip: "bg-accent/85 text-white", icon: <Video className="size-4" />, label: "Görüşme" },
  task: { chip: "bg-white/85 text-[#2a211b]", icon: <ListChecks className="size-4" />, label: "Görev" },
  reminder: { chip: "bg-info/80 text-[#0b1a29]", icon: <Clock3 className="size-4" />, label: "Hatırlatma" },
};

function startOfMonthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), 1 - offset);
}

function startOfWeek(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

export function Calendar() {
  const nav = useNav();
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dayKey(new Date()));

  const range = useMemo(() => {
    if (view === "week") {
      const from = startOfWeek(cursor);
      return { from, days: Array.from({ length: 7 }, (_, index) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + index)) };
    }
    const from = startOfMonthGrid(cursor);
    return { from, days: Array.from({ length: 42 }, (_, index) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + index)) };
  }, [view, cursor]);

  const to = new Date(range.days[range.days.length - 1]!.getTime() + 86_400_000);
  const key = `calendar:${range.from.toISOString()}:${to.toISOString()}`;
  const events = useQuery<CalendarEvent[]>(key, () => api.calendar(range.from.toISOString(), to.toISOString()), { refreshMs: 120_000 });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const item of events.data ?? []) {
      const list = map.get(dayKey(item.startsAt)) ?? [];
      list.push(item);
      map.set(dayKey(item.startsAt), list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [events.data]);

  const shift = (direction: number) => {
    setCursor((current) => (view === "week" ? new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7 * direction) : new Date(current.getFullYear(), current.getMonth() + direction, 1)));
  };

  const selectedEvents = byDay.get(selected) ?? [];
  const upcoming = (events.data ?? []).filter((item) => new Date(item.startsAt).getTime() >= Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 4);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_330px] gap-8">
      <div className="flex min-h-0 flex-col">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-bold capitalize leading-tight tracking-[-0.03em] text-ink">{MONTH.format(cursor)}</h1>
            <p className="mt-1 text-[14px] text-ink-2">Görüşmeler, görev son tarihleri ve hatırlatmalar</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Segmented<"month" | "week"> value={view} onChange={setView} options={[{ value: "month", label: "Ay" }, { value: "week", label: "Hafta" }]} />
            <div className="flex items-center rounded-full bg-black/30 p-1 ring-1 ring-white/8">
              <button onClick={() => shift(-1)} aria-label="Önceki" className="flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-white/10 hover:text-ink"><ChevronLeft className="size-4" /></button>
              <button onClick={() => { setCursor(new Date()); setSelected(dayKey(new Date())); }} className="h-7 rounded-full px-3 text-[12.5px] font-medium text-ink hover:bg-white/10">Bugün</button>
              <button onClick={() => shift(1)} aria-label="Sonraki" className="flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-white/10 hover:text-ink"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        </header>
        {events.error && !events.data ? <ErrorNote message={events.error} onRetry={events.refresh} /> : null}
        <div className="glass-card flex min-h-0 flex-1 flex-col rounded-[26px] p-4">
          <div className="grid grid-cols-7 pb-2">
            {WEEKDAYS.map((item) => (
              <span key={item} className="px-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-4">{item}</span>
            ))}
          </div>
          <div className={cn("grid min-h-0 flex-1 grid-cols-7 gap-1.5", view === "month" ? "grid-rows-6" : "grid-rows-1")}>
            {range.days.map((date) => {
              const key2 = dayKey(date);
              const list = byDay.get(key2) ?? [];
              const outside = view === "month" && date.getMonth() !== cursor.getMonth();
              const active = key2 === selected;
              return (
                <button
                  key={key2}
                  onClick={() => setSelected(key2)}
                  className={cn("focus-ring flex min-h-0 flex-col overflow-hidden rounded-[14px] p-2 text-left transition-colors", active ? "bg-white/[0.11] ring-1 ring-accent/60" : "hover:bg-white/[0.05]", outside && "opacity-40")}
                >
                  <span className={cn("tabular flex size-7 items-center justify-center rounded-full text-[13px] font-semibold", isToday(date) ? "accent-fill" : "text-ink-2")}>{date.getDate()}</span>
                  <span className="mt-1 space-y-1 overflow-hidden">
                    {events.loading && view === "week" && <Skeleton className="h-5 w-full" />}
                    {list.slice(0, view === "week" ? 8 : 2).map((item) => (
                      <span key={item.id} className={cn("block truncate rounded-md px-1.5 py-[2px] text-[11px] font-medium", KIND_STYLE[item.kind].chip)}>
                        {item.allDay ? "" : `${time(item.startsAt)} `}
                        {item.title}
                      </span>
                    ))}
                    {list.length > (view === "week" ? 8 : 2) && <span className="block px-1 text-[10.5px] text-ink-3">+{list.length - (view === "week" ? 8 : 2)} daha</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <aside className="scroll-area -mr-3 flex min-h-0 flex-col gap-6 pr-3">
        <section>
          <h2 className="mb-1 text-[19px] font-semibold capitalize text-ink">{fullDay(new Date(`${selected}T12:00:00`))}</h2>
          <p className="mb-4 text-[12.5px] text-ink-3">{selectedEvents.length ? `${selectedEvents.length} kayıt` : "Bu gün boş"}</p>
          <div className="space-y-3">
            {selectedEvents.length === 0 && <div className="glass-card rounded-[22px]"><Empty icon={<CalendarDays />} title="Plan yok" body="Seçili günde görüşme, görev ya da hatırlatma bulunmuyor." /></div>}
            {selectedEvents.map((item, index) => (
              <EventRow key={item.id} item={item} index={index} onOpen={() => nav.go(item.kind === "task" ? "tasks" : "calendar")} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-4 text-[19px] font-semibold text-ink">Yaklaşanlar</h2>
          <div className="space-y-3">
            {upcoming.length === 0 && <p className="text-[13px] text-ink-3">Yaklaşan bir kayıt yok.</p>}
            {upcoming.map((item, index) => (
              <EventRow key={item.id} item={item} index={index} onOpen={() => setSelected(dayKey(item.startsAt))} showDay />
            ))}
          </div>
        </section>
        <Button variant="glass" className="mt-auto self-start" onClick={() => nav.go("tasks")}>
          <ListChecks /> Görevlere git
        </Button>
      </aside>
    </div>
  );
}

function EventRow({ item, index, onOpen, showDay }: { item: CalendarEvent; index: number; onOpen: () => void; showDay?: boolean }) {
  const style = KIND_STYLE[item.kind];
  return (
    <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} onClick={onOpen} className="focus-ring glass-card flex w-full items-center gap-3.5 rounded-[22px] px-4 py-3.5 text-left">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", item.kind === "meeting" ? "bg-[#f4efe9] text-[#2a211b]" : "icon-ring text-ink")}>{style.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{item.title}</span>
        <span className="mt-0.5 block text-[12px] text-ink-3">{style.label}{showDay ? ` · ${new Date(item.startsAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}` : ""}{item.detail ? ` · ${item.detail}` : ""}</span>
      </span>
      <Pill tone={item.kind === "meeting" ? "accent" : "soft"}>{item.allDay ? "Gün boyu" : time(item.startsAt)}</Pill>
    </motion.button>
  );
}
