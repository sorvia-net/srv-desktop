import { Download, FileText, Hash, Lock, MessagesSquare, Mic, Paperclip, Pencil, Pin, PinOff, Reply, SendHorizonal, Smile, Square, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { ChatAttachment, ChatChannel, ChatMessage } from "@shared/contracts";
import { api } from "@/data/api";
import { bridge } from "@/data/bridge";
import { bytes as formatBytes, dayKey, fullDay, time } from "@/data/format";
import { invalidate, setQueryData, useQuery } from "@/data/query";
import { Avatar, Button, cn, Empty, Skeleton } from "@/design/ui";
import { useSession } from "@/shell/context";
import { ask } from "@/shell/ask";

const QUICK = ["👍", "❤️", "😂", "🔥", "🎉", "👀"];
const EMOJI_GROUPS: { title: string; items: string[] }[] = [
  { title: "Sık kullanılan", items: ["😀", "😂", "🥹", "😍", "😎", "🤔", "😅", "😭", "😡", "🥳", "👍", "👎", "🙏", "👏", "🔥", "❤️", "💯", "🎉", "✅", "❌", "👀", "🚀", "💀", "🤝"] },
  { title: "Yüzler", items: ["😁", "😆", "😊", "🙂", "😉", "😌", "😜", "🤪", "😏", "😴", "🤯", "😬", "🙄", "😤", "🥺", "😱", "🤗", "🤫", "🤭", "😇", "🤓", "🧐", "😷", "🤒"] },
  { title: "El ve kalp", items: ["👋", "✌️", "🤞", "👌", "🤌", "💪", "🫡", "🫶", "💔", "💙", "💚", "💛", "🧡", "💜", "🖤", "🤍"] },
  { title: "Nesneler", items: ["☕", "🍕", "🍔", "🍺", "🎮", "🎧", "💻", "📱", "📌", "📎", "📝", "📅", "⏰", "💡", "🐛", "🛠️", "📦", "💰", "🏆", "⭐"] },
];

type Draft = { attachment: ChatAttachment; local?: string };

function useRecorder(onDone: (blob: Blob, seconds: number) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started.current) / 1000)), 250);
    return () => clearInterval(timer);
  }, [recording]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const media = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunks.current = [];
      cancelled.current = false;
      media.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (!cancelled.current && chunks.current.length) onDone(new Blob(chunks.current, { type: "audio/webm" }), Math.round((Date.now() - started.current) / 1000));
      };
      media.start(250);
      recorder.current = media;
      started.current = Date.now();
      setSeconds(0);
      setRecording(true);
    } catch {
      return false;
    }
    return true;
  };
  const stop = (cancel = false) => {
    cancelled.current = cancel;
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  };
  return { recording, seconds, start, stop };
}

export function ChannelView({ channel }: { channel: ChatChannel }) {
  const session = useSession();
  const key = `chat:messages:${channel.id}`;
  const messages = useQuery<ChatMessage[]>(key, () => api.messages(channel.id), { refreshMs: 6_000 });
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [uploading, setUploading] = useState(0);
  const [emoji, setEmoji] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showPins, setShowPins] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const me = session.user.id;
  const canManage = session.can("chat.manage") || channel.kind === "dm";

  const recorder = useRecorder((blob, seconds) => {
    void (async () => {
      setUploading((value) => value + 1);
      const result = await api.uploadChat(channel.id, new Uint8Array(await blob.arrayBuffer()), `ses-kaydi-${Date.now()}.webm`, true);
      setUploading((value) => value - 1);
      if (!result.ok) return session.toast(result.message, "bad");
      await post("", [{ ...result.data, duration: seconds }]);
    })();
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length, channel.id]);

  useEffect(() => {
    setReply(null);
    setEditing(null);
    setDrafts([]);
    setBody("");
  }, [channel.id]);

  const upload = async (files: File[]) => {
    for (const file of files.slice(0, 10)) {
      if (file.size > 25 * 1024 * 1024) {
        session.toast(`${file.name} 25 MB'dan büyük`, "bad");
        continue;
      }
      setUploading((value) => value + 1);
      const result = await api.uploadChat(channel.id, new Uint8Array(await file.arrayBuffer()), file.name);
      setUploading((value) => value - 1);
      if (!result.ok) session.toast(result.message, "bad");
      else setDrafts((list) => [...list, { attachment: result.data }]);
    }
  };

  const post = async (text: string, attachments: ChatAttachment[]) => {
    setSending(true);
    const result = await api.postMessage(channel.id, text, { replyToId: reply?.id ?? null, attachments });
    setSending(false);
    if (!result.ok) {
      session.toast(result.message, "bad");
      return false;
    }
    setQueryData<ChatMessage[]>(key, (list) => [...(list ?? []), result.data]);
    invalidate("chat:channels");
    setReply(null);
    return true;
  };

  const send = async () => {
    const text = body.trim();
    if (editing) {
      if (!text) return;
      const result = await api.editMessage(editing.id, text);
      if (!result.ok) return session.toast(result.message, "bad");
      setQueryData<ChatMessage[]>(key, (list) => (list ?? []).map((item) => (item.id === editing.id ? { ...item, body: text, edited: true } : item)));
      setEditing(null);
      setBody("");
      return;
    }
    if (!text && !drafts.length) return;
    if (await post(text, drafts.map((item) => item.attachment))) {
      setBody("");
      setDrafts([]);
    }
  };

  const react = async (message: ChatMessage, value: string) => {
    const result = await api.reactMessage(message.id, value);
    if (!result.ok) return session.toast(result.message, "bad");
    setQueryData<ChatMessage[]>(key, (list) => (list ?? []).map((item) => (item.id === message.id ? { ...item, reactions: result.data.reactions } : item)));
  };

  const remove = async (message: ChatMessage) => {
    if (!(await ask({ title: "Mesaj silinsin mi?", body: "Bu mesaj herkes için silinir ve geri alınamaz.", action: "Sil", danger: true }))) return;
    const result = await api.deleteMessage(message.id);
    if (!result.ok) return session.toast(result.message, "bad");
    setQueryData<ChatMessage[]>(key, (list) => (list ?? []).filter((item) => item.id !== message.id));
  };

  const pin = async (message: ChatMessage) => {
    const result = await api.pinMessage(message.id);
    if (!result.ok) return session.toast(result.message, "bad");
    setQueryData<ChatMessage[]>(key, (list) => (list ?? []).map((item) => (item.id === message.id ? { ...item, pinned: result.data.pinned } : item)));
    session.toast(result.data.pinned ? "Mesaj sabitlendi" : "Sabitleme kaldırıldı", "ok");
  };

  const list = messages.data ?? [];
  const pinned = list.filter((item) => item.pinned);
  let lastDay = "";

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => event.currentTarget === event.target && setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void upload([...event.dataTransfer.files]);
      }}
    >
      <header className="flex items-center gap-3 border-b border-white/8 px-7 py-4">
        {channel.kind === "dm" ? <Avatar name={channel.name} src={channel.avatarUrl} size={40} /> : <span className="icon-ring flex size-10 items-center justify-center rounded-full text-ink">{channel.isPrivate ? <Lock className="size-4" /> : <Hash className="size-4" />}</span>}
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold text-ink">{channel.name}</h2>
          {channel.topic && <p className="truncate text-[12.5px] text-ink-3">{channel.topic}</p>}
        </div>
        <button onClick={() => setShowPins((value) => !value)} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]", showPins ? "bg-accent/20 text-accent-2" : "text-ink-3 hover:bg-white/10")}>
          <Pin className="size-3.5" /> {pinned.length}
        </button>
      </header>
      <AnimatePresence>
        {showPins && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-b border-white/8 bg-accent/[0.06]">
            <div className="max-h-48 space-y-1 overflow-y-auto px-7 py-3">
              {pinned.length === 0 && <p className="text-[12.5px] text-ink-4">Sabitlenmiş mesaj yok.</p>}
              {pinned.map((item) => (
                <div key={item.id} className="flex items-start gap-2 text-[12.5px]">
                  <Pin className="mt-0.5 size-3 shrink-0 text-accent-2" />
                  <span className="font-semibold text-ink">{item.author?.name}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{item.body || (item.attachments?.length ? "📎 Dosya" : "")}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="scroll-area flex-1 px-7 py-5">
        {messages.loading && !messages.data && <div className="space-y-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
        {!messages.loading && list.length === 0 && <Empty icon={<MessagesSquare />} title="Henüz mesaj yok" body="İlk mesajı sen yaz. Dosya sürükleyip bırakabilirsin." />}
        {list.map((message, index) => {
          const day = dayKey(message.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const previous = list[index - 1];
          const compact = !showDay && !message.replyTo && previous && previous.author?.id === message.author?.id && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60_000;
          const mine = message.author?.id === me;
          return (
            <div key={message.id}>
              {showDay && (
                <div className="my-4 flex items-center gap-3 text-[11.5px] font-medium capitalize text-ink-4">
                  <span className="h-px flex-1 bg-white/8" />
                  {fullDay(message.createdAt)}
                  <span className="h-px flex-1 bg-white/8" />
                </div>
              )}
              <div className={cn("group relative flex gap-3 rounded-[14px] px-2 hover:bg-white/[0.04]", compact ? "py-0.5" : "mt-2 py-1.5", message.pinned && "bg-accent/[0.05]")}>
                {compact ? <span className="w-9 shrink-0 pt-0.5 text-right text-[10.5px] text-transparent group-hover:text-ink-4">{time(message.createdAt)}</span> : <Avatar name={message.author?.name ?? "?"} src={message.author?.avatarUrl} size={36} />}
                <div className="min-w-0 flex-1">
                  {message.replyTo && (
                    <p className="mb-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-ink-4">
                      <Reply className="size-3 -scale-x-100" />
                      <span className="font-semibold text-ink-3">{message.replyTo.author?.name ?? "?"}</span>
                      <span className="truncate">{message.replyTo.body || "📎 Dosya"}</span>
                    </p>
                  )}
                  {!compact && (
                    <p className="text-[13px]">
                      <span className="font-semibold text-ink">{message.author?.name ?? "Silinmiş kullanıcı"}</span>
                      <span className="ml-2 text-[11.5px] text-ink-4">{time(message.createdAt)}</span>
                      {message.pinned && <Pin className="ml-1.5 inline size-3 text-accent-2" />}
                    </p>
                  )}
                  {message.body && (
                    <p className="selectable whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink-2">
                      {message.body}
                      {message.edited && <span className="ml-1 text-[10.5px] text-ink-4">(düzenlendi)</span>}
                    </p>
                  )}
                  {(message.attachments ?? []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {message.attachments!.map((file) => (
                        <AttachmentView key={file.url} file={file} onOpen={() => setViewer(file.url)} />
                      ))}
                    </div>
                  )}
                  {Object.keys(message.reactions ?? {}).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {Object.entries(message.reactions ?? {}).map(([value, users]) => (
                        <button key={value} onClick={() => void react(message, value)} className={cn("flex h-6 items-center gap-1 rounded-full px-2 text-[12px] ring-1", users.includes(me) ? "bg-accent/20 text-ink ring-accent/50" : "bg-white/[0.06] text-ink-2 ring-white/10 hover:bg-white/10")}>
                          {value} <span className="tabular text-[11px]">{users.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="absolute -top-3 right-3 hidden items-center gap-0.5 rounded-full bg-[#1f1d1b] px-1 py-0.5 shadow-lg ring-1 ring-white/10 group-hover:flex">
                  {QUICK.slice(0, 4).map((value) => (
                    <button key={value} onClick={() => void react(message, value)} className="flex size-7 items-center justify-center rounded-full text-[14px] hover:bg-white/10">{value}</button>
                  ))}
                  <ActionButton label="Yanıtla" onClick={() => { setReply(message); setEditing(null); input.current?.focus(); }}><Reply className="size-3.5" /></ActionButton>
                  {mine && message.body && <ActionButton label="Düzenle" onClick={() => { setEditing(message); setReply(null); setBody(message.body); input.current?.focus(); }}><Pencil className="size-3.5" /></ActionButton>}
                  {canManage && <ActionButton label={message.pinned ? "Sabitlemeyi kaldır" : "Sabitle"} onClick={() => void pin(message)}>{message.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}</ActionButton>}
                  {(mine || session.can("chat.manage")) && <ActionButton label="Sil" danger onClick={() => void remove(message)}><Trash2 className="size-3.5" /></ActionButton>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <footer className="relative border-t border-white/8 p-4">
        {(reply || editing) && (
          <div className="mb-2 flex items-center gap-2 rounded-[14px] bg-white/[0.06] px-3 py-2 text-[12.5px] text-ink-2">
            {reply ? <Reply className="size-3.5 -scale-x-100 text-accent-2" /> : <Pencil className="size-3.5 text-accent-2" />}
            <span className="min-w-0 flex-1 truncate">{reply ? <><b className="text-ink">{reply.author?.name}</b> kişisine yanıt: {reply.body || "📎 Dosya"}</> : "Mesajı düzenliyorsun"}</span>
            <button onClick={() => { setReply(null); if (editing) { setEditing(null); setBody(""); } }} className="text-ink-4 hover:text-ink"><X className="size-4" /></button>
          </div>
        )}
        {(drafts.length > 0 || uploading > 0) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {drafts.map((draft, index) => (
              <div key={draft.attachment.url} className="relative">
                {draft.attachment.kind === "image" ? <img src={draft.attachment.url} alt="" className="size-16 rounded-[12px] object-cover" /> : <span className="flex h-16 max-w-[180px] items-center gap-2 rounded-[12px] bg-white/[0.07] px-3 text-[12px] text-ink-2"><FileText className="size-4 shrink-0" /><span className="truncate">{draft.attachment.name}</span></span>}
                <button onClick={() => setDrafts((list) => list.filter((_, at) => at !== index))} className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-black/80 text-white"><X className="size-3" /></button>
              </div>
            ))}
            {uploading > 0 && <span className="flex h-16 items-center rounded-[12px] bg-white/[0.05] px-4 text-[12px] text-ink-3">Yükleniyor…</span>}
          </div>
        )}
        {recorder.recording ? (
          <div className="flex items-center gap-3 rounded-[22px] bg-bad/15 p-2 pl-4 ring-1 ring-bad/40">
            <span className="size-2.5 animate-pulse rounded-full bg-bad" />
            <span className="tabular flex-1 text-[13.5px] text-ink">Ses kaydediliyor · {Math.floor(recorder.seconds / 60)}:{String(recorder.seconds % 60).padStart(2, "0")}</span>
            <Button variant="ghost" size="sm" onClick={() => recorder.stop(true)}>Vazgeç</Button>
            <Button variant="accent" size="sm" onClick={() => recorder.stop(false)}><Square className="size-3.5 fill-current" /> Gönder</Button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5 rounded-[22px] bg-black/25 p-2 pl-2 ring-1 ring-white/10 focus-within:ring-accent/60">
            <input ref={filePicker} type="file" multiple hidden onChange={(event) => { void upload([...(event.target.files ?? [])]); event.target.value = ""; }} />
            <ComposerButton label="Dosya, GIF ya da PDF ekle" onClick={() => filePicker.current?.click()}><Paperclip className="size-4" /></ComposerButton>
            <textarea
              ref={input}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onPaste={(event) => {
                const files = [...event.clipboardData.files];
                if (files.length) {
                  event.preventDefault();
                  void upload(files);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
                if (event.key === "Escape") {
                  setReply(null);
                  if (editing) {
                    setEditing(null);
                    setBody("");
                  }
                }
                if (event.key === "ArrowUp" && !body) {
                  const last = [...list].reverse().find((item) => item.author?.id === me && item.body);
                  if (last) {
                    event.preventDefault();
                    setEditing(last);
                    setBody(last.body);
                  }
                }
              }}
              rows={1}
              placeholder={channel.kind === "dm" ? `@${channel.name} kişisine yaz` : `#${channel.name} kanalına yaz`}
              className="selectable max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-4"
            />
            <ComposerButton label="Emoji" active={emoji} onClick={() => setEmoji((value) => !value)}><Smile className="size-4" /></ComposerButton>
            {!body.trim() && !drafts.length && !editing ? (
              <ComposerButton label="Sesli mesaj kaydet" onClick={() => void recorder.start().then((started) => !started && session.toast("Mikrofona erişilemedi", "bad"))}><Mic className="size-4" /></ComposerButton>
            ) : (
              <Button variant="accent" size="icon" aria-label="Gönder" loading={sending} disabled={uploading > 0} onClick={() => void send()}>
                {!sending && <SendHorizonal />}
              </Button>
            )}
          </div>
        )}
        <AnimatePresence>
          {emoji && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-[76px] right-4 z-20 w-[340px] rounded-[20px] bg-[#1f1d1b] p-3 shadow-2xl ring-1 ring-white/10">
              <div className="max-h-72 overflow-y-auto">
                {EMOJI_GROUPS.map((group) => (
                  <div key={group.title} className="mb-2">
                    <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-4">{group.title}</p>
                    <div className="grid grid-cols-8 gap-0.5">
                      {group.items.map((value) => (
                        <button key={value} onClick={() => { setBody((text) => text + value); input.current?.focus(); }} className="flex size-9 items-center justify-center rounded-[10px] text-[20px] hover:bg-white/10">{value}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>

      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-[22px] border-2 border-dashed border-accent bg-accent/10 text-[15px] font-semibold text-ink">
          Göndermek için bırak
        </div>
      )}
      <AnimatePresence>
        {viewer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewer(null)} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-10">
            <img src={viewer} alt="" className="max-h-full max-w-full rounded-[12px] object-contain" />
            <button className="absolute right-6 top-6 flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Kapat"><X className="size-5" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AttachmentView({ file, onOpen }: { file: ChatAttachment; onOpen: () => void }) {
  if (file.kind === "image") return <img src={file.url} alt={file.name} onClick={onOpen} className="max-h-72 max-w-[min(420px,100%)] cursor-zoom-in rounded-[14px] object-contain ring-1 ring-white/10" loading="lazy" />;
  if (file.kind === "audio") return <audio src={file.url} controls preload="metadata" className="h-10 w-72" />;
  if (file.kind === "video") return <video src={file.url} controls preload="metadata" className="max-h-72 max-w-[min(420px,100%)] rounded-[14px]" />;
  return (
    <button onClick={() => void bridge.system.openBrowser(file.url)} className="flex w-72 text-left items-center gap-3 rounded-[14px] bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10 hover:bg-white/[0.1]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent/20 text-accent-2"><FileText className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{file.name}</span>
        <span className="block text-[11.5px] text-ink-4">{formatBytes(file.size)}</span>
      </span>
      <Download className="size-4 text-ink-3" />
    </button>
  );
}

function ActionButton({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={cn("flex size-7 items-center justify-center rounded-full hover:bg-white/10", danger ? "text-bad" : "text-ink-3 hover:text-ink")}>
      {children}
    </button>
  );
}

function ComposerButton({ label, onClick, active = false, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", active ? "bg-accent/20 text-accent-2" : "text-ink-3 hover:bg-white/10 hover:text-ink")}>
      {children}
    </button>
  );
}
