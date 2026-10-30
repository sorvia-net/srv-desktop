import { Camera, Check, RefreshCw, ScanFace, ExternalLink, ImagePlus, Info, Keyboard, LogOut, Mail, Monitor, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ACCENTS, DENSITIES, ICON_SIZES, SOUNDS, TOAST_POSITIONS, type NotificationSound, UI_STYLES, WALLPAPER_LABEL, type ToastPosition, type Accent, type Density, type IconSize, type UiStyle, type Wallpaper } from "@shared/appearance";
import type { MailAccountInfo, UpdateStatus } from "@shared/contracts";
import { comboFromEvent, resolveShortcuts, SHORTCUT_ACTIONS, type ShortcutAction } from "@shared/shortcuts";
import { isPreview } from "@/data/api";
import { bridge } from "@/data/bridge";
import { invalidate, useQuery } from "@/data/query";
import { helloAvailable } from "@/data/hello";
import { playSound } from "@/data/sound";
import { Avatar, cn, Kbd, Segmented, Spinner, Switch } from "@/design/ui";
import { useOs } from "@/os/state";
import { useSession } from "@/shell/context";

const WALLPAPER_PREVIEW: Record<Exclude<Wallpaper, "custom">, string> = {
  ember: "radial-gradient(circle at 50% 0%, #ffcf8f 0%, #b56a2c 30%, #2a1f19 65%), radial-gradient(circle at 90% 100%, #e07a2e, transparent 40%)",
  dusk: "radial-gradient(circle at 50% 0%, #f5c6c0 0%, #9a5a86 32%, #241b26 66%)",
  noir: "radial-gradient(circle at 50% 0%, #c9a882 0%, #5a4232 30%, #151210 66%)",
  ocean: "radial-gradient(circle at 50% 0%, #c6e8ff 0%, #2f80ed 32%, #0c151d 68%)",
  forest: "radial-gradient(circle at 50% 0%, #e2ffd0 0%, #3fa34d 32%, #0f1912 68%)",
  graphite: "radial-gradient(circle at 50% 0%, #e6e8ee 0%, #5d636f 32%, #141518 68%)",
};

export function Settings() {
  const session = useSession();
  const prefs = session.prefs;
  const server = session.auth.status === "signedIn" ? session.auth.server : session.preview ? "Önizleme" : "-";
  const expires = session.auth.status === "signedIn" ? new Date(session.auth.expiresAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "-";
  const [avatarBusy, setAvatarBusy] = useState(false);

  const changeAvatar = async (remove = false) => {
    if (session.preview) return session.toast("Önizlemede profil fotoğrafı değişmez", "info");
    setAvatarBusy(true);
    const result = remove ? await bridge.account.removeAvatar() : await bridge.account.pickAvatar();
    setAvatarBusy(false);
    if (!result) return;
    session.toast(result.ok ? (remove ? "Profil fotoğrafı kaldırıldı" : "Profil fotoğrafı güncellendi") : result.message, result.ok ? "ok" : "bad");
  };

  return (
    <div className="scroll-area fade-bottom -mr-3 h-full pr-3">
      <div className="mx-auto max-w-[780px] pb-10">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Ayarlar</h1>
        <p className="mb-7 mt-1 text-[14px] text-ink-2">Hesap, görünüm, kısayollar ve uygulama tercihleri</p>

        <Group title="Hesap">
          <div className="flex items-center gap-4 px-5 py-4">
            <button onClick={() => void changeAvatar()} className="group relative shrink-0 rounded-full" title="Profil fotoğrafını değiştir">
              <Avatar name={session.user.name} src={session.user.avatarUrl} size={64} />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                {avatarBusy ? <Spinner className="size-5" /> : <Camera className="size-5 text-white" />}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold text-ink">{session.user.name}</p>
              <p className="truncate text-[13px] text-ink-3">{session.user.email}</p>
              <div className="mt-1.5 flex gap-3 text-[12.5px]">
                <button className="font-medium text-accent-2 hover:underline" onClick={() => void changeAvatar()}>Fotoğrafı değiştir</button>
                {session.user.avatarUrl && <button className="text-ink-3 hover:text-bad" onClick={() => void changeAvatar(true)}>Kaldır</button>}
              </div>
            </div>
            <span className="rounded-full bg-accent/15 px-3 py-1 text-[12px] font-semibold text-accent-2">{session.user.roleLabel}</span>
          </div>
          <FaceUnlock />
          <Row label="Sunucu" value={server} />
          <Row label="Oturum geçerlilik" value={expires} />
          <button onClick={session.logout} className="focus-ring flex w-full items-center gap-3 px-5 py-3.5 text-left text-[14px] font-medium text-bad hover:bg-white/[0.04]">
            <LogOut className="size-4" /> {session.preview ? "Önizlemeden çık" : "Oturumu kapat"}
          </button>
        </Group>

        <Appearance />

        <MailAccounts />

        <Group title="Bildirimler" footer="Rahatsız etmeyin açıkken Windows bildirimleri susar; bildirimler merkezde birikmeye devam eder.">
          <Toggle label="Windows bildirimleri" checked={prefs.nativeNotifications} onChange={(value) => session.setPrefs({ nativeNotifications: value })} />
          <Toggle label="Rahatsız etmeyin" checked={prefs.doNotDisturb} onChange={(value) => session.setPrefs({ doNotDisturb: value })} />
          <Choice<NotificationSound>
            label="Bildirim sesi"
            value={prefs.notificationSound}
            onChange={(value) => {
              session.setPrefs({ notificationSound: value });
              playSound(value, true);
            }}
            options={(Object.keys(SOUNDS) as NotificationSound[]).map((value) => ({ value, label: SOUNDS[value] }))}
          />
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="text-[14px] text-ink">Uygulama içi bildirim konumu</span>
            <div className="grid grid-cols-3 gap-1.5 rounded-[14px] bg-black/25 p-1.5">
              {(Object.keys(TOAST_POSITIONS) as ToastPosition[]).map((value) => (
                <button
                  key={value}
                  title={TOAST_POSITIONS[value]}
                  aria-label={TOAST_POSITIONS[value]}
                  onClick={() => {
                    session.setPrefs({ toastPosition: value });
                    session.toast(`Bildirimler: ${TOAST_POSITIONS[value]}`, "info");
                  }}
                  className={cn("relative h-9 w-14 rounded-[8px] transition", prefs.toastPosition === value ? "bg-accent/25 ring-1 ring-accent" : "bg-white/[0.06] hover:bg-white/[0.12]")}
                >
                  <span className={cn("absolute h-1.5 w-5 rounded-full", prefs.toastPosition === value ? "bg-accent-2" : "bg-white/40", value.startsWith("top") ? "top-1.5" : "bottom-1.5", value.endsWith("left") ? "left-1.5" : value.endsWith("right") ? "right-1.5" : "left-1/2 -translate-x-1/2")} />
                </button>
              ))}
            </div>
          </div>
          <Choice label="Yenileme sıklığı" value={String(prefs.pollSeconds)} onChange={(value) => session.setPrefs({ pollSeconds: Number(value) })} options={[{ value: "30", label: "30 sn" }, { value: "45", label: "45 sn" }, { value: "90", label: "90 sn" }]} />
          <Choice label="Otomatik kilit" value={String(prefs.autoLockMinutes)} onChange={(value) => session.setPrefs({ autoLockMinutes: Number(value) })} options={[{ value: "0", label: "Kapalı" }, { value: "5", label: "5 dk" }, { value: "15", label: "15 dk" }, { value: "30", label: "30 dk" }]} />
        </Group>

        <Shortcuts />

        <Group title="Sistem">
          <Toggle label="Windows açılınca başlat" checked={prefs.launchAtLogin} onChange={(value) => session.setPrefs({ launchAtLogin: value })} icon={<Monitor className="size-4" />} />
          <Toggle label="Kapatınca sistem tepsisinde çalış" checked={prefs.closeToTray} onChange={(value) => session.setPrefs({ closeToTray: value })} />
          <Toggle label="Dış görselleri postalarda her zaman göster" checked={prefs.showRemoteImages} onChange={(value) => session.setPrefs({ showRemoteImages: value })} />
        </Group>

        <SoftwareUpdate />

        <Group title="Hakkında">
          <Row label="Sorvia Desktop" value={`Sürüm ${bridge.version}`} icon={<Info className="size-4" />} />
          <button onClick={() => void bridge.system.openExternal("https://sorvia.net/panel/hesap/guvenlik")} className="focus-ring flex w-full items-center justify-between px-5 py-3.5 text-left text-[14px] text-ink hover:bg-white/[0.04]">
            Oturumlarımı yönet (sorvia.net)
            <ExternalLink className="size-4 text-ink-3" />
          </button>
        </Group>
      </div>
    </div>
  );
}

function Appearance() {
  const session = useSession();
  const prefs = session.prefs;
  const pickCustom = async () => {
    if (session.preview) return session.toast("Önizlemede kendi görselini seçemezsin", "info");
    const image = await bridge.system.pickWallpaper();
    if (image) {
      session.setPrefs({ wallpaper: "custom" });
      window.dispatchEvent(new Event("sorvia:wallpaper"));
    }
  };
  return (
    <Group title="Görünüm">
      <div className="px-5 py-4">
        <p className="mb-3 text-[13px] font-medium text-ink-2">Arka plan</p>
        <div className="grid grid-cols-4 gap-3">
          {(Object.keys(WALLPAPER_PREVIEW) as Exclude<Wallpaper, "custom">[]).map((id) => (
            <button key={id} onClick={() => session.setPrefs({ wallpaper: id })} className="focus-ring group text-center outline-none">
              <span className={cn("block h-[72px] rounded-[14px] ring-2 transition-all", prefs.wallpaper === id ? "ring-accent" : "ring-white/10 group-hover:ring-white/25")} style={{ background: WALLPAPER_PREVIEW[id] }} />
              <span className={cn("mt-1.5 block text-[12px]", prefs.wallpaper === id ? "font-semibold text-ink" : "text-ink-2")}>{WALLPAPER_LABEL[id]}</span>
            </button>
          ))}
          <button onClick={() => void pickCustom()} className="focus-ring group text-center outline-none">
            <span className={cn("flex h-[72px] items-center justify-center rounded-[14px] bg-white/[0.06] ring-2 transition-all", prefs.wallpaper === "custom" ? "ring-accent" : "ring-white/10 group-hover:ring-white/25")}>
              <ImagePlus className="size-6 text-ink-2" />
            </span>
            <span className={cn("mt-1.5 block text-[12px]", prefs.wallpaper === "custom" ? "font-semibold text-ink" : "text-ink-2")}>{prefs.wallpaper === "custom" ? "Görseli değiştir" : WALLPAPER_LABEL.custom}</span>
          </button>
        </div>
      </div>
      <div className="px-5 py-4">
        <p className="mb-3 text-[13px] font-medium text-ink-2">Renk teması</p>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(ACCENTS) as Accent[]).map((id) => (
            <button key={id} onClick={() => session.setPrefs({ accent: id })} title={ACCENTS[id].label} className="focus-ring flex flex-col items-center gap-1.5 outline-none">
              <span className={cn("flex size-10 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-[#1e1a18] transition", prefs.accent === id ? "ring-white" : "ring-transparent hover:ring-white/30")} style={{ background: `linear-gradient(160deg, ${ACCENTS[id].soft}, ${ACCENTS[id].base})` }}>
                {prefs.accent === id && <Check className="size-5 text-white" strokeWidth={3} />}
              </span>
              <span className="text-[11.5px] text-ink-3">{ACCENTS[id].label}</span>
            </button>
          ))}
        </div>
      </div>
      <Choice<UiStyle> label="Arayüz tarzı" value={prefs.uiStyle} onChange={(value) => session.setPrefs({ uiStyle: value })} options={(Object.keys(UI_STYLES) as UiStyle[]).map((value) => ({ value, label: UI_STYLES[value] }))} />
      <Choice<IconSize> label="Simge boyutu" value={prefs.iconSize} onChange={(value) => session.setPrefs({ iconSize: value })} options={[{ value: "small", label: "Küçük" }, { value: "medium", label: "Orta" }, { value: "large", label: "Büyük" }].filter((item) => item.value in ICON_SIZES) as { value: IconSize; label: string }[]} />
      <Choice<Density> label="Yoğunluk" value={prefs.density} onChange={(value) => session.setPrefs({ density: value })} options={(Object.keys(DENSITIES) as Density[]).map((value) => ({ value, label: DENSITIES[value] }))} />
    </Group>
  );
}

function MailAccounts() {
  const session = useSession();
  const os = useOs();
  const accounts = useQuery<MailAccountInfo[]>("mail:accounts", async () => ({ ok: true, data: isPreview() ? [] : await bridge.mail.accounts() }));
  const list = accounts.data ?? [];
  const refresh = () => {
    invalidate("mail:");
  };
  return (
    <Group title="Posta hesapları" footer="Birden fazla hesap ekleyip Mail uygulamasından ya da kısayolla hesaplar arasında geçebilirsin. Parolalar yalnızca bu bilgisayarda şifreli saklanır.">
      {list.map((item) => (
        <div key={item.id} className="flex items-center gap-3 px-5 py-3">
          <Avatar name={item.name || item.address} size={34} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] text-ink">{item.address}</span>
            <span className="text-[12px] text-ink-3">{item.active ? (item.lastError ? item.lastError : "Etkin hesap") : "Bekleyen hesap"}</span>
          </span>
          {item.active ? (
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-accent-2">Etkin</span>
          ) : (
            <button
              className="text-[12.5px] font-medium text-accent-2 hover:underline"
              onClick={async () => {
                await bridge.mail.switchAccount(item.id);
                refresh();
                session.toast(`Posta: ${item.address}`, "ok");
              }}
            >
              Geç
            </button>
          )}
          <button
            aria-label="Hesabı kaldır"
            className="rounded-full p-1.5 text-ink-3 hover:bg-white/10 hover:text-bad"
            onClick={async () => {
              if (!window.confirm(`${item.address} bu bilgisayardan kaldırılsın mı?`)) return;
              await bridge.mail.disconnect(item.id);
              refresh();
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      {list.length === 0 && <Row label="Bağlı hesap" value="Yok" icon={<Mail className="size-4" />} />}
      <button onClick={() => os.openApp("mail", { add: "1" })} className="focus-ring flex w-full items-center gap-3 px-5 py-3.5 text-left text-[14px] font-medium text-accent-2 hover:bg-white/[0.04]">
        <Plus className="size-4" /> Hesap ekle
      </button>
    </Group>
  );
}

function Shortcuts() {
  const session = useSession();
  const map = resolveShortcuts(session.prefs.shortcuts);
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const save = (action: ShortcutAction, combo: string) => {
    const taken = (Object.keys(map) as ShortcutAction[]).find((other) => other !== action && combo && map[other] === combo);
    if (taken) return session.toast(`${combo} zaten “${SHORTCUT_ACTIONS.find((item) => item.id === taken)?.label}” için kullanılıyor`, "bad");
    session.setPrefs({ shortcuts: { ...session.prefs.shortcuts, [action]: combo } });
    setRecording(null);
  };
  return (
    <Group title="Klavye kısayolları" footer="Değiştirmek için kısayola tıkla ve yeni tuş birleşimine bas. Esc vazgeçer, Backspace kısayolu kapatır. Ctrl+1–9 uygulamalar arasında geçer.">
      {SHORTCUT_ACTIONS.map((action) => (
        <div key={action.id} className="flex items-center gap-3 px-5 py-2.5">
          <Keyboard className="size-4 text-ink-3" />
          <span className="flex-1 text-[14px] text-ink">{action.label}</span>
          <button
            data-shortcut-recorder="1"
            onClick={() => setRecording(recording === action.id ? null : action.id)}
            onBlur={() => recording === action.id && setRecording(null)}
            onKeyDown={(event) => {
              if (recording !== action.id) return;
              event.preventDefault();
              event.stopPropagation();
              if (event.key === "Escape") return setRecording(null);
              if (event.key === "Backspace") return save(action.id, "");
              const combo = comboFromEvent(event);
              if (combo) save(action.id, combo);
            }}
            className={cn("focus-ring min-w-[132px] rounded-[10px] px-2.5 py-1.5 text-right transition", recording === action.id ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-white/[0.06]")}
          >
            {recording === action.id ? (
              <span className="text-[12.5px] text-accent-2">Tuşlara bas…</span>
            ) : map[action.id] ? (
              <span className="flex justify-end gap-1">{map[action.id].split("+").map((key) => <Kbd key={key}>{key}</Kbd>)}</span>
            ) : (
              <span className="text-[12.5px] text-ink-4">Kapalı</span>
            )}
          </button>
          {session.prefs.shortcuts[action.id] !== undefined && (
            <button
              aria-label="Varsayılana döndür"
              title={`Varsayılan: ${action.fallback}`}
              className="rounded-full p-1 text-ink-3 hover:text-ink"
              onClick={() => {
                const next = { ...session.prefs.shortcuts };
                delete next[action.id];
                session.setPrefs({ shortcuts: next });
              }}
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
        </div>
      ))}
    </Group>
  );
}

function Group({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 px-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">{title}</h2>
      <div className="glass-card divide-y divide-white/[0.07] overflow-hidden rounded-[22px]">{children}</div>
      {footer && <p className="mt-2 px-5 text-[12px] leading-relaxed text-ink-4">{footer}</p>}
    </section>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      {icon && <span className="text-ink-3">{icon}</span>}
      <span className="flex-1 text-[14px] text-ink">{label}</span>
      <span className="truncate text-[13.5px] text-ink-3">{value}</span>
    </div>
  );
}

function Toggle({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (value: boolean) => void; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      {icon && <span className="text-ink-3">{icon}</span>}
      <span className="flex-1 text-[14px] text-ink">{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <span className="text-[14px] text-ink">{label}</span>
      <Segmented<T> size="sm" value={value} onChange={onChange} options={options} />
    </div>
  );
}

const UPDATE_TEXT: Record<UpdateStatus["state"], string> = {
  idle: "Güncellemeler her açılışta ve 4 saatte bir otomatik denetlenir.",
  checking: "Güncellemeler denetleniyor…",
  latest: "Sorvia Desktop güncel.",
  downloading: "Güncelleme indiriliyor…",
  ready: "Güncelleme hazır. Yeniden başlatınca kurulacak.",
  error: "Güncelleme denetlenemedi.",
  unavailable: "Bu sürümde güncelleme yapılamıyor.",
};

function SoftwareUpdate() {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle", version: null, percent: null, message: null });
  useEffect(() => {
    void bridge.system.updateStatus().then(setStatus);
    return bridge.system.onUpdateStatus(setStatus);
  }, []);
  const busy = status.state === "checking" || status.state === "downloading";
  return (
    <Group title="Yazılım güncelleme">
      <div className="flex items-center gap-4 px-5 py-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-[14px]", status.state === "ready" ? "accent-fill" : "bg-white/[0.08] text-ink-2")}>
          {busy ? <Spinner className="size-5" /> : <RefreshCw className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">
            Sorvia Desktop {status.state === "ready" || status.state === "downloading" ? status.version : bridge.version}
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">{status.message ?? UPDATE_TEXT[status.state]}</p>
          {status.state === "downloading" && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${status.percent ?? 0}%` }} />
            </div>
          )}
        </div>
        {status.state === "ready" ? (
          <button onClick={() => bridge.system.installUpdate()} className="accent-fill rounded-full px-4 py-2 text-[13px] font-semibold">
            Yeniden başlat ve yükle
          </button>
        ) : (
          <button disabled={busy} onClick={() => void bridge.system.updateNow().then(setStatus)} className="rounded-full bg-white/[0.09] px-4 py-2 text-[13px] font-medium text-ink hover:bg-white/[0.14] disabled:opacity-50">
            {busy ? (status.state === "downloading" ? `%${status.percent ?? 0}` : "Denetleniyor…") : "Güncellemeleri denetle"}
          </button>
        )}
      </div>
    </Group>
  );
}

function FaceUnlock() {
  const session = useSession();
  const [hello, setHello] = useState<boolean | null>(null);
  useEffect(() => {
    void helloAvailable().then(setHello);
  }, []);
  const methods = session.user.unlock ?? { password: true, passkey: false };
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const setup = async () => {
    if (session.preview) return session.toast("Önizlemede yüz tanıma kurulmaz", "info");
    if (methods.password && !asking) return setAsking(true);
    setBusy(true);
    const result = await bridge.system.passkeySetup(password);
    setBusy(false);
    if (!result.ok) {
      if (result.error !== "cancelled") session.toast(result.message, "bad");
      return;
    }
    setAsking(false);
    setPassword("");
    session.toast("Windows Hello kuruldu; kilit ekranında kendiliğinden başlayacak", "ok");
  };

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3.5">
        <ScanFace className="size-4 text-ink-3" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] text-ink">Windows Hello (yüz, PIN, parmak izi)</span>
          <span className="block text-[12px] text-ink-3">
            {hello === false ? "Bu bilgisayarda Windows Hello açık değil. Önce Windows'ta bir PIN tanımla." : methods.passkey ? "Kurulu · kilit ekranı Windows Hello ile açılır" : "Kilidi yüzün, PIN'in ya da parmak izinle aç"}
          </span>
        </span>
        {hello === false && (
          <button onClick={() => void bridge.system.openBrowser("ms-settings:signinoptions")} className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-[12.5px] font-medium text-ink hover:bg-white/[0.14]">
            Windows ayarları
          </button>
        )}
        {hello !== false && !asking && (
          <button disabled={busy} onClick={() => void setup()} className={cn("rounded-full px-3.5 py-1.5 text-[12.5px] font-medium", methods.passkey ? "bg-white/[0.08] text-ink hover:bg-white/[0.14]" : "accent-fill")}>
            {busy ? "Bekleniyor…" : methods.passkey ? "Bu cihazı yeniden ekle" : "Kur"}
          </button>
        )}
      </div>
      {asking && (
        <form
          className="flex items-center gap-2 px-5 pb-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            void setup();
          }}
        >
          <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Onay için hesap parolan" className="h-9 min-w-0 flex-1 rounded-[10px] bg-black/30 px-3 text-[13px] text-ink outline-none ring-1 ring-white/10 focus:ring-accent/60" />
          <button type="submit" disabled={!password || busy} className="accent-fill rounded-full px-4 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">{busy ? "Bekleniyor…" : "Devam"}</button>
          <button type="button" onClick={() => setAsking(false)} className="text-[12.5px] text-ink-3 hover:text-ink">Vazgeç</button>
        </form>
      )}
      {methods.passkey && <Toggle label="Kilit ekranında Windows Hello'yu kendiliğinden başlat" checked={session.prefs.faceAuto} onChange={(value) => session.setPrefs({ faceAuto: value })} />}
    </>
  );
}
