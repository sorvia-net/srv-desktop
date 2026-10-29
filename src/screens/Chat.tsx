import { Hash, Lock, MessagesSquare, Pin, SendHorizonal } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { ChatChannel, ChatMessage } from "@shared/contracts";
import { api } from "@/data/api";
import { dayKey, fullDay, time } from "@/data/format";
import { invalidate, setQueryData, useQuery } from "@/data/query";
import { Avatar, Button, cn, Empty, ErrorNote, Skeleton } from "@/design/ui";
import { useSession } from "@/shell/context";

export function Chat() {
  const channels = useQuery<ChatChannel[]>("chat:channels", () => api.channels(), { refreshMs: 30_000 });
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!active && channels.data?.[0]) setActive(channels.data[0].id);
  }, [channels.data, active]);

  const current = channels.data?.find((item) => item.id === active) ?? null;

  return (
    <div className="grid h-full min-h-0 grid-cols-[260px_minmax(0,1fr)] gap-6">
      <aside className="flex min-h-0 flex-col">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Ekip</h1>
        <p className="mb-5 mt-1 text-[14px] text-ink-2">Ekip kanalları</p>
        {channels.error && !channels.data ? <ErrorNote message={channels.error} onRetry={channels.refresh} /> : null}
        <div className="scroll-area space-y-1">
          {channels.loading && Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-11" />)}
          {(channels.data ?? []).map((item) => (
            <button key={item.id} onClick={() => setActive(item.id)} className={cn("focus-ring flex h-11 w-full items-center gap-2.5 rounded-[14px] px-3 text-[14px] transition-colors", active === item.id ? "bg-white/[0.12] text-ink" : "text-ink-2 hover:bg-white/[0.06]")}>
              {item.isPrivate ? <Lock className="size-4 text-ink-3" /> : <Hash className="size-4 text-ink-3" />}
              <span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
              {item.unread > 0 && <span className="tabular rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-[18px] text-white">{item.unread}</span>}
            </button>
          ))}
          {!channels.loading && (channels.data ?? []).length === 0 && <p className="px-3 text-[13px] text-ink-3">Görebildiğin kanal yok.</p>}
        </div>
      </aside>
      <section className="glass-card flex min-h-0 flex-col overflow-hidden rounded-[26px]">{current ? <Channel channel={current} /> : <Empty icon={<MessagesSquare />} title="Kanal seç" />}</section>
    </div>
  );
}

function Channel({ channel }: { channel: ChatChannel }) {
  const session = useSession();
  const key = `chat:messages:${channel.id}`;
  const messages = useQuery<ChatMessage[]>(key, () => api.messages(channel.id), { refreshMs: 8_000 });
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length, channel.id]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const result = await api.postMessage(channel.id, text);
    setSending(false);
    if (!result.ok) {
      session.toast(result.message, "bad");
      return;
    }
    setBody("");
    setQueryData<ChatMessage[]>(key, (list) => [...(list ?? []), result.data]);
    invalidate("chat:channels");
  };

  const list = messages.data ?? [];
  const pinned = list.filter((item) => item.pinned);
  let lastDay = "";

  return (
    <>
      <header className="flex items-center gap-3 border-b border-white/8 px-7 py-4">
        <span className="icon-ring flex size-10 items-center justify-center rounded-full text-ink">{channel.isPrivate ? <Lock className="size-4" /> : <Hash className="size-4" />}</span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-ink">{channel.name}</h2>
          {channel.topic && <p className="truncate text-[12.5px] text-ink-3">{channel.topic}</p>}
        </div>
      </header>
      {pinned.length > 0 && (
        <div className="flex items-center gap-2 border-b border-white/8 bg-accent/[0.07] px-7 py-2 text-[12.5px] text-ink-2">
          <Pin className="size-3.5 text-accent-2" />
          <span className="truncate">{pinned[pinned.length - 1]!.body}</span>
        </div>
      )}
      <div className="scroll-area flex-1 px-7 py-5">
        {messages.loading && <div className="space-y-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
        {!messages.loading && list.length === 0 && <Empty icon={<MessagesSquare />} title="Henüz mesaj yok" body="Kanala ilk mesajı sen yaz." />}
        {list.map((message, index) => {
          const day = dayKey(message.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const previous = list[index - 1];
          const compact = !showDay && previous && previous.author?.id === message.author?.id && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60_000;
          return (
            <div key={message.id}>
              {showDay && (
                <div className="my-4 flex items-center gap-3 text-[11.5px] font-medium capitalize text-ink-4">
                  <span className="h-px flex-1 bg-white/8" />
                  {fullDay(message.createdAt)}
                  <span className="h-px flex-1 bg-white/8" />
                </div>
              )}
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("group flex gap-3 rounded-[14px] px-2 hover:bg-white/[0.04]", compact ? "py-0.5" : "mt-2 py-1.5")}>
                {compact ? <span className="w-9 shrink-0 pt-0.5 text-right text-[10.5px] text-transparent group-hover:text-ink-4">{time(message.createdAt)}</span> : <Avatar name={message.author?.name ?? "?"} src={message.author?.avatarUrl} size={36} />}
                <div className="min-w-0 flex-1">
                  {!compact && (
                    <p className="text-[13px]">
                      <span className="font-semibold text-ink">{message.author?.name ?? "Silinmiş kullanıcı"}</span>
                      <span className="ml-2 text-[11.5px] text-ink-4">{time(message.createdAt)}</span>
                    </p>
                  )}
                  <p className="selectable whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">{message.body}</p>
                </div>
              </motion.div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <footer className="border-t border-white/8 p-4">
        <div className="flex items-end gap-2 rounded-[22px] bg-black/25 p-2 pl-4 ring-1 ring-white/10 focus-within:ring-accent/60">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={`#${channel.name} kanalına yaz`}
            className="selectable max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-4"
          />
          <Button variant="accent" size="icon" aria-label="Gönder" loading={sending} disabled={!body.trim()} onClick={() => void send()}>
            {!sending && <SendHorizonal />}
          </Button>
        </div>
      </footer>
    </>
  );
}
