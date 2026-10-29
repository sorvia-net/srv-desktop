import { ExternalLink, Info, LogOut, Mail, Monitor } from "lucide-react";
import type { ReactNode } from "react";

import type { MailAccountInfo, Preferences, UpdateInfo } from "@shared/contracts";
import { mailApi } from "@/data/api";
import { bridge } from "@/data/bridge";
import { invalidate, useQuery } from "@/data/query";
import { Avatar, cn, Kbd, Segmented, Switch } from "@/design/ui";
import { useSession } from "@/shell/context";

const WALLPAPERS: { id: Preferences["wallpaper"]; label: string; preview: string }[] = [
  { id: "ember", label: "Kor", preview: "radial-gradient(circle at 50% 0%, #ffcf8f 0%, #b56a2c 30%, #2a1f19 65%), radial-gradient(circle at 90% 100%, #e07a2e, transparent 40%)" },
  { id: "dusk", label: "Alacakaranlık", preview: "radial-gradient(circle at 50% 0%, #f5c6c0 0%, #9a5a86 32%, #241b26 66%)" },
  { id: "noir", label: "Gece", preview: "radial-gradient(circle at 50% 0%, #c9a882 0%, #5a4232 30%, #151210 66%)" },
];

export function Settings() {
  const session = useSession();
  const prefs = session.prefs;
  const mail = useQuery<MailAccountInfo | null>("mail:account", () => mailApi.account());
  const update = useQuery<UpdateInfo | null>("system:update", async () => ({ ok: true, data: await bridge.system.checkUpdate() }));
  const server = session.auth.status === "signedIn" ? session.auth.server : session.preview ? "Önizleme" : "-";
  const expires = session.auth.status === "signedIn" ? new Date(session.auth.expiresAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "-";

  return (
    <div className="scroll-area fade-bottom -mr-3 h-full pr-3">
      <div className="mx-auto max-w-[760px] pb-10">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Ayarlar</h1>
        <p className="mb-7 mt-1 text-[14px] text-ink-2">Hesap, bildirimler ve uygulama tercihleri</p>

        <Group title="Hesap">
          <div className="flex items-center gap-4 px-5 py-4">
            <Avatar name={session.user.name} src={session.user.avatarUrl} size={56} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold text-ink">{session.user.name}</p>
              <p className="truncate text-[13px] text-ink-3">{session.user.email}</p>
            </div>
            <span className="rounded-full bg-accent/15 px-3 py-1 text-[12px] font-semibold text-accent-2">{session.user.roleLabel}</span>
          </div>
          <Row label="Sunucu" value={server} />
          <Row label="Oturum geçerlilik" value={expires} />
          <Row label="Yetkiler" value={`${session.user.permissions.length} izin`} />
          <button onClick={session.logout} className="focus-ring flex w-full items-center gap-3 px-5 py-3.5 text-left text-[14px] font-medium text-bad hover:bg-white/[0.04]">
            <LogOut className="size-4" /> {session.preview ? "Önizlemeden çık" : "Oturumu kapat"}
          </button>
        </Group>

        <Group title="Bildirimler" footer="Yeni görev, talep ve posta bildirimleri uygulama arka plandayken Windows bildirimi olarak da gelir.">
          <Toggle label="Windows bildirimleri" checked={prefs.nativeNotifications} onChange={(value) => session.setPrefs({ nativeNotifications: value })} />
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="text-[14px] text-ink">Yenileme sıklığı</span>
            <Segmented<string> size="sm" value={String(prefs.pollSeconds)} onChange={(value) => session.setPrefs({ pollSeconds: Number(value) })} options={[{ value: "30", label: "30 sn" }, { value: "45", label: "45 sn" }, { value: "90", label: "90 sn" }]} />
          </div>
        </Group>

        <Group title="Görünüm">
          <div className="grid grid-cols-3 gap-4 px-5 py-4">
            {WALLPAPERS.map((item) => (
              <button key={item.id} onClick={() => session.setPrefs({ wallpaper: item.id })} className="focus-ring group text-center outline-none">
                <span className={cn("block h-[92px] rounded-[16px] ring-2 transition-all", prefs.wallpaper === item.id ? "ring-accent" : "ring-white/10 group-hover:ring-white/25")} style={{ background: item.preview }} />
                <span className={cn("mt-2 block text-[12.5px]", prefs.wallpaper === item.id ? "font-semibold text-ink" : "text-ink-2")}>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="text-[14px] text-ink">Hareketi azalt</span>
            <Segmented<Preferences["reduceMotion"]> size="sm" value={prefs.reduceMotion} onChange={(value) => session.setPrefs({ reduceMotion: value })} options={[{ value: "system", label: "Sistem" }, { value: "on", label: "Açık" }, { value: "off", label: "Kapalı" }]} />
          </div>
        </Group>

        <Group title="Sistem">
          <Toggle label="Windows açılınca başlat" checked={prefs.launchAtLogin} onChange={(value) => session.setPrefs({ launchAtLogin: value })} icon={<Monitor className="size-4" />} />
          <Toggle label="Kapatınca sistem tepsisinde çalış" checked={prefs.closeToTray} onChange={(value) => session.setPrefs({ closeToTray: value })} />
          <div className="space-y-2.5 px-5 py-4 text-[13px] text-ink-2">
            <Shortcut keys={["Ctrl", "K"]} label="Komut paleti" />
            <Shortcut keys={["Ctrl", "Shift", "Space"]} label="Sorvia'yı her yerden aç" />
            <Shortcut keys={["Ctrl", "N"]} label="Yeni görev" />
            <Shortcut keys={["Ctrl", "1–6"]} label="Modüller arasında geç" />
            <Shortcut keys={["Alt", "←"]} label="Geri" />
          </div>
        </Group>

        <Group title="Posta">
          {mail.data ? (
            <>
              <Row label="Bağlı hesap" value={mail.data.address} icon={<Mail className="size-4" />} />
              <Row label="Sunucu" value={mail.data.imapHost} />
              <Toggle label="Dış görselleri her zaman göster" checked={prefs.showRemoteImages} onChange={(value) => session.setPrefs({ showRemoteImages: value })} />
              {!session.preview && (
                <button
                  onClick={async () => {
                    await bridge.mail.disconnect();
                    invalidate("mail:");
                    session.toast("Posta hesabının bağlantısı kaldırıldı", "ok");
                  }}
                  className="focus-ring w-full px-5 py-3.5 text-left text-[14px] font-medium text-bad hover:bg-white/[0.04]"
                >
                  Posta bağlantısını kaldır
                </button>
              )}
            </>
          ) : (
            <Row label="Bağlı hesap" value="Bağlı değil" icon={<Mail className="size-4" />} />
          )}
        </Group>

        <Group title="Hakkında">
          <Row label="Sorvia Desktop" value={`Sürüm ${bridge.version}`} icon={<Info className="size-4" />} />
          {update.data?.available && (
            <button onClick={() => void bridge.system.openExternal(update.data!.url)} className="focus-ring flex w-full items-center gap-3 bg-accent/[0.1] px-5 py-3.5 text-left text-[14px] text-ink hover:bg-accent/[0.16]">
              <span className="size-2 rounded-full bg-accent" />
              <span className="flex-1">Yeni sürüm hazır: {update.data.latest}</span>
              <span className="text-[13px] font-semibold text-accent-2">İndir</span>
            </button>
          )}
          <button onClick={() => void bridge.system.openExternal("https://sorvia.net/panel/hesap/guvenlik")} className="focus-ring flex w-full items-center justify-between px-5 py-3.5 text-left text-[14px] text-ink hover:bg-white/[0.04]">
            Oturumlarımı yönet (sorvia.net)
            <ExternalLink className="size-4 text-ink-3" />
          </button>
        </Group>
      </div>
    </div>
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

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <p className="flex items-center justify-between">
      <span>{label}</span>
      <span className="flex gap-1">{keys.map((key) => <Kbd key={key}>{key}</Kbd>)}</span>
    </p>
  );
}
