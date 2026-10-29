import { Bot, Building2, Inbox, LifeBuoy, Lock, Search, Send, Tag } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { TicketDetail, TicketStatus, TicketSummary } from "@shared/contracts";
import { api, type TicketScope } from "@/data/api";
import { relative, time } from "@/data/format";
import { invalidate, setQueryData, useQuery } from "@/data/query";
import { Avatar, Button, cn, Empty, ErrorNote, Pill, PRIORITY_LABEL, PRIORITY_TONE, Segmented, Skeleton, Switch } from "@/design/ui";
import { useNav, useSession } from "@/shell/context";

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: "accent" | "soft" | "ok" | "warn" | "bad" | "info" }> = {
  OPEN: { label: "Yeni", tone: "accent" },
  PENDING_STAFF: { label: "Yanıt bekliyor", tone: "warn" },
  PENDING_CUSTOMER: { label: "Müşteride", tone: "info" },
  ON_HOLD: { label: "Beklemede", tone: "soft" },
  RESOLVED: { label: "Çözüldü", tone: "ok" },
  CLOSED: { label: "Kapalı", tone: "soft" },
  ARCHIVED: { label: "Arşiv", tone: "soft" },
};

function normalize(value: string) {
  return value.toLocaleLowerCase("tr");
}

export function Tickets() {
  const nav = useNav();
  const session = useSession();
  const [scope, setScope] = useState<TicketScope>("mine");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(nav.route.params?.id ?? null);
  const list = useQuery<TicketSummary[]>(`tickets:${scope}`, () => api.tickets(scope), { refreshMs: 45_000 });

  useEffect(() => {
    if (nav.route.params?.id) setSelected(nav.route.params.id);
  }, [nav.route.params]);

  const items = useMemo(() => {
    const all = list.data ?? [];
    if (!query.trim()) return all;
    const needle = normalize(query);
    return all.filter((item) => normalize(`${item.number} ${item.subject} ${item.requester}`).includes(needle));
  }, [list.data, query]);

  useEffect(() => {
    if (!selected && items[0]) setSelected(items[0].id);
  }, [items, selected]);

  const scopes: { value: TicketScope; label: string }[] = [
    { value: "mine", label: "Bana atanan" },
    { value: "waiting", label: "Yanıt bekleyen" },
    ...(session.can("tickets.assign") || session.user.role === "SUPPORT" ? [{ value: "open" as TicketScope, label: "Açık" }] : []),
  ];

  return (
    <div className="grid h-full min-h-0 grid-cols-[380px_minmax(0,1fr)] gap-6">
      <section className="flex min-h-0 flex-col">
        <header className="mb-5">
          <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Destek</h1>
          <p className="mt-1 text-[14px] text-ink-2">{list.data ? `${list.data.length} talep` : "Yükleniyor…"}</p>
        </header>
        <Segmented<TicketScope> value={scope} onChange={(value) => { setScope(value); setSelected(null); }} options={scopes} />
        <label className="mt-3 flex h-10 items-center gap-2.5 rounded-full bg-black/25 px-4 ring-1 ring-white/8 focus-within:ring-accent/60">
          <Search className="size-4 text-ink-3" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Numara, konu ya da müşteri" className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4" />
        </label>
        <div className="scroll-area -mr-2 mt-4 min-h-0 flex-1 space-y-2 pr-2">
          {list.error && !list.data ? <ErrorNote message={list.error} onRetry={list.refresh} /> : null}
          {list.loading && Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-[86px] rounded-[20px]" />)}
          {!list.loading && items.length === 0 && <div className="glass-card rounded-[22px]"><Empty icon={<Inbox />} title="Talep yok" body="Bu görünümde bekleyen bir destek talebi bulunmuyor." /></div>}
          {items.map((item) => (
            <button key={item.id} onClick={() => setSelected(item.id)} className={cn("focus-ring block w-full rounded-[20px] px-4 py-3.5 text-left transition-colors", selected === item.id ? "glass-strip" : "glass-card hover:bg-white/[0.07]")}>
              <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
                <span className="tabular font-semibold text-ink-2">{item.number}</span>
                <span className={cn("size-1.5 rounded-full", item.priority === "URGENT" ? "bg-bad" : item.priority === "HIGH" ? "bg-warn" : "bg-white/30")} />
                <span className="truncate">{item.requester}</span>
                <span className="ml-auto shrink-0">{relative(item.lastMessageAt)}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[14px] font-medium leading-snug text-ink">{item.subject}</p>
              <div className="mt-2.5 flex items-center gap-1.5">
                <Pill tone={TICKET_STATUS[item.status].tone}>{TICKET_STATUS[item.status].label}</Pill>
                {item.department && <span className="truncate text-[11.5px] text-ink-3">{item.department}</span>}
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="glass-card min-h-0 overflow-hidden rounded-[26px]">
        {selected ? <TicketView id={selected} scopeKey={`tickets:${scope}`} /> : <Empty icon={<LifeBuoy />} title="Bir talep seç" body="Soldaki listeden bir talep seçtiğinde yazışma burada açılır." />}
      </section>
    </div>
  );
}

function TicketView({ id, scopeKey }: { id: string; scopeKey: string }) {
  const session = useSession();
  const ticket = useQuery<TicketDetail>(`ticket:${id}`, () => api.ticket(id), { refreshMs: 30_000 });
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const canReply = session.can("tickets.reply");

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ticket.data?.messages.length]);

  if (ticket.loading) return <div className="space-y-4 p-7"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  if (!ticket.data) return <div className="p-7"><ErrorNote message={ticket.error ?? "Talep açılamadı."} onRetry={ticket.refresh} /></div>;
  const data = ticket.data;

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    const result = await api.replyTicket(id, body.trim(), internal);
    setSending(false);
    if (!result.ok) {
      session.toast(result.message, "bad");
      return;
    }
    setBody("");
    setQueryData<TicketDetail>(`ticket:${id}`, () => result.data);
    invalidate(scopeKey);
    invalidate("home");
    session.toast(internal ? "İç not eklendi" : "Yanıt gönderildi", "ok");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/8 px-7 pb-5 pt-6">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
          <span className="tabular font-semibold text-ink-2">{data.number}</span>
          <Pill tone={TICKET_STATUS[data.status].tone}>{TICKET_STATUS[data.status].label}</Pill>
          <Pill tone={PRIORITY_TONE[data.priority]}>{PRIORITY_LABEL[data.priority]}</Pill>
          {data.source === "discord" && <Pill tone="info">Discord</Pill>}
        </div>
        <h2 className="mt-3 text-[22px] font-semibold leading-snug tracking-[-0.01em] text-ink">{data.subject}</h2>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-3">
          <span className="flex items-center gap-1.5"><Avatar name={data.requester} size={20} /> {data.requester}</span>
          {data.department && <span className="flex items-center gap-1.5"><Building2 className="size-3.5" /> {data.department}</span>}
          {data.productRef && <span className="flex items-center gap-1.5"><Tag className="size-3.5" /> {data.productRef}</span>}
          <span>Açıldı {relative(data.createdAt)}</span>
        </div>
      </header>
      <div className="scroll-area flex-1 space-y-4 px-7 py-6">
        {data.messages.map((message, index) => {
          const mine = message.isStaff;
          return (
            <motion.div key={message.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 6) * 0.03 }} className={cn("flex gap-3", mine && "flex-row-reverse")}>
              {message.isAi ? (
                <span className="accent-fill flex size-9 shrink-0 items-center justify-center rounded-full"><Bot className="size-[18px]" /></span>
              ) : (
                <Avatar name={message.author} src={message.avatarUrl} size={36} />
              )}
              <div className={cn("max-w-[72%]", mine && "text-right")}>
                <p className="mb-1 text-[11.5px] text-ink-3">
                  {message.author} · {time(message.createdAt)}
                  {message.isInternal && <span className="ml-1.5 inline-flex items-center gap-1 text-warn"><Lock className="size-3" /> İç not</span>}
                </p>
                <div
                  className={cn(
                    "selectable whitespace-pre-wrap rounded-[20px] px-4 py-3 text-left text-[13.5px] leading-relaxed",
                    message.isInternal ? "border border-dashed border-warn/45 bg-warn/[0.08] text-[#ffe5b4]" : mine ? "bg-[linear-gradient(180deg,rgba(255,138,42,0.28),rgba(255,106,13,0.2))] text-ink ring-1 ring-accent/30" : "bg-white/[0.08] text-ink ring-1 ring-white/8",
                    mine ? "rounded-tr-md" : "rounded-tl-md",
                  )}
                >
                  {message.body}
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottom} />
      </div>
      {canReply ? (
        <footer className="border-t border-white/8 p-4">
          <div className={cn("rounded-[22px] bg-black/25 p-3 ring-1 transition-colors", internal ? "ring-warn/50" : "ring-white/10 focus-within:ring-accent/60")}>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.ctrlKey) void send();
              }}
              rows={3}
              placeholder={internal ? "Yalnız ekibin göreceği bir not yaz…" : `${data.requester} için yanıt yaz…`}
              className="selectable w-full resize-none bg-transparent px-1 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink-4"
            />
            <div className="mt-2 flex items-center gap-3">
              <span className="flex items-center gap-2 text-[12px] text-ink-3">
                <Switch checked={internal} onChange={setInternal} label="İç not" /> İç not
              </span>
              <span className="ml-auto text-[11.5px] text-ink-4">Ctrl + Enter</span>
              <Button variant="accent" size="sm" loading={sending} disabled={!body.trim()} onClick={() => void send()}>
                {!sending && <Send />} {internal ? "Not ekle" : "Gönder"}
              </Button>
            </div>
          </div>
        </footer>
      ) : (
        <footer className="border-t border-white/8 px-7 py-4 text-[12.5px] text-ink-3">Bu talebe yanıt verme yetkin yok.</footer>
      )}
    </div>
  );
}
