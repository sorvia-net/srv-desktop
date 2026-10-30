import { AppWindow, Camera, CameraOff, EyeOff, Hash, HeadphoneOff, Headphones, Lock, Maximize2, MessagesSquare, Mic, MicOff, Minimize2, Monitor, MonitorUp, Phone, PhoneOff, Plus, Settings2, Signal, Trash2, Volume2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { ChatChannel, ChatPerson } from "@shared/contracts";
import { api, peopleApi, voiceApi } from "@/data/api";
import { bridge } from "@/data/bridge";
import { invalidate, useQuery } from "@/data/query";
import { getDevices, getShareQuality, joinVoice, leaveVoice, remoteCamera, remoteScreen, setDevices, setPeerVolume, setShareQuality, startCamera, startScreenShare, stopCamera, stopScreenShare, toggleDeafen, toggleMute, useVoice } from "@/data/voice";
import { Avatar, Button, cn, Empty, ErrorNote, Skeleton } from "@/design/ui";
import { useSession } from "@/shell/context";

import { ChannelView } from "./ChatChannel";

export function Chat() {
  const session = useSession();
  const voice = useVoice();
  const channels = useQuery<ChatChannel[]>("chat:channels", () => api.channels(), { refreshMs: voice.channelId ? 8_000 : 20_000 });
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChatChannel | "new-text" | "new-voice" | null>(null);
  const canManage = session.can("chat.manage");
  const all = channels.data ?? [];
  const text = all.filter((item) => (item.kind ?? "text") === "text");
  const rooms = all.filter((item) => item.kind === "voice");
  const direct = all.filter((item) => item.kind === "dm");
  const [picking, setPicking] = useState(false);

  const openDirect = async (person: ChatPerson) => {
    setPicking(false);
    const existing = direct.find((item) => item.userId === person.id);
    if (existing) return setActive(existing.id);
    const result = await peopleApi.openDirect(person.id);
    if (!result.ok) return session.toast(result.message, "bad");
    invalidate("chat:channels");
    setActive(result.data.id);
  };

  useEffect(() => {
    if (!active && text[0]) setActive(text[0].id);
  }, [text, active]);

  const current = all.find((item) => item.id === active) ?? null;

  const openVoice = (channel: ChatChannel) => {
    setActive(channel.id);
    if (voice.channelId !== channel.id) void joinVoice(channel.id);
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[270px_minmax(0,1fr)] gap-6">
      <aside className="flex min-h-0 flex-col">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Ekip</h1>
        <p className="mb-4 mt-1 text-[14px] text-ink-2">Kanallar, ses odaları ve özel mesajlar</p>
        {channels.error && !channels.data ? <ErrorNote message={channels.error} onRetry={channels.refresh} /> : null}
        <div className="scroll-area min-h-0 flex-1 space-y-4">
          <ChannelGroup title="Metin kanalları" onAdd={canManage ? () => setEditing("new-text") : undefined}>
            {channels.loading && Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-10" />)}
            {text.map((item) => (
              <ChannelRow key={item.id} active={active === item.id} icon={item.isPrivate ? <Lock className="size-4" /> : <Hash className="size-4" />} name={item.name} unread={item.unread} onClick={() => setActive(item.id)} onEdit={canManage ? () => setEditing(item) : undefined} />
            ))}
          </ChannelGroup>
          <ChannelGroup title="Ses kanalları" onAdd={canManage ? () => setEditing("new-voice") : undefined}>
            {rooms.map((item) => (
              <div key={item.id}>
                <ChannelRow active={active === item.id} icon={<Volume2 className="size-4" />} name={item.name} unread={0} live={voice.channelId === item.id} onClick={() => openVoice(item)} onEdit={canManage ? () => setEditing(item) : undefined} />
                {(item.peers ?? []).length > 0 && (
                  <ul className="mb-1 ml-8 mt-0.5 space-y-0.5">
                    {(voice.channelId === item.id ? voice.peers : (item.peers ?? [])).map((peer) => (
                      <li key={peer.id} className="flex items-center gap-2 py-0.5 text-[12.5px] text-ink-2">
                        <span className={cn("rounded-full ring-2 transition", "speaking" in peer && peer.speaking ? "ring-ok" : "ring-transparent")}>
                          <Avatar name={peer.name} src={peer.avatarUrl} size={20} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{peer.name}</span>
                        {peer.sharing && <MonitorUp className="size-3.5 text-accent-2" />}
                        {peer.deafened ? <HeadphoneOff className="size-3.5 text-bad" /> : peer.muted ? <MicOff className="size-3.5 text-bad" /> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {!channels.loading && rooms.length === 0 && <p className="px-3 text-[12.5px] text-ink-4">{canManage ? "Ses kanalı yok; + ile ekle." : "Ses kanalı yok."}</p>}
          </ChannelGroup>
          <ChannelGroup title="Özel mesajlar" onAdd={() => setPicking(true)}>
            {direct.map((item) => (
              <ChannelRow key={item.id} active={active === item.id} icon={<Avatar name={item.name} src={item.avatarUrl} size={22} />} name={item.name} unread={item.unread} onClick={() => setActive(item.id)} />
            ))}
            {!channels.loading && direct.length === 0 && (
              <button onClick={() => setPicking(true)} className="px-3 text-left text-[12.5px] text-ink-4 hover:text-ink-2">Bir ekip arkadaşına yaz…</button>
            )}
          </ChannelGroup>
        </div>
        <VoiceDock />
      </aside>
      <section className="glass-card flex min-h-0 flex-col overflow-hidden rounded-[26px]">
        {current ? current.kind === "voice" ? <VoiceStage channel={current} /> : <ChannelView channel={current} /> : <Empty icon={<MessagesSquare />} title="Kanal seç" />}
      </section>
      {picking && <PeoplePicker onPick={(person) => void openDirect(person)} onClose={() => setPicking(false)} />}
      {editing && <ChannelEditor target={editing} onClose={() => setEditing(null)} onDeleted={() => setActive(null)} />}
    </div>
  );
}

function PeoplePicker({ onPick, onClose }: { onPick: (person: ChatPerson) => void; onClose: () => void }) {
  const people = useQuery<ChatPerson[]>("chat:people", () => peopleApi.list(), { refreshMs: 30_000 });
  const [q, setQ] = useState("");
  const list = (people.data ?? []).filter((person) => person.name.toLocaleLowerCase("tr").includes(q.trim().toLocaleLowerCase("tr")));
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(event) => event.stopPropagation()} className="glass-card w-[420px] rounded-[26px] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-ink">Özel mesaj başlat</h3>
          <button onClick={onClose} className="text-ink-3 hover:text-ink" aria-label="Kapat"><X className="size-4" /></button>
        </div>
        <input autoFocus value={q} onChange={(event) => setQ(event.target.value)} placeholder="İsim ara" className="mb-3 h-10 w-full rounded-[12px] bg-black/30 px-3 text-[14px] text-ink outline-none ring-1 ring-white/10 focus:ring-accent/60" />
        <ul className="scroll-area max-h-[360px] space-y-1">
          {people.loading && <Skeleton className="h-10" />}
          {list.map((person) => (
            <li key={person.id}>
              <button onClick={() => onPick(person)} className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left hover:bg-white/[0.07]">
                <span className="relative">
                  <Avatar name={person.name} src={person.avatarUrl} size={32} />
                  <span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-[#1b1b1f]", person.online ? "bg-ok" : "bg-ink-4")} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink">{person.name}</span>
                  <span className="block text-[11.5px] text-ink-4">{person.inVoice ? "Ses odasında" : person.online ? "Çevrimiçi" : "Çevrimdışı"}</span>
                </span>
              </button>
            </li>
          ))}
          {people.data && !list.length && <li className="px-3 text-[12.5px] text-ink-4">Kimse bulunamadı.</li>}
        </ul>
      </motion.div>
    </div>
  );
}

function ChannelGroup({ title, onAdd, children }: { title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">{title}</span>
        {onAdd && (
          <button onClick={onAdd} aria-label={`${title} ekle`} className="rounded-full p-1 text-ink-3 hover:bg-white/10 hover:text-ink">
            <Plus className="size-3.5" />
          </button>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ChannelRow({ active, icon, name, unread, live = false, onClick, onEdit }: { active: boolean; icon: React.ReactNode; name: string; unread: number; live?: boolean; onClick: () => void; onEdit?: () => void }) {
  return (
    <div className={cn("group flex h-10 items-center rounded-[12px] pr-1 transition-colors", active ? "bg-white/[0.12] text-ink" : "text-ink-2 hover:bg-white/[0.06]")}>
      <button onClick={onClick} className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-3 text-[14px]">
        <span className={cn(live ? "text-ok" : "text-ink-3")}>{icon}</span>
        <span className="min-w-0 flex-1 truncate text-left">{name}</span>
        {unread > 0 && <span className="tabular rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-[18px] text-white">{unread}</span>}
      </button>
      {onEdit && (
        <button onClick={onEdit} aria-label={`${name} düzenle`} className="rounded-full p-1.5 text-ink-4 opacity-0 hover:bg-white/10 hover:text-ink group-hover:opacity-100">
          <Settings2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function VoiceDock() {
  const voice = useVoice();
  const [picker, setPicker] = useState(false);
  const [settings, setSettings] = useState(false);
  const [shareMenu, setShareMenu] = useState(false);
  if (voice.status === "idle") return null;
  const ping = voice.ping ?? voice.serverPing;
  const tone = ping === null ? "text-ok" : ping < 120 ? "text-ok" : ping < 250 ? "text-warn" : "text-bad";
  return (
    <div className="relative mt-3 rounded-[18px] bg-white/[0.07] p-3 ring-1 ring-white/10">
      {voice.status === "error" ? (
        <div className="flex items-center gap-2 text-[12.5px] text-bad">
          <span className="min-w-0 flex-1">{voice.error}</span>
          <button onClick={() => void leaveVoice(false)} className="rounded-full p-1 text-ink-3 hover:text-ink"><X className="size-4" /></button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <p
              title={`Bağlantı gecikmesi${voice.ping !== null ? ` · eşler arası ${voice.ping} ms` : ""}${voice.serverPing !== null ? ` · sunucu ${voice.serverPing} ms` : ""}`}
              className={cn("flex flex-1 items-center gap-1.5 text-[12.5px] font-semibold", voice.status === "connected" ? tone : "text-warn")}
            >
              <Signal className="size-3.5" /> {voice.status === "connected" ? "Ses bağlı" : "Bağlanıyor…"}
              {voice.status === "connected" && ping !== null && <span className="tabular text-[11px] font-medium text-ink-3">{ping} ms</span>}
            </p>
            <button onClick={() => setSettings((value) => !value)} aria-label="Ses ayarları" className={cn("rounded-full p-1.5", settings ? "bg-white/15 text-ink" : "text-ink-3 hover:bg-white/10 hover:text-ink")}><Settings2 className="size-3.5" /></button>
          </div>
          <p className="truncate text-[12px] text-ink-3">{voice.channelName ?? ""}{voice.error ? ` · ${voice.error}` : ""}</p>
          <div className="mt-2.5 flex items-center gap-1.5">
            <DockButton label={voice.muted ? "Mikrofonu aç" : "Sessize al"} danger={voice.muted} onClick={toggleMute}>{voice.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}</DockButton>
            <DockButton label={voice.deafened ? "Sesi aç" : "Sağırlaştır"} danger={voice.deafened} onClick={toggleDeafen}>{voice.deafened ? <HeadphoneOff className="size-4" /> : <Headphones className="size-4" />}</DockButton>
            <DockButton label={voice.camera ? "Kamerayı kapat" : "Kamerayı aç"} active={voice.camera} onClick={() => void (voice.camera ? stopCamera() : startCamera())}>{voice.camera ? <CameraOff className="size-4" /> : <Camera className="size-4" />}</DockButton>
            <DockButton label={voice.sharing ? "Paylaşım seçenekleri" : "Ekran paylaş"} active={voice.sharing} onClick={() => (voice.sharing ? setShareMenu((value) => !value) : setPicker(true))}>{voice.sharing ? <MonitorUp className="size-4" /> : <MonitorUp className="size-4" />}</DockButton>
            <DockButton label="Ayrıl" danger onClick={() => void leaveVoice()}><PhoneOff className="size-4" /></DockButton>
          </div>
          {shareMenu && voice.sharing && (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button onClick={() => { setShareMenu(false); setPicker(true); }} className="rounded-[12px] bg-white/[0.08] px-2 py-2 text-[12px] text-ink hover:bg-white/[0.14]">Ekranı değiştir</button>
              <button onClick={() => { setShareMenu(false); void stopScreenShare(); }} className="rounded-[12px] bg-bad/20 px-2 py-2 text-[12px] text-bad hover:bg-bad/30">Paylaşımı durdur</button>
            </div>
          )}
        </>
      )}
      {settings && <VoiceSettings onClose={() => setSettings(false)} />}
      {picker && <ScreenPicker onClose={() => setPicker(false)} />}
    </div>
  );
}

function VoiceSettings({ onClose }: { onClose: () => void }) {
  const voice = useVoice();
  const [devices, setDeviceList] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState(getDevices());
  const [quality, setQuality] = useState(getShareQuality());
  useEffect(() => {
    void navigator.mediaDevices.enumerateDevices().then(setDeviceList).catch(() => undefined);
  }, []);
  const inputs = devices.filter((item) => item.kind === "audioinput");
  const outputs = devices.filter((item) => item.kind === "audiooutput");
  const label = (item: MediaDeviceInfo, index: number) => (item.deviceId === "default" ? `Varsayılan${item.label ? ` (${item.label.replace(/^Default - |^Varsayılan - /, "")})` : ""}` : item.label || `Aygıt ${index + 1}`);
  return (
    <div className="absolute bottom-full left-0 z-30 mb-2 w-full rounded-[18px] bg-[#1f1d1b] p-3 shadow-2xl ring-1 ring-white/10">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink">Ses ve görüntü</p>
        <button onClick={onClose} className="text-ink-3 hover:text-ink"><X className="size-4" /></button>
      </div>
      <label className="mb-2 block text-[11.5px] text-ink-4">
        Mikrofon
        <select value={selected.input} onChange={(event) => { const next = { ...selected, input: event.target.value }; setSelected(next); void setDevices({ input: event.target.value }); }} className="mt-1 h-9 w-full rounded-[10px] bg-black/40 px-2 text-[12.5px] text-ink outline-none ring-1 ring-white/10">
          {inputs.map((item, index) => <option key={item.deviceId} value={item.deviceId}>{label(item, index)}</option>)}
        </select>
      </label>
      <label className="mb-2 block text-[11.5px] text-ink-4">
        Kulaklık / hoparlör
        <select value={selected.output} onChange={(event) => { const next = { ...selected, output: event.target.value }; setSelected(next); void setDevices({ output: event.target.value }); }} className="mt-1 h-9 w-full rounded-[10px] bg-black/40 px-2 text-[12.5px] text-ink outline-none ring-1 ring-white/10">
          {outputs.map((item, index) => <option key={item.deviceId} value={item.deviceId}>{label(item, index)}</option>)}
        </select>
      </label>
      <p className="mb-1 mt-3 text-[11.5px] text-ink-4">Ekran paylaşım kalitesi</p>
      <div className="mb-2 grid grid-cols-4 gap-1">
        {([720, 1080, 1440, 0] as const).map((height) => (
          <button key={height} onClick={() => { const next = { ...quality, height }; setQuality(next); void setShareQuality({ height }); }} className={cn("rounded-[10px] py-1.5 text-[11.5px]", quality.height === height ? "accent-fill" : "bg-white/[0.07] text-ink-2 hover:bg-white/[0.12]")}>
            {height ? `${height}p` : "Kaynak"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {([15, 30, 60] as const).map((fps) => (
          <button key={fps} onClick={() => { const next = { ...quality, fps }; setQuality(next); void setShareQuality({ fps }); }} className={cn("rounded-[10px] py-1.5 text-[11.5px]", quality.fps === fps ? "accent-fill" : "bg-white/[0.07] text-ink-2 hover:bg-white/[0.12]")}>
            {fps} FPS
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-4">{voice.sharing ? "Değişiklik açık paylaşıma hemen uygulanır." : "Bir sonraki paylaşımda kullanılır."}</p>
    </div>
  );
}

function DockButton({ label, onClick, danger = false, active = false, children }: { label: string; onClick: () => void; danger?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className={cn("flex h-9 flex-1 items-center justify-center rounded-[10px] transition", danger ? "bg-bad/20 text-bad hover:bg-bad/30" : active ? "bg-accent/25 text-accent-2" : "bg-white/[0.08] text-ink hover:bg-white/[0.14]")}>
      {children}
    </button>
  );
}

function ScreenPicker({ onClose }: { onClose: () => void }) {
  const [sources, setSources] = useState<{ id: string; name: string; thumbnail: string; display: boolean }[] | null>(null);
  const voice = useVoice();
  useEffect(() => {
    void bridge.system.screenSources().then(setSources);
  }, []);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-md" onClick={onClose}>
      <div className="glass-sheet w-[760px] max-w-[92vw] rounded-[26px] p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-ink">{voice.sharing ? "Paylaşılan ekranı değiştir" : "Neyi paylaşmak istersin?"}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 hover:bg-white/10"><X className="size-4" /></button>
        </div>
        {!sources ? (
          <Skeleton className="h-48 rounded-[18px]" />
        ) : (
          <div className="scroll-area grid max-h-[60vh] grid-cols-3 gap-3">
            {sources.map((source) => (
              <button
                key={source.id}
                onClick={() => {
                  onClose();
                  void startScreenShare(source.id);
                }}
                className="group rounded-[16px] p-2 text-left transition hover:bg-white/[0.08]"
              >
                <img src={source.thumbnail} alt="" className="aspect-video w-full rounded-[10px] bg-black/40 object-contain ring-1 ring-white/10 group-hover:ring-accent" />
                <span className="mt-1.5 flex items-center gap-1.5 truncate text-[12.5px] text-ink-2">{source.display ? <Monitor className="size-3.5" /> : <AppWindow className="size-3.5" />} {source.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VoiceStage({ channel }: { channel: ChatChannel }) {
  const voice = useVoice();
  const joined = voice.channelId === channel.id && voice.status === "connected";
  const [focus, setFocus] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [theater, setTheater] = useState<string | null>(null);
  const [tuning, setTuning] = useState<string | null>(null);
  const sharing = joined ? voice.peers.filter((peer) => peer.hasScreen) : [];
  const visible = sharing.filter((peer) => !hidden.has(peer.id));
  const featured = visible.find((peer) => peer.id === focus) ?? visible[0] ?? null;
  const theaterPeer = theater ? sharing.find((peer) => peer.id === theater) ?? null : null;

  useEffect(() => {
    if (theater && !theaterPeer) setTheater(null);
  }, [theater, theaterPeer]);

  const watch = (id: string) => {
    setHidden((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    setFocus(id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-white/8 px-7 py-4">
        <span className="icon-ring flex size-10 items-center justify-center rounded-full text-ink"><Volume2 className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold text-ink">{channel.name}</h2>
          <p className="truncate text-[12.5px] text-ink-3">{channel.topic ?? (channel.limit ? `En fazla ${channel.limit} kişi` : "Ses kanalı")}</p>
        </div>
        {sharing.length > 0 && (
          <div className="flex items-center gap-1.5">
            {sharing.map((peer) => (
              <button key={peer.id} onClick={() => (hidden.has(peer.id) || featured?.id !== peer.id ? watch(peer.id) : setHidden((set) => new Set(set).add(peer.id)))} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px]", featured?.id === peer.id ? "accent-fill" : "bg-white/[0.08] text-ink-2 hover:bg-white/[0.14]")}>
                <MonitorUp className="size-3.5" /> {peer.me ? "Senin ekranın" : peer.name}
              </button>
            ))}
          </div>
        )}
        {!joined ? (
          <Button variant="accent" onClick={() => void joinVoice(channel.id)} loading={voice.status === "connecting" && voice.channelId === channel.id}>
            <Phone className="size-4" /> Katıl
          </Button>
        ) : (
          <Button variant="ghost" className="text-bad" onClick={() => void leaveVoice()}>
            <PhoneOff className="size-4" /> Ayrıl
          </Button>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        {featured && (
          <ScreenView
            key={featured.id}
            peerId={featured.id}
            name={featured.me ? "Senin ekranın" : `${featured.name} ekranını paylaşıyor`}
            onTheater={() => setTheater(featured.id)}
            onHide={() => setHidden((set) => new Set(set).add(featured.id))}
          />
        )}
        <div className={cn("grid content-start gap-3", featured ? "grid-cols-[repeat(auto-fill,minmax(150px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(210px,1fr))]")}>
          {(joined ? voice.peers : (channel.peers ?? []).map((peer) => ({ ...peer, me: false, speaking: false, connection: "new" as const, hasScreen: peer.sharing, hasCamera: false }))).map((peer) => (
            <div
              key={peer.id}
              onClick={() => peer.hasScreen && joined && watch(peer.id)}
              onContextMenu={(event) => {
                if (!joined || peer.me) return;
                event.preventDefault();
                setTuning(tuning === peer.id ? null : peer.id);
              }}
              className={cn("relative flex flex-col items-center justify-center gap-2.5 overflow-hidden rounded-[22px] bg-white/[0.06] ring-2 transition", featured ? "py-4" : "aspect-[4/3]", peer.speaking ? "ring-ok" : "ring-transparent", peer.hasScreen && "cursor-pointer")}
            >
              {peer.hasCamera && !featured ? <CameraView peerId={peer.id} mirror={peer.me} /> : <Avatar name={peer.name} src={peer.avatarUrl} size={featured ? 44 : 72} />}
              {joined && !peer.me && (
                <button onClick={(event) => { event.stopPropagation(); setTuning(tuning === peer.id ? null : peer.id); }} className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 text-ink-2 hover:text-ink" aria-label="Ses düzeyi">
                  <Volume2 className="size-3.5" />
                </button>
              )}
              {peer.hasScreen && joined && (hidden.has(peer.id) || featured?.id !== peer.id) && (
                <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-white">İzle</span>
              )}
              {tuning === peer.id && (
                <div onClick={(event) => event.stopPropagation()} className="absolute inset-x-3 bottom-3 z-10 rounded-[14px] bg-black/75 p-3 text-left backdrop-blur">
                  <p className="mb-1.5 flex justify-between text-[11.5px] text-ink-2"><span>{peer.name} ses düzeyi</span><span className="tabular-nums">%{voice.volumes[peer.userId] ?? 100}</span></p>
                  <input type="range" min={0} max={100} value={voice.volumes[peer.userId] ?? 100} onChange={(event) => setPeerVolume(peer.userId, Number(event.target.value))} className="w-full accent-[var(--color-accent,#8b5cf6)]" />
                  <button onClick={() => setPeerVolume(peer.userId, (voice.volumes[peer.userId] ?? 100) === 0 ? 100 : 0)} className="mt-1.5 text-[11.5px] text-accent-2 hover:underline">{(voice.volumes[peer.userId] ?? 100) === 0 ? "Sesini aç" : "Benim için sustur"}</button>
                </div>
              )}
              <span className="relative flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                {peer.name}
                {peer.me && <span className="text-[11px] text-ink-4">(sen)</span>}
              </span>
              <span className="relative flex items-center gap-1.5 text-ink-3">
                {peer.hasScreen && <MonitorUp className="size-3.5 text-accent-2" />}
                {peer.deafened ? <HeadphoneOff className="size-3.5 text-bad" /> : peer.muted ? <MicOff className="size-3.5 text-bad" /> : <Mic className="size-3.5" />}
                {joined && !peer.me && (voice.volumes[peer.userId] ?? 100) === 0 && <Volume2 className="size-3.5 text-bad" />}
                {joined && !peer.me && peer.connection !== "connected" && <span className="text-[11px] text-warn">bağlanıyor</span>}
              </span>
            </div>
          ))}
        </div>
        {!joined && (channel.peers ?? []).length === 0 && <Empty icon={<Volume2 />} title="Kanal boş" body="Katılan ilk kişi sen ol." />}
      </div>
      <AnimatePresence>
        {theaterPeer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[85] bg-black" onKeyDown={(event) => event.key === "Escape" && setTheater(null)} tabIndex={-1} ref={(node) => node?.focus()}>
            <StreamVideo peerId={theaterPeer.id} className="h-full w-full object-contain" />
            <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-5 py-4 text-white">
              <span className="text-[13.5px] font-medium">{theaterPeer.me ? "Senin ekranın" : `${theaterPeer.name} ekranını paylaşıyor`}</span>
              <span className="flex-1" />
              <span className="text-[12px] text-white/60">Çıkmak için Esc</span>
              <button onClick={() => setTheater(null)} className="flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-4 text-[13px] hover:bg-white/25"><Minimize2 className="size-4" /> Küçült</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StreamVideo({ peerId, className }: { peerId: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const voice = useVoice();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const stream = remoteScreen(peerId);
    if (element.srcObject !== stream) element.srcObject = stream;
    if (stream && element.paused) void element.play().catch(() => undefined);
  });
  useEffect(() => {
    const onVisible = () => {
      const element = ref.current;
      if (!element) return;
      element.srcObject = remoteScreen(peerId);
      void element.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [peerId, voice.peers.length]);
  return <video ref={ref} autoPlay playsInline muted className={className} />;
}

function CameraView({ peerId, mirror }: { peerId: string; mirror: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const voice = useVoice();
  useEffect(() => {
    const stream = remoteCamera(peerId);
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [peerId, voice]);
  return <video ref={ref} autoPlay playsInline muted className={cn("absolute inset-0 h-full w-full object-cover", mirror && "-scale-x-100")} />;
}

function ScreenView({ peerId, name, onTheater, onHide }: { peerId: string; name: string; onTheater: () => void; onHide: () => void }) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-[20px] bg-black" onDoubleClick={onTheater}>
      <StreamVideo peerId={peerId} className="h-full w-full object-contain" />
      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-[12px] text-white">{name}</span>
      <div className="absolute right-3 top-3 flex gap-1.5">
        <button onClick={onHide} className="flex h-8 items-center gap-1.5 rounded-full bg-black/60 px-3 text-[12px] text-white hover:bg-black/80"><EyeOff className="size-3.5" /> İzlemeyi bırak</button>
        <button onClick={onTheater} className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80" aria-label="Tam ekran"><Maximize2 className="size-4" /></button>
      </div>
    </div>
  );
}

const MIN_ROLES = [
  { value: "SUPPORT", label: "Tüm ekip" },
  { value: "MODERATOR", label: "Moderatör ve üstü" },
  { value: "ADMIN", label: "Yöneticiler" },
  { value: "OWNER", label: "Kurucular" },
];

function ChannelEditor({ target, onClose, onDeleted }: { target: ChatChannel | "new-text" | "new-voice"; onClose: () => void; onDeleted: () => void }) {
  const session = useSession();
  const creating = typeof target === "string";
  const kind = creating ? (target === "new-voice" ? "voice" : "text") : (target.kind === "voice" ? "voice" : "text");
  const [name, setName] = useState(creating ? "" : target.name);
  const [topic, setTopic] = useState(creating ? "" : (target.topic ?? ""));
  const [limit, setLimit] = useState(creating ? "" : target.limit ? String(target.limit) : "");
  const [minRole, setMinRole] = useState(creating ? "SUPPORT" : (target.minRole ?? "SUPPORT"));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const payload = { name: name.trim(), topic: topic.trim(), minRole, ...(kind === "voice" ? { limit: limit ? Number(limit) : null } : {}) };
    const result = creating ? await voiceApi.createChannel({ ...payload, kind }) : await voiceApi.updateChannel(target.id, payload);
    setBusy(false);
    if (!result.ok) return session.toast(result.message, "bad");
    session.toast(creating ? "Kanal oluşturuldu" : "Kanal güncellendi", "ok");
    invalidate("chat:channels");
    onClose();
  };

  const remove = async () => {
    if (creating || !window.confirm(`#${target.name} kanalı ve tüm mesajları silinsin mi?`)) return;
    setBusy(true);
    const result = await voiceApi.deleteChannel(target.id);
    setBusy(false);
    if (!result.ok) return session.toast(result.message, "bad");
    invalidate("chat:channels");
    onDeleted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-md" onClick={onClose}>
      <form
        className="glass-sheet w-[440px] rounded-[26px] p-6"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h3 className="text-[18px] font-semibold text-ink">{creating ? (kind === "voice" ? "Ses kanalı oluştur" : "Metin kanalı oluştur") : "Kanalı düzenle"}</h3>
        <label className="mt-4 block text-[12px] font-medium text-ink-3">Kanal adı</label>
        <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder={kind === "voice" ? "Toplantı odası" : "genel"} className="mt-1 h-10 w-full rounded-[12px] bg-black/30 px-3 text-[14px] text-ink outline-none ring-1 ring-white/10 focus:ring-accent/60" />
        <label className="mt-3 block text-[12px] font-medium text-ink-3">Konu (isteğe bağlı)</label>
        <input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={200} className="mt-1 h-10 w-full rounded-[12px] bg-black/30 px-3 text-[14px] text-ink outline-none ring-1 ring-white/10 focus:ring-accent/60" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-ink-3">Kimler görebilir</label>
            <select value={minRole} onChange={(event) => setMinRole(event.target.value as typeof minRole)} className="mt-1 h-10 w-full rounded-[12px] bg-black/30 px-3 text-[13.5px] text-ink outline-none ring-1 ring-white/10">
              {MIN_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </div>
          {kind === "voice" && (
            <div>
              <label className="block text-[12px] font-medium text-ink-3">Kişi sınırı</label>
              <input value={limit} onChange={(event) => setLimit(event.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Sınırsız" className="mt-1 h-10 w-full rounded-[12px] bg-black/30 px-3 text-[14px] text-ink outline-none ring-1 ring-white/10 focus:ring-accent/60" />
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center gap-2">
          {!creating && (
            <Button type="button" variant="ghost" className="text-bad" disabled={busy} onClick={() => void remove()}>
              <Trash2 className="size-4" /> Sil
            </Button>
          )}
          <span className="flex-1" />
          <Button type="button" variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button type="submit" variant="accent" loading={busy} disabled={name.trim().length < 2}>{creating ? "Oluştur" : "Kaydet"}</Button>
        </div>
      </form>
    </div>
  );
}
