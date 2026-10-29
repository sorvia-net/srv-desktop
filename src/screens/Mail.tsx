import { Archive, ArrowLeft, Check, ChevronsUpDown, Plus, Forward, ImageOff, Inbox, Lock, Mail as MailIcon, MailOpen, Paperclip, PenSquare, Reply, Search, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import type { MailAccountInfo, MailFolder, MailMessage, MailSummary } from "@shared/contracts";
import { isPreview, mailApi } from "@/data/api";
import { bridge } from "@/data/bridge";
import { bytes, relative } from "@/data/format";
import { invalidate, setQueryData, useQuery } from "@/data/query";
import { Avatar, Button, cn, Empty, ErrorNote, Skeleton, Spinner } from "@/design/ui";
import { useNav, useOverlay, useSession } from "@/shell/context";

const FOLDER_ICON: Record<string, React.ReactNode> = {
  INBOX: <Inbox className="size-4" />,
  Sent: <Send className="size-4" />,
  Drafts: <PenSquare className="size-4" />,
  Archive: <Archive className="size-4" />,
  Trash: <Trash2 className="size-4" />,
  Junk: <ShieldCheck className="size-4" />,
};

export function Mail() {
  const nav = useNav();
  const [adding, setAdding] = useState(false);
  const account = useQuery<MailAccountInfo | null>("mail:account", () => mailApi.account());
  useEffect(() => {
    if (nav.route.params?.add) setAdding(true);
  }, [nav.route.params]);
  if (account.loading) return <div className="flex h-full items-center justify-center"><Spinner className="size-6" /></div>;
  if (!account.data || adding) {
    return (
      <ConnectMail
        another={Boolean(account.data)}
        onCancel={account.data ? () => setAdding(false) : undefined}
        onConnected={() => {
          setAdding(false);
          invalidate("mail:");
        }}
      />
    );
  }
  return <MailClient key={account.data.id} account={account.data} onAdd={() => setAdding(true)} />;
}

function ConnectMail({ onConnected, onCancel, another = false }: { onConnected: () => void; onCancel?: () => void; another?: boolean }) {
  const session = useSession();
  const suggested = !another && session.user.email.endsWith("@sorvia.net") ? session.user.email : "";
  const [address, setAddress] = useState(suggested);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    const result = await bridge.mail.connect({ address: address.trim(), password, name: session.user.name });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPassword("");
    session.toast("Posta hesabı bağlandı", "ok");
    onConnected();
  };

  return (
    <div className="flex h-full items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-card w-[460px] rounded-[30px] p-8">
        <span className="flex size-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#9cc8ff] via-[#5a95f0] to-[#2f62c9] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <MailIcon className="size-7" />
        </span>
        <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-ink">{another ? "Başka bir hesap ekle" : "Sorvia Mail"}</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">Kurumsal posta kutunu bağla. Bağlantı doğrudan mail.sorvia.net ile kurulur; parolan yalnızca bu bilgisayarda, Windows hesabına bağlı şifreleme ile saklanır.</p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <input value={address} onChange={(event) => setAddress(event.target.value)} type="email" required placeholder="ad@sorvia.net" className="h-12 w-full rounded-2xl bg-black/30 px-4 text-[14px] text-ink outline-none ring-1 ring-white/10 placeholder:text-ink-4 focus:ring-accent/70" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required placeholder="Posta parolası" className="h-12 w-full rounded-2xl bg-black/30 px-4 text-[14px] text-ink outline-none ring-1 ring-white/10 placeholder:text-ink-4 focus:ring-accent/70" />
          {error && <p className="rounded-xl bg-bad/12 px-3 py-2 text-[12.5px] text-[#ffc5cf]">{error}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full" loading={busy} disabled={!address || !password}>
            {!busy && <Lock />} Bağlan
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
              Vazgeç
            </Button>
          )}
        </form>
        <p className="mt-5 text-[11.5px] leading-relaxed text-ink-4">IMAP 993 (SSL) ve SMTP 465 kullanılır. Bağlantıyı istediğin an Ayarlar'dan kaldırabilirsin.</p>
      </motion.div>
    </div>
  );
}

function MailClient({ account, onAdd }: { account: MailAccountInfo; onAdd: () => void }) {
  const overlay = useOverlay();
  const session = useSession();
  const [folder, setFolder] = useState("INBOX");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const folders = useQuery<MailFolder[]>("mail:folders", () => mailApi.folders(), { refreshMs: 120_000 });
  const listKey = `mail:list:${folder}:${search}`;
  const list = useQuery<{ total: number; messages: MailSummary[] }>(listKey, () => (search && !isPreview() ? bridge.mail.search(folder, search) : mailApi.list(folder, 0)), { refreshMs: 90_000 });

  useEffect(() => {
    if (isPreview()) return;
    return bridge.mail.onNewMail(() => {
      invalidate("mail:list:INBOX");
      invalidate("mail:folders");
    });
  }, []);

  const messages = useMemo(() => {
    const all = list.data?.messages ?? [];
    if (!search || !isPreview()) return all;
    const needle = search.toLocaleLowerCase("tr");
    return all.filter((item) => `${item.subject} ${item.from.name} ${item.preview}`.toLocaleLowerCase("tr").includes(needle));
  }, [list.data, search]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[210px_360px_minmax(0,1fr)] gap-5">
      <aside className="flex min-h-0 flex-col">
        <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink">Mail</h1>
        <Button variant="accent" className="mt-4 w-full" onClick={() => overlay.setCompose({})}>
          <PenSquare /> Yeni ileti
        </Button>
        <nav className="mt-5 space-y-1">
          {folders.loading && Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-9" />)}
          {(folders.data ?? []).map((item) => (
            <button key={item.path} onClick={() => { setFolder(item.path); setSelected(null); }} className={cn("focus-ring flex h-10 w-full items-center gap-3 rounded-[14px] px-3 text-[13.5px] transition-colors", folder === item.path ? "bg-white/[0.12] text-ink" : "text-ink-2 hover:bg-white/[0.06]")}>
              <span className={cn(folder === item.path ? "text-accent-2" : "text-ink-3")}>{FOLDER_ICON[item.role ?? ""] ?? <MailOpen className="size-4" />}</span>
              <span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
              {item.unread > 0 && <span className="tabular rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-[18px] text-white">{item.unread}</span>}
            </button>
          ))}
        </nav>
        <AccountSwitcher account={account} onAdd={onAdd} />
      </aside>
      <section className="flex min-h-0 flex-col">
        <form
          className="flex h-10 items-center gap-2.5 rounded-full bg-black/25 px-4 ring-1 ring-white/8 focus-within:ring-accent/60"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(query.trim());
          }}
        >
          <Search className="size-4 text-ink-3" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value) setSearch(""); }} placeholder="Postalarda ara" className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4" />
        </form>
        <div className="scroll-area -mr-2 mt-4 min-h-0 flex-1 space-y-1.5 pr-2">
          {list.error && !list.data ? <ErrorNote message={list.error} onRetry={list.refresh} /> : null}
          {list.loading && Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[76px] rounded-[18px]" />)}
          {!list.loading && messages.length === 0 && <Empty icon={<Inbox />} title={search ? "Sonuç yok" : "Klasör boş"} />}
          {messages.map((item) => (
            <button
              key={`${item.folder}-${item.uid}`}
              onClick={() => {
                setSelected(item.uid);
                if (item.seen) return;
                setQueryData<{ total: number; messages: MailSummary[] }>(listKey, (current) => (current ? { ...current, messages: current.messages.map((entry) => (entry.uid === item.uid ? { ...entry, seen: true } : entry)) } : current!));
                window.setTimeout(() => invalidate("mail:folders"), 1500);
              }}
              className={cn("focus-ring block w-full rounded-[18px] px-4 py-3 text-left transition-colors", selected === item.uid ? "glass-strip" : "hover:bg-white/[0.06]")}>
              <div className="flex items-center gap-2">
                {!item.seen && <span className="size-2 shrink-0 rounded-full bg-accent" />}
                <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", item.seen ? "text-ink-2" : "font-semibold text-ink")}>{item.from.name || item.from.address}</span>
                <span className={cn("shrink-0 text-[11.5px]", selected === item.uid ? "text-ink-2" : "text-ink-4")}>{relative(item.date)}</span>
              </div>
              <p className={cn("mt-1 truncate text-[13px]", item.seen ? "text-ink-2" : "text-ink")}>{item.subject || "(Konu yok)"}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-ink-3">
                {item.hasAttachments && <Paperclip className="size-3 shrink-0" />}
                <span className="truncate">{item.preview}</span>
              </p>
            </button>
          ))}
        </div>
      </section>
      <section className="glass-card min-h-0 overflow-hidden rounded-[26px]">
        {selected === null ? (
          <Empty icon={<MailOpen />} title="Bir ileti seç" body="Okumak istediğin postayı soldaki listeden seç." />
        ) : (
          <Reader
            folder={folder}
            uid={selected}
            onBack={() => setSelected(null)}
            onReply={(message) => overlay.setCompose({ to: message.from.address, subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`, text: `\n\n— ${message.from.name || message.from.address} yazdı:\n${(message.text ?? "").split("\n").map((line) => `> ${line}`).join("\n")}`, inReplyTo: message.messageId })}
            onForward={(message) => overlay.setCompose({ subject: `İlt: ${message.subject}`, text: `\n\n— İletilen ileti —\nKimden: ${message.from.name} <${message.from.address}>\nKonu: ${message.subject}\n\n${message.text ?? ""}` })}
            onMoved={() => {
              setSelected(null);
              invalidate("mail:");
              session.toast("İleti taşındı", "ok");
            }}
          />
        )}
      </section>
      <Compose />
    </div>
  );
}

function Reader({ folder, uid, onBack, onReply, onForward, onMoved }: { folder: string; uid: number; onBack: () => void; onReply: (message: MailMessage) => void; onForward: (message: MailMessage) => void; onMoved: () => void }) {
  const session = useSession();
  const message = useQuery<MailMessage>(`mail:read:${folder}:${uid}`, () => mailApi.read(folder, uid));
  const [images, setImages] = useState(false);

  useEffect(() => {
    if (message.data && !isPreview()) invalidate("mail:folders");
  }, [message.data?.uid]);

  if (message.loading) return <div className="space-y-4 p-7"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-64" /></div>;
  if (!message.data) return <div className="p-7"><ErrorNote message={message.error ?? "İleti açılamadı."} onRetry={message.refresh} /></div>;
  const data = message.data;

  const move = async (target: "Archive" | "Trash") => {
    if (isPreview()) {
      session.toast("Önizlemede ileti taşınmaz", "info");
      return;
    }
    const result = await bridge.mail.move(folder, uid, target);
    if (!result.ok) session.toast(result.message, "bad");
    else onMoved();
  };

  const allowRemote = images || session.prefs.showRemoteImages;
  const html = data.html ? frameDocument(data.html, allowRemote || !data.remoteImages) : null;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/8 px-7 pb-5 pt-6">
        <div className="flex items-center gap-1.5">
          <button onClick={onBack} aria-label="Listeye dön" className="mr-1 flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink 2xl:hidden"><ArrowLeft className="size-4" /></button>
          <Button size="sm" variant="glass" onClick={() => onReply(data)}><Reply /> Yanıtla</Button>
          <Button size="sm" variant="glass" onClick={() => onForward(data)}><Forward /> İlet</Button>
          <span className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => void move("Archive")}><Archive /> Arşivle</Button>
            <Button size="sm" variant="ghost" onClick={() => void move("Trash")}><Trash2 /> Sil</Button>
          </span>
        </div>
        <h2 className="selectable mt-4 text-[21px] font-semibold leading-snug tracking-[-0.01em] text-ink">{data.subject || "(Konu yok)"}</h2>
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={data.from.name || data.from.address} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-ink">{data.from.name || data.from.address} <span className="font-normal text-ink-3">&lt;{data.from.address}&gt;</span></p>
            <p className="truncate text-[12px] text-ink-3">Kime: {data.to.map((item) => item.name || item.address).join(", ")}{data.cc.length ? ` · Bilgi: ${data.cc.map((item) => item.address).join(", ")}` : ""}</p>
          </div>
          <span className="shrink-0 text-[12px] text-ink-3">{new Date(data.date).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
      </header>
      {data.remoteImages && !allowRemote && (
        <div className="flex items-center gap-3 border-b border-white/8 bg-warn/[0.07] px-7 py-2.5 text-[12.5px] text-[#ffdca0]">
          <ImageOff className="size-4" /> Gizliliğin için dış görseller engellendi.
          <button onClick={() => setImages(true)} className="ml-auto font-semibold text-white hover:underline">Görselleri göster</button>
        </div>
      )}
      <div className="scroll-area flex-1 p-5">
        {html ? (
          <iframe title="İleti" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={html} className="mail-frame h-full min-h-[480px] w-full border-0" />
        ) : (
          <pre className="selectable whitespace-pre-wrap px-2 font-sans text-[14px] leading-relaxed text-ink">{data.text}</pre>
        )}
        {data.attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.attachments.map((item) => (
              <button
                key={item.id}
                onClick={async () => {
                  if (isPreview()) {
                    session.toast("Önizlemede ek indirilmez", "info");
                    return;
                  }
                  const result = await bridge.mail.saveAttachment(data.folder, data.uid, item.id);
                  if (!result.ok) session.toast(result.message, "bad");
                  else if (result.data) session.toast(`${item.filename} kaydedildi`, "ok");
                }}
                className="focus-ring flex items-center gap-2 rounded-full bg-white/[0.08] px-3.5 py-2 text-[12.5px] text-ink-2 ring-1 ring-white/10 transition-colors hover:bg-white/[0.13] hover:text-ink"
              >
                <Paperclip className="size-3.5" /> {item.filename} <span className="text-ink-4">{bytes(item.size)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function frameDocument(html: string, remote: boolean) {
  const policy = `default-src 'none'; img-src data: cid:${remote ? " https: http:" : ""}; style-src 'unsafe-inline'; font-src data:;`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><base target="_blank"><style>body{margin:0;padding:24px;font:14px/1.6 "Segoe UI",system-ui,sans-serif;color:#1d1916;background:#fbf8f5;word-break:break-word}img{max-width:100%;height:auto}a{color:#c2510a}blockquote{border-left:3px solid #e6d6c8;margin:0;padding-left:12px;color:#5c524a}</style></head><body>${html}</body></html>`;
}

function Compose() {
  const overlay = useOverlay();
  const session = useSession();
  const draft = overlay.compose;
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setTo(draft.to ?? "");
    setCc("");
    setSubject(draft.subject ?? "");
    setText(draft.text ?? "");
  }, [draft]);

  const send = async () => {
    if (isPreview()) {
      session.toast("Önizlemede posta gönderilmez", "info");
      return;
    }
    setSending(true);
    const result = await bridge.mail.send({ to, cc, subject, text, inReplyTo: draft?.inReplyTo ?? null });
    setSending(false);
    if (!result.ok) {
      session.toast(result.message, "bad");
      return;
    }
    session.toast("İleti gönderildi", "ok");
    overlay.setCompose(null);
    invalidate("mail:");
  };

  return (
    <AnimatePresence>
      {draft && (
        <motion.div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/45 pb-10 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => overlay.setCompose(null)}>
          <motion.div
            role="dialog"
            aria-label="Yeni ileti"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="glass-sheet flex h-[min(620px,78vh)] w-[min(760px,92vw)] flex-col rounded-[30px]"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") overlay.setCompose(null);
              if (event.key === "Enter" && event.ctrlKey) void send();
            }}
          >
            <span className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20" />
            <header className="flex items-center justify-between px-7 pb-2 pt-3">
              <h2 className="text-[17px] font-semibold text-ink">Yeni ileti</h2>
              <button onClick={() => overlay.setCompose(null)} aria-label="Kapat" className="flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink"><X className="size-4" /></button>
            </header>
            <div className="divide-y divide-white/8 border-y border-white/8 px-7">
              <Row label="Kime"><input autoFocus value={to} onChange={(event) => setTo(event.target.value)} placeholder="ad@ornek.com" className="h-11 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4" /></Row>
              <Row label="Bilgi"><input value={cc} onChange={(event) => setCc(event.target.value)} className="h-11 w-full bg-transparent text-[14px] text-ink outline-none" /></Row>
              <Row label="Konu"><input value={subject} onChange={(event) => setSubject(event.target.value)} className="h-11 w-full bg-transparent text-[14px] font-medium text-ink outline-none" /></Row>
            </div>
            <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="İletini yaz…" className="selectable flex-1 resize-none bg-transparent px-7 py-4 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-4" />
            <footer className="flex items-center gap-3 px-7 pb-5">
              <span className="text-[11.5px] text-ink-4">Ctrl + Enter ile gönder</span>
              <Button variant="accent" className="ml-auto" loading={sending} disabled={!to.trim() || !subject.trim()} onClick={() => void send()}>
                {!sending && <Send />} Gönder
              </Button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-4">
      <span className="w-12 shrink-0 text-[12.5px] text-ink-3">{label}</span>
      {children}
    </label>
  );
}

function AccountSwitcher({ account, onAdd }: { account: MailAccountInfo; onAdd: () => void }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const accounts = useQuery<MailAccountInfo[]>("mail:accounts", async () => ({ ok: true, data: isPreview() ? [account] : await bridge.mail.accounts() }));
  const others = (accounts.data ?? []).filter((item) => item.id !== account.id);

  const switchTo = async (item: MailAccountInfo) => {
    setOpen(false);
    await bridge.mail.switchAccount(item.id);
    invalidate("mail:");
    session.toast(`Posta: ${item.address}`, "ok");
  };

  return (
    <div className="relative mt-auto">
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="glass-float absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-[18px] p-1.5">
            {[account, ...others].map((item) => (
              <button key={item.id} onClick={() => (item.id === account.id ? setOpen(false) : void switchTo(item))} className="flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left hover:bg-white/[0.08]">
                <Avatar name={item.name || item.address} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-ink">{item.name}</span>
                  <span className="block truncate text-[11px] text-ink-3">{item.address}</span>
                </span>
                {item.id === account.id && <Check className="size-4 text-accent-2" />}
              </button>
            ))}
            <button
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
              className="mt-1 flex w-full items-center gap-2.5 rounded-[12px] border-t border-white/[0.08] px-2.5 py-2.5 text-left text-[12.5px] text-ink-2 hover:bg-white/[0.08]"
            >
              <Plus className="size-4" /> Hesap ekle
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2.5 rounded-[18px] bg-white/[0.05] p-3 text-left ring-1 ring-white/8 hover:bg-white/[0.08]">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-ink">{account.address}</span>
          <span className="mt-0.5 block text-[11px] text-ink-3">{account.lastError ? <span className="text-bad">{account.lastError}</span> : others.length ? `${others.length + 1} hesap · değiştir` : `${account.imapHost} · bağlı`}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-3" />
      </button>
    </div>
  );
}
