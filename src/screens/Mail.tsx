import { Archive, ArrowLeft, Check, ChevronsUpDown, FileText, Flag, Folder, FolderInput, FolderPlus, Forward, Image as ImageIcon, ImageOff, Inbox, Lock, Mail as MailIcon, MailOpen, MoreHorizontal, Paperclip, PenSquare, Pencil, Plus, Reply, ReplyAll, Save, Search, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ApiResult, MailAccountInfo, MailDraft, MailFolder, MailMessage, MailSummary } from "@shared/contracts";
import { isPreview, mailApi } from "@/data/api";
import { bridge } from "@/data/bridge";
import { bytes, relative } from "@/data/format";
import { invalidate, setQueryData, useQuery } from "@/data/query";
import { Avatar, Button, cn, Empty, ErrorNote, Skeleton, Spinner } from "@/design/ui";
import { ask, askText } from "@/shell/ask";
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

const FLAGGED = "__flagged";

type ListData = { total: number; messages: MailSummary[] };
type MenuItem = { label: string; icon?: React.ReactNode; danger?: boolean; onSelect: () => void } | "sep";
type MenuState = { x: number; y: number; items: MenuItem[] } | null;

/** İmlecin yanında açılan menü; dışarı tıklayınca ya da Esc ile kapanır. */
function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  useEffect(() => {
    if (!menu) return;
    const close = () => onClose();
    const key = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", close);
    };
  }, [menu, onClose]);
  return (
    <AnimatePresence>
      {menu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.12 }}
          onMouseDown={(event) => event.stopPropagation()}
          style={{ left: Math.min(menu.x, window.innerWidth - 240), top: Math.min(menu.y, window.innerHeight - menu.items.length * 36 - 20) }}
          className="glass-float fixed z-[80] w-[220px] origin-top-left overflow-hidden rounded-[16px] p-1.5"
        >
          {menu.items.map((item, index) =>
            item === "sep" ? (
              <div key={index} className="my-1 h-px bg-white/[0.08]" />
            ) : (
              <button
                key={index}
                onClick={() => {
                  onClose();
                  item.onSelect();
                }}
                className={cn("flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] hover:bg-white/[0.09]", item.danger ? "text-bad" : "text-ink")}
              >
                <span className="text-ink-3 [&_svg]:size-4">{item.icon}</span>
                {item.label}
              </button>
            ),
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Klasör seçici: "Taşı" düğmesinden açılır. */
function FolderPicker({ folders, current, onPick, onClose, anchor }: { folders: MailFolder[]; current: string; onPick: (path: string) => void; onClose: () => void; anchor: { x: number; y: number } }) {
  return (
    <ContextMenu
      menu={{
        x: anchor.x,
        y: anchor.y,
        items: folders
          .filter((item) => item.path !== current && item.role !== "Drafts" && item.role !== "Sent")
          .map((item) => ({ label: `${"  ".repeat(item.depth)}${item.name}`, icon: folderIcon(item), onSelect: () => onPick(item.path) })),
      }}
      onClose={onClose}
    />
  );
}

function folderIcon(item: MailFolder) {
  return FOLDER_ICON[item.role ?? ""] ?? <Folder className="size-4" />;
}

function MailClient({ account, onAdd }: { account: MailAccountInfo; onAdd: () => void }) {
  const overlay = useOverlay();
  const session = useSession();
  const [folder, setFolder] = useState("INBOX");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [pages, setPages] = useState(1);
  const [menu, setMenu] = useState<MenuState>(null);
  const [mover, setMover] = useState<{ x: number; y: number; uids: number[] } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const anchor = useRef<number | null>(null);
  const folders = useQuery<MailFolder[]>("mail:folders", () => mailApi.folders(), { refreshMs: 120_000 });
  const listKey = `mail:list:${folder}:${search}:${pages}`;
  const list = useQuery<ListData>(
    listKey,
    async () => {
      if (folder === FLAGGED) return mailApi.flagged();
      if (search && !isPreview()) return bridge.mail.search(folder, search);
      if (pages === 1 || isPreview()) return mailApi.list(folder, 0);
      // Daha fazla yükle: sayfaları sırayla birleştirir.
      const all: MailSummary[] = [];
      let total = 0;
      for (let index = 0; index < pages; index++) {
        const result = await mailApi.list(folder, index);
        if (!result.ok) return result;
        total = result.data.total;
        all.push(...result.data.messages);
      }
      return { ok: true as const, data: { total, messages: all } };
    },
    { refreshMs: 90_000 },
  );

  const realFolder = (item: MailSummary) => item.folder;
  const current = (folders.data ?? []).find((item) => item.path === folder);
  const system = (folders.data ?? []).filter((item) => item.role);
  const custom = (folders.data ?? []).filter((item) => !item.role);
  const unreadTotal = (folders.data ?? []).find((item) => item.role === "INBOX")?.unread ?? 0;

  useEffect(() => {
    if (isPreview()) return;
    return bridge.mail.onNewMail(() => {
      invalidate("mail:list:INBOX");
      invalidate(`mail:list:${FLAGGED}`);
      invalidate("mail:folders");
    });
  }, []);

  useEffect(() => {
    setPicked(new Set());
    setEditing(false);
    setPages(1);
  }, [folder, search]);

  const messages = useMemo(() => {
    const all = list.data?.messages ?? [];
    if (!search || !isPreview()) return all;
    const needle = search.toLocaleLowerCase("tr");
    return all.filter((item) => `${item.subject} ${item.from.name} ${item.preview}`.toLocaleLowerCase("tr").includes(needle));
  }, [list.data, search]);

  const refresh = () => {
    invalidate("mail:list:");
    invalidate("mail:folders");
  };

  const patchList = (uids: number[], change: (item: MailSummary) => MailSummary | null) =>
    setQueryData<ListData>(listKey, (data) => (data ? { ...data, messages: data.messages.flatMap((item) => (uids.includes(item.uid) ? (change(item) ? [change(item)!] : []) : [item])) } : data!));

  /** Toplu işlemler için seçili postaları klasörlerine göre gruplar (Bayraklı birden çok klasörü karıştırır). */
  const byFolder = (uids: number[]) => {
    const groups = new Map<string, number[]>();
    for (const item of messages.filter((entry) => uids.includes(entry.uid))) groups.set(realFolder(item), [...(groups.get(realFolder(item)) ?? []), item.uid]);
    return groups;
  };

  const run = async (uids: number[], work: (folder: string, uids: number[]) => Promise<ApiResult<true>>, done: string | null, optimistic?: (item: MailSummary) => MailSummary | null) => {
    if (!uids.length) return;
    if (isPreview()) return session.toast("Önizlemede posta değiştirilmez", "info");
    if (optimistic) patchList(uids, optimistic);
    for (const [path, ids] of byFolder(uids)) {
      const result = await work(path, ids);
      if (!result.ok) {
        session.toast(result.message, "bad");
        refresh();
        return;
      }
    }
    if (done) session.toast(done, "ok");
    setPicked(new Set());
    if (selected !== null && uids.includes(selected) && optimistic && !optimistic(messages.find((item) => item.uid === selected)!)) setSelected(null);
    window.setTimeout(refresh, 400);
  };

  const actions = {
    seen: (uids: number[], seen: boolean) => run(uids, (path, ids) => bridge.mail.seen(path, ids, seen), null, (item) => ({ ...item, seen })),
    flag: (uids: number[], flagged: boolean) => run(uids, (path, ids) => bridge.mail.flag(path, ids, flagged), null, (item) => (folder === FLAGGED && !flagged ? null : { ...item, flagged })),
    remove: (uids: number[]) => run(uids, (path, ids) => bridge.mail.remove(path, ids), current?.role === "Trash" ? "Kalıcı olarak silindi" : "Çöp'e taşındı", () => null),
    archive: (uids: number[]) => {
      const archive = (folders.data ?? []).find((item) => item.role === "Archive");
      if (!archive) return session.toast("Arşiv klasörü yok", "bad");
      return run(uids, (path, ids) => bridge.mail.moveTo(path, ids, archive.path), "Arşivlendi", () => null);
    },
    move: (uids: number[], target: string) => {
      const name = (folders.data ?? []).find((item) => item.path === target)?.name ?? target;
      return run(uids, (path, ids) => bridge.mail.moveTo(path, ids, target), `${uids.length > 1 ? `${uids.length} ileti` : "İleti"} “${name}” klasörüne taşındı`, () => null);
    },
  };

  const newFolder = async (parent: MailFolder | null) => {
    const name = await askText({ title: parent ? `“${parent.name}” içinde yeni klasör` : "Yeni klasör", placeholder: "Klasör adı", action: "Oluştur" });
    if (!name?.trim()) return;
    if (isPreview()) return session.toast("Önizlemede klasör oluşturulmaz", "info");
    const result = await bridge.mail.createFolder(name.trim(), parent?.path ?? null);
    if (!result.ok) return session.toast(result.message, "bad");
    setQueryData("mail:folders", () => result.data);
    session.toast("Klasör oluşturuldu", "ok");
  };

  const renameFolder = async (item: MailFolder) => {
    const name = await askText({ title: "Klasörü yeniden adlandır", value: item.name, action: "Kaydet" });
    if (!name?.trim() || name.trim() === item.name) return;
    if (isPreview()) return session.toast("Önizlemede klasör değiştirilmez", "info");
    const result = await bridge.mail.renameFolder(item.path, name.trim());
    if (!result.ok) return session.toast(result.message, "bad");
    setQueryData("mail:folders", () => result.data);
    if (folder === item.path || folder.startsWith(`${item.path}${item.delimiter}`)) setFolder("INBOX");
  };

  const deleteFolder = async (item: MailFolder) => {
    const nested = (folders.data ?? []).filter((entry) => entry.path.startsWith(`${item.path}${item.delimiter}`)).length;
    const ok = await ask({
      title: `“${item.name}” silinsin mi?`,
      body: `${item.total ? `İçindeki ${item.total} ileti Çöp'e taşınır. ` : ""}${nested ? `${nested} alt klasör de silinir.` : ""}`.trim() || "Klasör boş.",
      action: "Sil",
      danger: true,
      icon: <Trash2 className="size-7" />,
    });
    if (!ok) return;
    if (isPreview()) return session.toast("Önizlemede klasör silinmez", "info");
    const result = await bridge.mail.deleteFolder(item.path);
    if (!result.ok) return session.toast(result.message, "bad");
    setQueryData("mail:folders", () => result.data);
    if (folder === item.path || folder.startsWith(`${item.path}${item.delimiter}`)) setFolder("INBOX");
    session.toast("Klasör silindi", "ok");
  };

  const emptyFolder = async (item: MailFolder) => {
    if (!(await ask({ title: `${item.name} boşaltılsın mı?`, body: `${item.total} ileti kalıcı olarak silinir. Bu geri alınamaz.`, action: "Boşalt", danger: true, icon: <Trash2 className="size-7" /> }))) return;
    if (isPreview()) return session.toast("Önizlemede silinmez", "info");
    const result = await bridge.mail.emptyFolder(item.path);
    if (!result.ok) return session.toast(result.message, "bad");
    setSelected(null);
    refresh();
    session.toast(`${item.name} boşaltıldı`, "ok");
  };

  const folderMenu = (event: React.MouseEvent, item: MailFolder) => {
    event.preventDefault();
    const items: MenuItem[] = [];
    if (item.unread) items.push({ label: "Tümünü okundu yap", icon: <MailOpen />, onSelect: () => void markAllRead(item) });
    if (item.role === "Trash" || item.role === "Junk") items.push({ label: "Boşalt", icon: <Trash2 />, danger: true, onSelect: () => void emptyFolder(item) });
    if (!item.role || item.role === "INBOX") items.push({ label: "Yeni alt klasör", icon: <FolderPlus />, onSelect: () => void newFolder(item) });
    if (!item.role) {
      items.push({ label: "Yeniden adlandır", icon: <Pencil />, onSelect: () => void renameFolder(item) });
      items.push("sep", { label: "Klasörü sil", icon: <Trash2 />, danger: true, onSelect: () => void deleteFolder(item) });
    }
    if (items.length) setMenu({ x: event.clientX, y: event.clientY, items });
  };

  const markAllRead = async (item: MailFolder) => {
    if (isPreview()) return;
    const result = await mailApi.list(item.path, 0);
    if (!result.ok) return;
    const unseen = result.data.messages.filter((entry) => !entry.seen).map((entry) => entry.uid);
    if (unseen.length) await bridge.mail.seen(item.path, unseen, true);
    refresh();
  };

  const messageMenu = (event: React.MouseEvent, item: MailSummary) => {
    event.preventDefault();
    const uids = picked.has(item.uid) && picked.size > 1 ? [...picked] : [item.uid];
    const many = uids.length > 1;
    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        ...(!many
          ? [
              { label: "Yanıtla", icon: <Reply />, onSelect: () => void openFor(item, "reply") },
              { label: "İlet", icon: <Forward />, onSelect: () => void openFor(item, "forward") },
              "sep" as const,
            ]
          : []),
        { label: item.seen ? "Okunmadı yap" : "Okundu yap", icon: item.seen ? <MailIcon className="size-4" /> : <MailOpen />, onSelect: () => void actions.seen(uids, !item.seen) },
        { label: item.flagged ? "Bayrağı kaldır" : "Bayrakla", icon: <Flag />, onSelect: () => void actions.flag(uids, !item.flagged) },
        { label: "Taşı…", icon: <FolderInput />, onSelect: () => setMover({ x: event.clientX, y: event.clientY, uids }) },
        { label: "Arşivle", icon: <Archive />, onSelect: () => void actions.archive(uids) },
        "sep" as const,
        { label: current?.role === "Trash" ? "Kalıcı sil" : "Sil", icon: <Trash2 />, danger: true, onSelect: () => void actions.remove(uids) },
      ],
    });
  };

  const openFor = async (item: MailSummary, mode: "reply" | "forward") => {
    const result = await mailApi.read(item.folder, item.uid);
    if (!result.ok) return session.toast(result.message, "bad");
    overlay.setCompose(mode === "reply" ? replyDraft(result.data, false, account.address) : forwardDraft(result.data));
  };

  const clickRow = (event: React.MouseEvent, item: MailSummary, index: number) => {
    if (event.shiftKey && anchor.current !== null) {
      const from = Math.min(anchor.current, index);
      const to = Math.max(anchor.current, index);
      setPicked(new Set(messages.slice(from, to + 1).map((entry) => entry.uid)));
      return;
    }
    if (event.ctrlKey || event.metaKey || editing) {
      anchor.current = index;
      setPicked((set) => {
        const next = new Set(set);
        if (next.has(item.uid)) next.delete(item.uid);
        else next.add(item.uid);
        return next;
      });
      return;
    }
    anchor.current = index;
    setPicked(new Set());
    // Taslak açılınca düzenlenmek üzere yazma penceresine gider.
    if (current?.role === "Drafts") return void openDraft(item);
    setSelected(item.uid);
    if (!item.seen) {
      patchList([item.uid], (entry) => ({ ...entry, seen: true }));
      window.setTimeout(() => invalidate("mail:folders"), 1500);
    }
  };

  const openDraft = async (item: MailSummary) => {
    const result = await mailApi.read(item.folder, item.uid);
    if (!result.ok) return session.toast(result.message, "bad");
    const data = result.data;
    overlay.setCompose({
      to: data.to.map((entry) => entry.address).join(", "),
      cc: data.cc.map((entry) => entry.address).join(", "),
      bcc: (data.bcc ?? []).map((entry) => entry.address).join(", "),
      subject: data.subject === "(Konu yok)" ? "" : data.subject,
      text: data.text ?? "",
      draftUid: data.uid,
      forward: data.attachments.length ? { folder: data.folder, uid: data.uid } : null,
      forwardFiles: data.attachments.map((entry) => ({ id: entry.id, filename: entry.filename, size: entry.size })),
    });
  };

  const pickedList = [...picked];
  const allPicked = messages.length > 0 && picked.size === messages.length;
  const title = folder === FLAGGED ? "Bayraklı" : (current?.name ?? folder);

  return (
    <div className="grid h-full min-h-0 grid-cols-[230px_380px_minmax(0,1fr)] gap-5">
      <aside className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink">Mail</h1>
          <button onClick={() => overlay.setCompose({})} aria-label="Yeni ileti" title="Yeni ileti" className="flex size-9 items-center justify-center rounded-full bg-accent text-white shadow-lg hover:brightness-110">
            <PenSquare className="size-4" />
          </button>
        </div>
        <div className="scroll-area -mr-2 mt-4 min-h-0 flex-1 pr-2">
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">Posta kutuları</p>
          <nav className="space-y-0.5">
            {folders.loading && Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-9" />)}
            {system.slice(0, 1).map((item) => (
              <FolderRow key={item.path} item={item} active={folder === item.path} drop={dropTarget === item.path} onOpen={() => { setFolder(item.path); setSelected(null); setSearch(""); setQuery(""); }} onMenu={(event) => folderMenu(event, item)} onDropTarget={setDropTarget} onDropMessages={(uids, from) => void run(uids, (_path, ids) => bridge.mail.moveTo(from, ids, item.path), `“${item.name}” klasörüne taşındı`, () => null)} />
            ))}
            {folders.data && (
              <button onClick={() => { setFolder(FLAGGED); setSelected(null); setSearch(""); setQuery(""); }} className={cn("focus-ring flex h-10 w-full items-center gap-3 rounded-[14px] px-3 text-[13.5px] transition-colors", folder === FLAGGED ? "bg-white/[0.12] text-ink" : "text-ink-2 hover:bg-white/[0.06]")}>
                <Flag className={cn("size-4", folder === FLAGGED ? "text-warn" : "text-ink-3")} />
                <span className="flex-1 text-left">Bayraklı</span>
              </button>
            )}
            {system.slice(1).map((item) => (
              <FolderRow key={item.path} item={item} active={folder === item.path} drop={dropTarget === item.path} onOpen={() => { setFolder(item.path); setSelected(null); setSearch(""); setQuery(""); }} onMenu={(event) => folderMenu(event, item)} onDropTarget={setDropTarget} onDropMessages={(uids, from) => void run(uids, (_path, ids) => bridge.mail.moveTo(from, ids, item.path), `“${item.name}” klasörüne taşındı`, () => null)} />
            ))}
          </nav>
          {folders.data && (
            <>
              <div className="mt-5 flex items-center justify-between px-3 pb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">Klasörlerim</p>
                <button onClick={() => void newFolder(null)} aria-label="Yeni klasör" title="Yeni klasör" className="flex size-6 items-center justify-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink">
                  <FolderPlus className="size-3.5" />
                </button>
              </div>
              <nav className="space-y-0.5">
                {custom.length === 0 && (
                  <button onClick={() => void newFolder(null)} className="w-full rounded-[14px] border border-dashed border-white/10 px-3 py-3 text-left text-[12.5px] text-ink-3 hover:border-white/20 hover:text-ink-2">
                    Klasör oluşturup postalarını düzenle. Postaları klasöre sürükleyebilirsin.
                  </button>
                )}
                {custom.map((item) => (
                  <FolderRow key={item.path} item={item} active={folder === item.path} drop={dropTarget === item.path} onOpen={() => { setFolder(item.path); setSelected(null); setSearch(""); setQuery(""); }} onMenu={(event) => folderMenu(event, item)} onDropTarget={setDropTarget} onDropMessages={(uids, from) => void run(uids, (_path, ids) => bridge.mail.moveTo(from, ids, item.path), `“${item.name}” klasörüne taşındı`, () => null)} />
                ))}
              </nav>
            </>
          )}
        </div>
        <AccountSwitcher account={account} onAdd={onAdd} />
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[22px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
            <p className="text-[12px] text-ink-3">{list.data ? `${list.data.total} ileti${folder === "INBOX" && unreadTotal ? ` · ${unreadTotal} okunmamış` : ""}` : " "}</p>
          </div>
          <button onClick={() => { setEditing((value) => !value); setPicked(new Set()); }} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-accent-2 hover:bg-white/[0.06]">
            {editing ? "Bitti" : "Düzenle"}
          </button>
        </div>
        <form
          className="mt-3 flex h-10 items-center gap-2.5 rounded-full bg-black/25 px-4 ring-1 ring-white/8 focus-within:ring-accent/60"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(query.trim());
          }}
        >
          <Search className="size-4 text-ink-3" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value) setSearch(""); }} placeholder={`${title} içinde ara`} className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4" />
        </form>

        <AnimatePresence>
          {(editing || picked.size > 0) && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 flex items-center gap-1 rounded-[16px] bg-white/[0.06] p-1.5 text-[12.5px]">
                <button onClick={() => setPicked(allPicked ? new Set() : new Set(messages.map((item) => item.uid)))} className="rounded-[10px] px-2.5 py-1.5 text-ink-2 hover:bg-white/10">{allPicked ? "Seçimi kaldır" : "Tümünü seç"}</button>
                <span className="mx-1 text-ink-4">{picked.size} seçili</span>
                <span className="ml-auto flex items-center gap-0.5">
                  <BarButton label="Okundu" disabled={!picked.size} onClick={() => void actions.seen(pickedList, true)}><MailOpen /></BarButton>
                  <BarButton label="Okunmadı" disabled={!picked.size} onClick={() => void actions.seen(pickedList, false)}><MailIcon /></BarButton>
                  <BarButton label="Bayrak" disabled={!picked.size} onClick={() => void actions.flag(pickedList, !messages.filter((item) => picked.has(item.uid)).every((item) => item.flagged))}><Flag /></BarButton>
                  <BarButton label="Taşı" disabled={!picked.size} onClick={(event) => setMover({ x: event.clientX, y: event.clientY + 12, uids: pickedList })}><FolderInput /></BarButton>
                  <BarButton label="Arşivle" disabled={!picked.size} onClick={() => void actions.archive(pickedList)}><Archive /></BarButton>
                  <BarButton label="Sil" danger disabled={!picked.size} onClick={() => void actions.remove(pickedList)}><Trash2 /></BarButton>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="scroll-area -mr-2 mt-3 min-h-0 flex-1 space-y-1 pr-2">
          {list.error && !list.data ? <ErrorNote message={list.error} onRetry={list.refresh} /> : null}
          {list.loading && !list.data && Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[76px] rounded-[18px]" />)}
          {!list.loading && messages.length === 0 && <Empty icon={folder === FLAGGED ? <Flag /> : <Inbox />} title={search ? "Sonuç yok" : folder === FLAGGED ? "Bayraklı ileti yok" : "Klasör boş"} body={folder === FLAGGED ? "Bir postayı bayraklamak için üzerine sağ tıkla." : undefined} />}
          {messages.map((item, index) => {
            const isPicked = picked.has(item.uid);
            return (
              <div
                key={`${item.folder}-${item.uid}`}
                draggable
                onDragStart={(event) => {
                  const uids = isPicked ? pickedList : [item.uid];
                  event.dataTransfer.setData("application/x-sorvia-mail", JSON.stringify({ folder: item.folder, uids }));
                  event.dataTransfer.effectAllowed = "move";
                }}
                onContextMenu={(event) => messageMenu(event, item)}
                onClick={(event) => clickRow(event, item, index)}
                className={cn("group relative flex cursor-default gap-2.5 rounded-[18px] px-3 py-3 transition-colors", isPicked ? "bg-accent/15 ring-1 ring-accent/40" : selected === item.uid ? "glass-strip" : "hover:bg-white/[0.06]")}
              >
                {(editing || picked.size > 0) && (
                  <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border", isPicked ? "border-accent bg-accent text-white" : "border-white/25")}>{isPicked && <Check className="size-3" />}</span>
                )}
                <span className="mt-1.5 w-2 shrink-0">{!item.seen && <span className="block size-2 rounded-full bg-accent" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", item.seen ? "text-ink-2" : "font-semibold text-ink")}>{current?.role === "Sent" || current?.role === "Drafts" ? `Kime: ${item.to.map((entry) => entry.name || entry.address).join(", ") || "—"}` : item.from.name || item.from.address}</span>
                    {item.flagged && <Flag className="size-3.5 shrink-0 fill-warn text-warn" />}
                    <span className="shrink-0 text-[11.5px] text-ink-4 group-hover:hidden">{relative(item.date)}</span>
                    <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex" onClick={(event) => event.stopPropagation()}>
                      <RowButton label={item.flagged ? "Bayrağı kaldır" : "Bayrakla"} onClick={() => void actions.flag([item.uid], !item.flagged)}><Flag /></RowButton>
                      {current?.role !== "Archive" && folder !== FLAGGED && <RowButton label="Arşivle" onClick={() => void actions.archive([item.uid])}><Archive /></RowButton>}
                      <RowButton label="Sil" onClick={() => void actions.remove([item.uid])}><Trash2 /></RowButton>
                    </span>
                  </div>
                  <p className={cn("mt-1 truncate text-[13px]", item.seen ? "text-ink-2" : "text-ink")}>{item.subject || "(Konu yok)"}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-ink-3">
                    {item.hasAttachments && <Paperclip className="size-3 shrink-0" />}
                    {folder === FLAGGED && <span className="shrink-0 rounded bg-white/[0.08] px-1 text-[10.5px]">{(folders.data ?? []).find((entry) => entry.path === item.folder)?.name ?? item.folder}</span>}
                    <span className="truncate">{item.preview}</span>
                  </p>
                </div>
              </div>
            );
          })}
          {list.data && folder !== FLAGGED && !search && messages.length < list.data.total && (
            <button onClick={() => setPages((value) => value + 1)} className="w-full rounded-[14px] py-3 text-[13px] text-accent-2 hover:bg-white/[0.05]">
              {list.loading ? "Yükleniyor…" : `Daha fazla yükle (${list.data.total - messages.length} ileti daha)`}
            </button>
          )}
        </div>
      </section>

      <section className="glass-card min-h-0 overflow-hidden rounded-[26px]">
        {selected === null ? (
          <Empty icon={<MailOpen />} title={picked.size ? `${picked.size} ileti seçili` : "Bir ileti seç"} body={picked.size ? "Üstteki çubuktan toplu işlem yap ya da postaları bir klasöre sürükle." : "Sağ tık ile bayrak, taşıma ve silme seçeneklerine ulaşabilirsin."} />
        ) : (
          <Reader
            key={`${folder}-${selected}`}
            folder={messages.find((item) => item.uid === selected)?.folder ?? folder}
            uid={selected}
            account={account}
            role={current?.role ?? null}
            onBack={() => setSelected(null)}
            onCompose={(draft) => overlay.setCompose(draft)}
            onFlag={(flagged) => void actions.flag([selected], flagged)}
            onUnread={() => {
              void actions.seen([selected], false);
              setSelected(null);
            }}
            onMove={(event) => setMover({ x: event.clientX, y: event.clientY + 12, uids: [selected] })}
            onArchive={() => void actions.archive([selected])}
            onDelete={() => void actions.remove([selected])}
          />
        )}
      </section>

      <Compose />
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      {mover && folders.data && (
        <FolderPicker
          folders={folders.data}
          current={folder}
          anchor={mover}
          onClose={() => setMover(null)}
          onPick={(path) => {
            const uids = mover.uids;
            setMover(null);
            void actions.move(uids, path);
          }}
        />
      )}
    </div>
  );
}

function BarButton({ label, children, onClick, disabled, danger }: { label: string; children: React.ReactNode; onClick: (event: React.MouseEvent) => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button title={label} aria-label={label} disabled={disabled} onClick={onClick} className={cn("flex size-8 items-center justify-center rounded-[10px] hover:bg-white/10 disabled:opacity-35 [&_svg]:size-4", danger ? "text-bad" : "text-ink-2")}>
      {children}
    </button>
  );
}

function RowButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className="flex size-6 items-center justify-center rounded-md text-ink-3 hover:bg-white/10 hover:text-ink [&_svg]:size-3.5">
      {children}
    </button>
  );
}

function FolderRow({ item, active, drop, onOpen, onMenu, onDropTarget, onDropMessages }: { item: MailFolder; active: boolean; drop: boolean; onOpen: () => void; onMenu: (event: React.MouseEvent) => void; onDropTarget: (path: string | null) => void; onDropMessages: (uids: number[], from: string) => void }) {
  const accepts = item.role !== "Drafts" && item.role !== "Sent";
  return (
    <button
      onClick={onOpen}
      onContextMenu={onMenu}
      onDragOver={(event) => {
        if (!accepts || !event.dataTransfer.types.includes("application/x-sorvia-mail")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDropTarget(item.path);
      }}
      onDragLeave={() => onDropTarget(null)}
      onDrop={(event) => {
        onDropTarget(null);
        const raw = event.dataTransfer.getData("application/x-sorvia-mail");
        if (!raw) return;
        event.preventDefault();
        const data = JSON.parse(raw) as { folder: string; uids: number[] };
        if (data.folder !== item.path) onDropMessages(data.uids, data.folder);
      }}
      style={{ paddingLeft: 12 + item.depth * 16 }}
      className={cn("focus-ring group flex h-10 w-full items-center gap-3 rounded-[14px] pr-2 text-[13.5px] transition-colors", drop ? "bg-accent/25 text-ink ring-1 ring-accent/60" : active ? "bg-white/[0.12] text-ink" : "text-ink-2 hover:bg-white/[0.06]")}
    >
      <span className={cn(active ? "text-accent-2" : "text-ink-3")}>{folderIcon(item)}</span>
      <span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
      {item.unread > 0 && <span className="tabular rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-[18px] text-white">{item.unread}</span>}
      <span
        role="button"
        aria-label="Klasör seçenekleri"
        onClick={(event) => {
          event.stopPropagation();
          onMenu(event);
        }}
        className="hidden size-6 items-center justify-center rounded-md text-ink-3 hover:bg-white/10 hover:text-ink group-hover:flex"
      >
        <MoreHorizontal className="size-4" />
      </span>
    </button>
  );
}

function quote(message: MailMessage) {
  const when = new Date(message.date).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
  return `\n\n${when} tarihinde ${message.from.name || message.from.address} <${message.from.address}> şunu yazdı:\n${(message.text ?? "").split("\n").map((line) => `> ${line}`).join("\n")}`;
}

function replyDraft(message: MailMessage, all: boolean, own: string): OverlayCompose {
  const others = all ? [...message.to, ...message.cc].map((item) => item.address).filter((address) => address && address.toLowerCase() !== own.toLowerCase() && address !== message.from.address) : [];
  return {
    to: message.from.address,
    cc: others.join(", "),
    subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
    text: quote(message),
    inReplyTo: message.messageId,
  };
}

function forwardDraft(message: MailMessage): OverlayCompose {
  return {
    subject: /^(ilt|fwd?):/i.test(message.subject) ? message.subject : `İlt: ${message.subject}`,
    text: `\n\n— İletilen ileti —\nKimden: ${message.from.name} <${message.from.address}>\nTarih: ${new Date(message.date).toLocaleString("tr-TR")}\nKonu: ${message.subject}\nKime: ${message.to.map((item) => item.address).join(", ")}\n\n${message.text ?? ""}`,
    forward: message.attachments.length ? { folder: message.folder, uid: message.uid } : null,
    forwardFiles: message.attachments.map((item) => ({ id: item.id, filename: item.filename, size: item.size })),
  };
}

type OverlayCompose = NonNullable<ReturnType<typeof useOverlay>["compose"]>;

function Reader({ folder, uid, account, role, onBack, onCompose, onFlag, onUnread, onMove, onArchive, onDelete }: { folder: string; uid: number; account: MailAccountInfo; role: MailFolder["role"]; onBack: () => void; onCompose: (draft: OverlayCompose) => void; onFlag: (flagged: boolean) => void; onUnread: () => void; onMove: (event: React.MouseEvent) => void; onArchive: () => void; onDelete: () => void }) {
  const session = useSession();
  const message = useQuery<MailMessage>(`mail:read:${folder}:${uid}`, () => mailApi.read(folder, uid));
  const [images, setImages] = useState(false);
  const [flagged, setFlagged] = useState<boolean | null>(null);

  useEffect(() => {
    if (message.data && !isPreview()) invalidate("mail:folders");
  }, [message.data?.uid]);

  if (message.loading) return <div className="space-y-4 p-7"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-64" /></div>;
  if (!message.data) return <div className="p-7"><ErrorNote message={message.error ?? "İleti açılamadı."} onRetry={message.refresh} /></div>;
  const data = message.data;
  const isFlagged = flagged ?? data.flagged;
  const allowRemote = images || session.prefs.showRemoteImages;
  const html = data.html ? frameDocument(data.html, allowRemote || !data.remoteImages) : null;
  const many = data.to.length + data.cc.length > 1;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/8 px-6 pb-5 pt-5">
        <div className="flex items-center gap-1">
          <button onClick={onBack} aria-label="Listeye dön" className="mr-1 flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink 2xl:hidden"><ArrowLeft className="size-4" /></button>
          <Button size="sm" variant="glass" onClick={() => onCompose(replyDraft(data, false, account.address))}><Reply /> Yanıtla</Button>
          {many && <Button size="sm" variant="glass" onClick={() => onCompose(replyDraft(data, true, account.address))}><ReplyAll /> Tümünü</Button>}
          <Button size="sm" variant="glass" onClick={() => onCompose(forwardDraft(data))}><Forward /> İlet</Button>
          <span className="ml-auto flex gap-0.5">
            <BarButton label={isFlagged ? "Bayrağı kaldır" : "Bayrakla"} onClick={() => { setFlagged(!isFlagged); onFlag(!isFlagged); }}><Flag className={cn(isFlagged && "fill-warn text-warn")} /></BarButton>
            <BarButton label="Okunmadı yap" onClick={onUnread}><MailIcon /></BarButton>
            <BarButton label="Klasöre taşı" onClick={onMove}><FolderInput /></BarButton>
            {role !== "Archive" && <BarButton label="Arşivle" onClick={onArchive}><Archive /></BarButton>}
            <BarButton label={role === "Trash" ? "Kalıcı sil" : "Sil"} danger onClick={onDelete}><Trash2 /></BarButton>
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
        {data.attachments.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {data.attachments.map((item) => (
              <button
                key={item.id}
                onClick={async () => {
                  if (isPreview()) return session.toast("Önizlemede ek indirilmez", "info");
                  const result = await bridge.mail.saveAttachment(data.folder, data.uid, item.id);
                  if (!result.ok) session.toast(result.message, "bad");
                  else if (result.data) session.toast(`${item.filename} kaydedildi`, "ok");
                }}
                className="focus-ring flex items-center gap-2.5 rounded-[14px] bg-white/[0.07] py-2 pl-2 pr-3.5 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.12]"
              >
                <FileIcon name={item.filename} type={item.contentType} />
                <span className="min-w-0">
                  <span className="block max-w-[220px] truncate text-[12.5px] text-ink">{item.filename}</span>
                  <span className="block text-[11px] text-ink-4">{bytes(item.size)} · indir</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {html ? (
          <iframe title="İleti" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={html} className="mail-frame h-full min-h-[480px] w-full border-0" />
        ) : (
          <pre className="selectable whitespace-pre-wrap px-2 font-sans text-[14px] leading-relaxed text-ink">{data.text}</pre>
        )}
      </div>
    </div>
  );
}

function FileIcon({ name, type }: { name: string; type?: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const image = type?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[10px] font-bold uppercase text-white", image ? "bg-gradient-to-br from-[#f472b6] to-[#8b5cf6]" : ext === "pdf" ? "bg-gradient-to-br from-[#f87171] to-[#dc2626]" : ["zip", "rar", "7z"].includes(ext) ? "bg-gradient-to-br from-[#fbbf24] to-[#d97706]" : "bg-gradient-to-br from-[#60a5fa] to-[#2563eb]")}>
      {image ? <ImageIcon className="size-4" /> : ext.slice(0, 4) || <FileText className="size-4" />}
    </span>
  );
}

type Pending = { id: string; name: string; contentType: string; size: number; data: string };
const MAX_ATTACH = 25 * 1024 * 1024;

function readAsBase64(file: File): Promise<Pending> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name} okunamadı.`));
    reader.onload = () => {
      const url = String(reader.result);
      resolve({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, name: file.name || "dosya", contentType: file.type || "application/octet-stream", size: file.size, data: url.slice(url.indexOf(",") + 1) });
    };
    reader.readAsDataURL(file);
  });
}

function Compose() {
  const overlay = useOverlay();
  const session = useSession();
  const draft = overlay.compose;
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [forwarded, setForwarded] = useState<{ id: string; filename: string; size: number }[]>([]);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draftUid, setDraftUid] = useState<number | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const initial = useRef("");

  useEffect(() => {
    if (!draft) return;
    setTo(draft.to ?? "");
    setCc(draft.cc ?? "");
    setBcc(draft.bcc ?? "");
    setShowCc(Boolean(draft.cc || draft.bcc));
    setSubject(draft.subject ?? "");
    setText(draft.text ?? "");
    setFiles([]);
    setForwarded(draft.forwardFiles ?? []);
    setDraftUid(draft.draftUid ?? null);
    initial.current = JSON.stringify([draft.to ?? "", draft.cc ?? "", draft.bcc ?? "", draft.subject ?? "", draft.text ?? ""]);
  }, [draft]);

  const total = files.reduce((sum, item) => sum + item.size, 0) + forwarded.reduce((sum, item) => sum + item.size, 0);
  const dirty = files.length > 0 || JSON.stringify([to, cc, bcc, subject, text]) !== initial.current;

  const add = async (list: FileList | File[]) => {
    const incoming = [...list];
    if (!incoming.length) return;
    const size = total + incoming.reduce((sum, item) => sum + item.size, 0);
    if (size > MAX_ATTACH) return session.toast("Ekler toplam 25 MB'ı geçemez.", "bad");
    try {
      const read = await Promise.all(incoming.map(readAsBase64));
      setFiles((current) => [...current, ...read]);
    } catch (error) {
      session.toast((error as Error).message, "bad");
    }
  };

  const payload = (): MailDraft => ({
    to,
    cc,
    bcc,
    subject,
    text,
    inReplyTo: draft?.inReplyTo ?? null,
    attachments: files.map(({ name, contentType, data }) => ({ name, contentType, data })),
    forward: draft?.forward && forwarded.length ? { ...draft.forward, ids: forwarded.map((item) => item.id) } : null,
    draftUid,
  });

  const send = async () => {
    if (isPreview()) return session.toast("Önizlemede posta gönderilmez", "info");
    setSending(true);
    const result = await bridge.mail.send(payload());
    setSending(false);
    if (!result.ok) return session.toast(result.message, "bad");
    session.toast(files.length + forwarded.length ? `İleti ${files.length + forwarded.length} ekle gönderildi` : "İleti gönderildi", "ok");
    overlay.setCompose(null);
    invalidate("mail:");
  };

  const saveDraft = async () => {
    if (isPreview()) return true;
    const result = await bridge.mail.saveDraft(payload());
    if (!result.ok) {
      session.toast(result.message, "bad");
      return false;
    }
    setDraftUid(result.data.uid);
    invalidate("mail:");
    return true;
  };

  const close = async () => {
    if (!dirty || sending) return overlay.setCompose(null);
    const keep = await ask({ title: "Taslak kaydedilsin mi?", body: "Kaydedersen Taslaklar klasöründen devam edebilirsin.", action: "Taslağı kaydet", cancel: "Kaydetmeden kapat", icon: <PenSquare className="size-7" /> });
    if (keep && !(await saveDraft())) return;
    if (keep) session.toast("Taslak kaydedildi", "ok");
    overlay.setCompose(null);
  };

  return (
    <AnimatePresence>
      {draft && (
        <motion.div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/45 pb-10 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => void close()}>
          <motion.div
            role="dialog"
            aria-label="Yeni ileti"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="glass-sheet relative flex h-[min(680px,84vh)] w-[min(820px,92vw)] flex-col rounded-[30px]"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") void close();
              if (event.key === "Enter" && event.ctrlKey) void send();
              if (event.key.toLowerCase() === "s" && event.ctrlKey) {
                event.preventDefault();
                void saveDraft().then((ok) => ok && session.toast("Taslak kaydedildi", "ok"));
              }
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => event.currentTarget === event.target && setDragging(false)}
            onDrop={(event) => {
              if (!event.dataTransfer.files.length) return;
              event.preventDefault();
              setDragging(false);
              void add(event.dataTransfer.files);
            }}
          >
            {dragging && <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[26px] border-2 border-dashed border-accent/70 bg-accent/10 text-[15px] font-semibold text-ink">Eklemek için bırak</div>}
            <span className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20" />
            <header className="flex items-center justify-between px-7 pb-2 pt-3">
              <button onClick={() => void close()} className="text-[13.5px] text-accent-2 hover:underline">Vazgeç</button>
              <h2 className="text-[16px] font-semibold text-ink">{subject || (draftUid ? "Taslak" : "Yeni ileti")}</h2>
              <Button size="sm" variant="accent" loading={sending} disabled={!to.trim()} onClick={() => void send()}>
                {!sending && <Send />} Gönder
              </Button>
            </header>
            <div className="divide-y divide-white/8 border-y border-white/8 px-7">
              <Row label="Kime">
                <input autoFocus={!draft.to} value={to} onChange={(event) => setTo(event.target.value)} placeholder="ad@ornek.com, virgülle birden çok" className="h-11 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4" />
                {!showCc && <button onClick={() => setShowCc(true)} className="shrink-0 text-[12px] text-ink-3 hover:text-ink">Bilgi/Gizli</button>}
              </Row>
              {showCc && (
                <>
                  <Row label="Bilgi"><input value={cc} onChange={(event) => setCc(event.target.value)} className="h-11 w-full bg-transparent text-[14px] text-ink outline-none" /></Row>
                  <Row label="Gizli"><input value={bcc} onChange={(event) => setBcc(event.target.value)} placeholder="Diğer alıcılar görmez" className="h-11 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4" /></Row>
                </>
              )}
              <Row label="Konu"><input autoFocus={Boolean(draft.to) && !draft.subject} value={subject} onChange={(event) => setSubject(event.target.value)} className="h-11 w-full bg-transparent text-[14px] font-medium text-ink outline-none" /></Row>
            </div>
            <textarea
              autoFocus={Boolean(draft.to && draft.subject)}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onPaste={(event) => {
                const pasted = [...event.clipboardData.files];
                if (pasted.length) {
                  event.preventDefault();
                  void add(pasted);
                }
              }}
              placeholder="İletini yaz…"
              className="selectable flex-1 resize-none bg-transparent px-7 py-4 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-4"
            />
            {(files.length > 0 || forwarded.length > 0) && (
              <div className="flex max-h-[120px] flex-wrap gap-2 overflow-y-auto border-t border-white/8 px-7 py-3">
                {forwarded.map((item) => (
                  <AttachmentChip key={`f-${item.id}`} name={item.filename} size={item.size} note="iletilen" onRemove={() => setForwarded((list) => list.filter((entry) => entry.id !== item.id))} />
                ))}
                {files.map((item) => (
                  <AttachmentChip key={item.id} name={item.name} size={item.size} type={item.contentType} onRemove={() => setFiles((list) => list.filter((entry) => entry.id !== item.id))} />
                ))}
              </div>
            )}
            <footer className="flex items-center gap-2 border-t border-white/8 px-5 py-3">
              <input ref={picker} type="file" multiple hidden onChange={(event) => { if (event.target.files) void add(event.target.files); event.target.value = ""; }} />
              <Button size="sm" variant="ghost" onClick={() => picker.current?.click()}><Paperclip /> Dosya ekle</Button>
              <Button size="sm" variant="ghost" onClick={() => void saveDraft().then((ok) => ok && session.toast("Taslak kaydedildi", "ok"))}><Save /> Taslak</Button>
              <span className="ml-auto text-[11.5px] text-ink-4">{total ? `${bytes(total)} / 25 MB · ` : ""}Ctrl+Enter gönder · Ctrl+S taslak</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AttachmentChip({ name, size, type, note, onRemove }: { name: string; size: number; type?: string; note?: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-2 rounded-[12px] bg-white/[0.07] py-1.5 pl-1.5 pr-2 ring-1 ring-white/10">
      <FileIcon name={name} type={type} />
      <span className="min-w-0">
        <span className="block max-w-[180px] truncate text-[12px] text-ink">{name}</span>
        <span className="block text-[10.5px] text-ink-4">{bytes(size)}{note ? ` · ${note}` : ""}</span>
      </span>
      <button onClick={onRemove} aria-label="Eki kaldır" className="flex size-6 items-center justify-center rounded-md text-ink-3 hover:bg-white/10 hover:text-ink"><X className="size-3.5" /></button>
    </span>
  );
}

function frameDocument(html: string, remote: boolean) {
  const policy = `default-src 'none'; img-src data: cid:${remote ? " https: http:" : ""}; style-src 'unsafe-inline'; font-src data:;`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><base target="_blank"><style>body{margin:0;padding:24px;font:14px/1.6 "Segoe UI",system-ui,sans-serif;color:#1d1916;background:#fbf8f5;word-break:break-word}img{max-width:100%;height:auto}a{color:#c2510a}blockquote{border-left:3px solid #e6d6c8;margin:0;padding-left:12px;color:#5c524a}</style></head><body>${html}</body></html>`;
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
