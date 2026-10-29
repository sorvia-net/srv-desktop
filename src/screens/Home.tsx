import { ArrowRight, Bell, CalendarDays, ChevronDown, Clock3, Inbox, LifeBuoy, ListChecks, Mail, MoreVertical, Plus, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import type { CalendarEvent, HomeSummary } from "@shared/contracts";
import { api } from "@/data/api";
import { fullDay, greeting, isToday, relative, time } from "@/data/format";
import { useQuery } from "@/data/query";
import { LineChart } from "@/design/chart";
import { ActionCircle, Avatar, cn, ErrorNote, Pill, Progress, Ring, SectionTitle, Skeleton } from "@/design/ui";
import { useNav, useOverlay, useSession } from "@/shell/context";

const rise = (index: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.05 * index, ease: [0.16, 1, 0.3, 1] as const } });

export function Home() {
  const session = useSession();
  const home = useQuery<HomeSummary>("home", () => api.home(), { refreshMs: 60_000 });
  const data = home.data;

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_340px] gap-8 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="scroll-area fade-bottom -mr-3 min-h-0 pb-10 pr-3">
        <motion.header {...rise(0)} className="mb-6">
          <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">My Sorvia</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            {greeting()}, {data?.greetingName ?? session.user.name.split(" ")[0]} · <span className="capitalize">{fullDay(new Date())}</span>
          </p>
        </motion.header>

        {home.error && !data ? <ErrorNote message={home.error} onRetry={home.refresh} /> : null}

        <motion.div {...rise(1)}>
          <StatStrip data={data} />
        </motion.div>

        <motion.section {...rise(2)} className="mt-7">
          <Rhythm data={data} />
        </motion.section>

        <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <motion.section {...rise(3)}>
            <Boards data={data} />
          </motion.section>
          <motion.section {...rise(4)}>
            <Support data={data} />
          </motion.section>
        </div>
      </div>

      <aside className="scroll-area fade-bottom -mr-3 flex min-h-0 flex-col gap-6 pb-10 pr-3">
        <motion.div {...rise(1)}>
          <ProfileCard data={data} />
        </motion.div>
        <motion.section {...rise(3)}>
          <Today agenda={data?.agenda} loading={home.loading} />
        </motion.section>
      </aside>
    </div>
  );
}

function StatStrip({ data }: { data?: HomeSummary }) {
  const nav = useNav();
  const overlay = useOverlay();
  const stats = [
    { label: "Açık görev", value: data?.counts.openTasks, sub: data ? (data.counts.overdueTasks ? `${data.counts.overdueTasks} gecikmiş` : `${data.counts.dueToday} bugün`) : "", icon: <ListChecks className="size-[19px]" />, onClick: () => nav.go("tasks") },
    { label: "Bekleyen talep", value: data?.counts.waitingTickets, sub: data ? `${data.counts.myTickets} bana atanmış` : "", icon: <LifeBuoy className="size-[19px]" />, onClick: () => nav.go("tickets") },
    { label: "Okunmamış bildirim", value: data?.counts.unreadNotifications, sub: data ? `${data.counts.meetingsToday} görüşme bugün` : "", icon: <Bell className="size-[19px]" />, onClick: () => overlay.open("notifications") },
  ];
  return (
    <div className="glass-strip grid grid-cols-3 divide-x divide-white/10 rounded-[20px] py-4">
      {stats.map((item) => (
        <button key={item.label} onClick={item.onClick} className="focus-ring group flex items-center gap-3.5 px-6 text-left outline-none">
          <span className="icon-ring flex size-[46px] shrink-0 items-center justify-center rounded-full text-ink transition-transform duration-300 group-hover:scale-105">{item.icon}</span>
          <span className="min-w-0">
            <span className="block text-[12.5px] text-ink-2">{item.label}</span>
            {data ? <span className="tabular block text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">{item.value}</span> : <Skeleton className="mt-1 h-6 w-12" />}
            <span className="block truncate text-[11.5px] text-ink-3">{item.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Rhythm({ data }: { data?: HomeSummary }) {
  const [mode, setMode] = useState<"all" | "replies" | "tasks">("all");
  const [open, setOpen] = useState(false);
  const activity = data?.activity ?? [];
  const labels = activity.map((item) => item.week);
  const series = [
    ...(mode !== "tasks" ? [{ name: "Yanıtlar", color: "#ff8a2a", values: activity.map((item) => item.replies) }] : []),
    ...(mode !== "replies" ? [{ name: "Görevler", color: "#f3e7dc", values: activity.map((item) => item.tasksDone), dashedFrom: activity.length > 1 ? activity.length - 2 : undefined }] : []),
  ];
  const modes = { all: "Tümü", replies: "Talep yanıtları", tasks: "Tamamlanan görevler" } as const;

  return (
    <>
      <SectionTitle
        action={
          <div className="relative">
            <button onClick={() => setOpen((value) => !value)} className="focus-ring flex h-9 items-center gap-2 rounded-full border border-white/40 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-white/8">
              {modes[mode]} <ChevronDown className="size-4" />
            </button>
            {open && (
              <div className="glass-float absolute right-0 top-11 z-20 w-52 rounded-2xl p-1.5">
                {(Object.keys(modes) as (keyof typeof modes)[]).map((key) => (
                  <button key={key} onClick={() => { setMode(key); setOpen(false); }} className={cn("block w-full rounded-xl px-3 py-2 text-left text-[13px]", key === mode ? "bg-white/12 text-ink" : "text-ink-2 hover:bg-white/8")}>
                    {modes[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      >
        Çalışma ritmi
      </SectionTitle>
      <div className="glass-card rounded-[24px] px-7 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[16px] font-semibold text-ink">Haftalık tempo</h3>
            <p className="mt-1.5 text-[13.5px] text-ink-2">Son altı haftada yanıtladığın talepler ve bitirdiğin görevler</p>
          </div>
          <div className="space-y-1.5 text-right text-[11.5px] font-medium text-ink-2">
            <p className="flex items-center justify-end gap-2">Talep yanıtları <span className="size-2 rounded-full bg-accent" /></p>
            <p className="flex items-center justify-end gap-2">Tamamlanan görevler <span className="size-2 rounded-full bg-[#f3e7dc]" /></p>
          </div>
        </div>
        <div className="mt-2">
          {data ? activity.some((item) => item.replies + item.tasksDone > 0) ? <LineChart series={series} labels={labels} height={150} format={(value) => `${value}`} /> : <p className="py-14 text-center text-[13px] text-ink-3">Henüz yeterli etkinlik yok.</p> : <Skeleton className="mt-6 h-[180px] w-full" />}
        </div>
      </div>
    </>
  );
}

function Boards({ data }: { data?: HomeSummary }) {
  const nav = useNav();
  const overlay = useOverlay();
  const boards = (data?.boards ?? []).filter((item) => item.total > 0).slice(0, 3);
  return (
    <>
      <SectionTitle>Panolarım</SectionTitle>
      <div className="glass-card relative rounded-[24px] p-5">
        <div className="grid grid-cols-2 gap-4">
          {!data && Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-[118px]" />)}
          {data && boards.length === 0 && <p className="col-span-2 py-8 text-center text-[13px] text-ink-3">Henüz görev panon yok. İlk görevini ekle.</p>}
          {boards.slice(0, 2).map((item) => {
            const ratio = item.total ? item.done / item.total : 0;
            return (
              <button key={item.board} onClick={() => nav.go("tasks", { board: item.board })} className="focus-ring glass-soft group rounded-[18px] px-4 pb-4 pt-5 text-center outline-none transition-transform duration-300 hover:-translate-y-0.5">
                <span className="tabular block text-[26px] font-semibold tracking-[-0.02em] text-ink">%{Math.round(ratio * 100)}</span>
                <Progress value={ratio} className="mx-auto mt-2.5 w-[82%]" />
                <span className="mt-3 block truncate text-[12.5px] font-medium text-ink-2">{item.board}</span>
                <span className="block text-[11px] text-ink-4">{item.done}/{item.total} görev</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => overlay.open("quickTask")} aria-label="Yeni görev" className="focus-ring absolute -bottom-3 left-4 flex size-9 items-center justify-center rounded-full bg-[#f5efe9] text-[#2a211b] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.7)] transition-transform hover:scale-105 active:scale-95">
          <Plus className="size-5" strokeWidth={2.4} />
        </button>
      </div>
    </>
  );
}

function Support({ data }: { data?: HomeSummary }) {
  const nav = useNav();
  const support = data?.support;
  const ratio = support && support.total ? support.answered / support.total : 0;
  return (
    <>
      <SectionTitle>Destek</SectionTitle>
      <button onClick={() => nav.go("tickets")} className="focus-ring glass-card block w-full rounded-[24px] p-5 text-left outline-none">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-ink">Yanıt hedefi</h3>
          <span className="rounded-lg border border-accent/70 px-2.5 py-1 text-[12px] font-semibold text-accent-2">
            {support?.averageFirstReplyMinutes != null ? `İlk yanıt ~${support.averageFirstReplyMinutes} dk` : "İlk yanıt —"}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-ink-2">Bu hafta yanıtlanan</p>
            {support ? (
              <p className="tabular mt-1 text-[17px] font-semibold text-ink">
                <span className="text-accent-2">{support.answered}</span> / {support.total} talep
              </p>
            ) : (
              <Skeleton className="mt-2 h-5 w-24" />
            )}
            <Progress value={ratio} className="mt-3 w-[80%]" />
          </div>
          <Ring value={ratio} size={88} />
        </div>
      </button>
    </>
  );
}

function ProfileCard({ data }: { data?: HomeSummary }) {
  const session = useSession();
  const nav = useNav();
  const overlay = useOverlay();
  const [menu, setMenu] = useState(false);
  const user = session.user;
  const waiting = data?.counts.waitingTickets ?? 0;
  const todayCount = data ? data.counts.dueToday + data.counts.meetingsToday : null;
  return (
    <div className="glass-card relative rounded-[26px] px-5 pb-6 pt-5">
      <div className="flex items-start justify-between">
        <button onClick={() => overlay.open("notifications")} aria-label="Bildirimler" className="focus-ring relative flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-white/8 hover:text-ink">
          <Bell className="size-[19px]" />
          {(data?.counts.unreadNotifications ?? 0) > 0 && <span className="absolute right-[7px] top-[6px] size-2 rounded-full bg-[#ff3b30]" />}
        </button>
        <div className="relative">
          <button onClick={() => setMenu((value) => !value)} aria-label="Menü" className="focus-ring flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-white/8 hover:text-ink">
            <MoreVertical className="size-[18px]" />
          </button>
          {menu && (
            <div className="glass-float absolute right-0 top-10 z-20 w-44 rounded-2xl p-1.5" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => nav.go("settings")} className="block w-full rounded-xl px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-white/8 hover:text-ink">Ayarlar</button>
              <button onClick={session.logout} className="block w-full rounded-xl px-3 py-2 text-left text-[13px] text-bad hover:bg-white/8">{session.preview ? "Önizlemeden çık" : "Oturumu kapat"}</button>
            </div>
          )}
        </div>
      </div>
      <div className="-mt-4 flex flex-col items-center">
        <span className="relative">
          <span className="absolute -inset-3 rounded-full bg-accent/25 blur-xl" />
          <Avatar name={user.name} src={user.avatarUrl} size={78} className="relative ring-[3px] ring-white/15" />
          <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1d1714]/90 px-2 py-[3px] text-[11px] font-medium text-ink ring-1 ring-white/10">{user.roleLabel} ekibi</span>
        </span>
        <p className="mt-5 text-[18px] font-medium tracking-[-0.01em] text-ink">{user.name}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{user.title ?? user.email}</p>
      </div>
      <div className="mt-5 flex justify-between px-1">
        <ActionCircle icon={<Plus />} label="Görev" onClick={() => overlay.open("quickTask")} />
        <ActionCircle icon={<LifeBuoy />} label="Talepler" badge={waiting} onClick={() => nav.go("tickets")} />
        <ActionCircle icon={<Mail />} label="E-posta" onClick={() => nav.go("mail")} />
        <ActionCircle icon={<CalendarDays />} label="Takvim" onClick={() => nav.go("calendar")} />
      </div>
      <StaffCard name={user.name} role={user.roleLabel} since={user.memberSince} today={todayCount} />
    </div>
  );
}

function StaffCard({ name, role, since, today }: { name: string; role: string; since: string; today: number | null }) {
  const sinceLabel = new Intl.DateTimeFormat("tr-TR", { month: "2-digit", year: "2-digit" }).format(new Date(since));
  return (
    <div className="relative mt-6 pb-4">
      <span className="absolute inset-x-6 bottom-0 h-8 rounded-b-[18px] bg-white/[0.07]" />
      <span className="absolute inset-x-3 bottom-2 h-8 rounded-b-[18px] bg-white/[0.11]" />
      <div
        className="relative h-[152px] overflow-hidden rounded-[18px] p-5 text-white shadow-[0_18px_40px_-16px_rgba(255,110,20,0.65)]"
        style={{ background: "radial-gradient(circle at 62% 62%, #ff2d2d 0%, rgba(255,45,45,0) 34%), radial-gradient(circle at 92% 40%, #ff8a1f 0%, rgba(255,138,31,0) 40%), linear-gradient(118deg, #ffd23d 0%, #ffb322 34%, #ff7a1a 64%, #ffb03a 100%)" }}
      >
        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.32),transparent_42%)]" />
        <div className="relative flex items-start justify-between">
          <span className="text-[16px] font-semibold tracking-[-0.01em] drop-shadow-[0_1px_2px_rgba(120,40,0,0.35)]">{name.split(" ")[0]}</span>
          <span className="text-[25px] font-black italic tracking-[-0.03em] drop-shadow-[0_1px_2px_rgba(120,40,0,0.35)]">Sorvia</span>
        </div>
        <div className="relative mt-7 flex items-end justify-between">
          <span>
            <span className="block text-[11px] font-medium text-white/80">{role} · üyelik</span>
            <span className="tabular block text-[19px] font-semibold">{sinceLabel}</span>
          </span>
          <span className="text-right">
            <span className="block text-[11px] font-medium text-white/80">Bugün</span>
            <span className="tabular block text-[23px] font-bold tracking-[-0.02em]">{today === null ? "—" : `${today} iş`}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

const KIND_ICON = { meeting: <CalendarDays className="size-[18px]" />, task: <ListChecks className="size-[18px]" />, reminder: <Clock3 className="size-[18px]" /> };

function Today({ agenda, loading }: { agenda?: CalendarEvent[]; loading: boolean }) {
  const nav = useNav();
  const items = (agenda ?? []).slice(0, 3);
  return (
    <>
      <SectionTitle>Ajanda</SectionTitle>
      <div className="space-y-3">
        {loading && <Skeleton className="h-[92px]" />}
        {!loading && items.length === 0 && (
          <div className="glass-card flex items-center gap-3 rounded-[22px] px-5 py-5 text-[13px] text-ink-3">
            <Inbox className="size-5" /> Yaklaşan bir şey yok. Rahat bir gün.
          </div>
        )}
        {items.map((item) => (
          <button key={item.id} onClick={() => nav.go(item.kind === "task" ? "tasks" : "calendar")} className="focus-ring glass-card flex w-full items-center gap-3.5 rounded-[22px] px-4 py-4 text-left outline-none transition-transform duration-300 hover:-translate-y-0.5">
            <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", item.kind === "meeting" ? "bg-[#f4efe9] text-[#2a211b]" : "icon-ring text-ink")}>{KIND_ICON[item.kind]}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-medium text-ink">{item.title}</span>
              <span className="mt-1 block text-[12px] text-ink-3">{isToday(item.startsAt) ? "Bugün" : relative(item.startsAt)}{item.detail ? ` · ${item.detail}` : ""}</span>
            </span>
            <Pill>{time(item.startsAt)}</Pill>
          </button>
        ))}
        <button onClick={() => nav.go("calendar")} className="focus-ring glass-card flex w-full items-center justify-between rounded-[20px] px-5 py-3.5 text-[14px] font-medium text-ink outline-none transition-colors hover:bg-white/[0.06]">
          Tüm ajandayı gör
          <span className="flex size-8 items-center justify-center rounded-full bg-[#f5efe9] text-[#2a211b]">
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </span>
        </button>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-[11.5px] text-ink-4">
          <Sparkles className="size-3" /> Görüşmeler, görev tarihleri ve hatırlatmalar
        </p>
      </div>
    </>
  );
}
