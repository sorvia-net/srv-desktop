import { ArrowRight, ExternalLink, Eye, KeyRound, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import type { AuthState } from "@shared/contracts";
import { bridge } from "@/data/bridge";
import { LogoMark } from "@/design/logo";
import { Button } from "@/design/ui";
import { WindowControls } from "@/os/StatusBar";

type Props = { auth: Extract<AuthState, { status: "signedOut" | "linking" }>; onChange: (state: AuthState) => void };

export function Connect({ auth, onChange }: Props) {
  const [busy, setBusy] = useState<"start" | "preview" | null>(null);

  const start = async () => {
    setBusy("start");
    onChange(await bridge.auth.start());
    setBusy(null);
  };

  const preview = async () => {
    setBusy("preview");
    onChange(await bridge.auth.preview());
    setBusy(null);
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="drag relative z-40 flex h-[58px] items-center justify-center px-6 pt-3">
        <div className="glass-float flex h-[44px] items-center gap-4 rounded-full pl-5 pr-6">
          <WindowControls />
          <span className="text-[13px] font-medium text-ink-2">Sorvia Desktop</span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="glass-panel no-drag relative w-[470px] overflow-hidden rounded-[36px] px-10 pb-9 pt-11 text-center"
        >
          <div className="pointer-events-none absolute -top-24 left-1/2 size-[260px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,150,64,0.35),transparent_65%)] blur-2xl" />
          <div className="relative mx-auto flex size-[84px] items-center justify-center rounded-[26px] bg-black/30 shadow-[0_20px_50px_-14px_rgba(255,110,20,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10">
            <LogoMark size={58} />
          </div>
          <h1 className="relative mt-6 text-[30px] font-bold tracking-[-0.03em] text-ink">Sorvia Desktop</h1>
          <p className="relative mt-1.5 text-[14.5px] text-ink-2">Ekibin günlük çalışma alanı</p>
          <AnimatePresence mode="wait" initial={false}>
            {auth.status === "linking" ? (
              <Linking key="linking" auth={auth} onChange={onChange} />
            ) : (
              <motion.div key="signed-out" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} className="relative">
                <div className="mt-8 space-y-3 text-left">
                  <Feature icon={<ShieldCheck className="size-[18px]" />} title="Parolan bu uygulamaya girilmez" body="Girişi tarayıcında sorvia.net üzerinde yapar, bu cihazı onaylarsın." />
                  <Feature icon={<KeyRound className="size-[18px]" />} title="Oturum Windows hesabına kilitli" body="Erişim anahtarı bu bilgisayarda şifreli saklanır, istediğin an kapatılır." />
                </div>
                {auth.error && <p className="mt-5 rounded-[16px] bg-bad/10 px-4 py-3 text-left text-[13px] leading-relaxed text-[#ffc2cc] ring-1 ring-bad/25">{auth.error}</p>}
                <Button variant="accent" size="lg" className="mt-7 w-full" loading={busy === "start"} onClick={() => void start()}>
                  Sorvia hesabınla bağlan {busy !== "start" && <ArrowRight />}
                </Button>
                <Button variant="ghost" size="md" className="mt-2.5 w-full" loading={busy === "preview"} onClick={() => void preview()}>
                  {busy !== "preview" && <Eye />} Önizlemeyi aç
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <p className="pb-6 text-center text-[12px] text-ink-4">Yalnızca Sorvia ekip hesapları bağlanabilir · Sürüm {bridge.version}</p>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass-soft flex items-start gap-3.5 rounded-[20px] px-4 py-3.5">
      <span className="icon-ring mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-accent-2">{icon}</span>
      <span>
        <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-3">{body}</span>
      </span>
    </div>
  );
}

function Linking({ auth, onChange }: { auth: Extract<AuthState, { status: "linking" }>; onChange: (state: AuthState) => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const left = Math.max(0, Math.floor((new Date(auth.expiresAt).getTime() - now) / 1000));
  const characters = auth.userCode.split("");

  return (
    <motion.div key="linking" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} className="relative">
      <div className="mt-8 flex items-center justify-center gap-2.5 text-[13px] text-ink-2">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
        </span>
        Tarayıcında onay bekleniyor
      </div>
      <div className="mt-5 flex items-center justify-center gap-1.5" aria-label={`Doğrulama kodu ${auth.userCode}`}>
        {characters.map((character, index) =>
          character === "-" ? (
            <span key={index} className="mx-1 h-[3px] w-3 rounded-full bg-white/25" />
          ) : (
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="selectable flex h-[54px] w-[42px] items-center justify-center rounded-[14px] bg-black/30 font-mono text-[25px] font-semibold text-ink ring-1 ring-white/12"
            >
              {character}
            </motion.span>
          ),
        )}
      </div>
      <p className="mx-auto mt-5 max-w-[340px] text-[13px] leading-relaxed text-ink-3">
        sorvia.net'te açılan sayfadaki kod bununla aynıysa <span className="text-ink-2">Onayla</span>'ya bas. Kodlar uyuşmuyorsa onaylama.
      </p>
      <p className="tabular mt-3 text-[12px] text-ink-4">
        {left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} içinde geçerli` : "Kodun süresi doldu"}
      </p>
      <div className="mt-6 flex gap-2.5">
        <Button variant="glass" size="md" className="flex-1" onClick={() => void bridge.system.openBrowser(auth.verificationUrl)}>
          <ExternalLink /> Sayfayı aç
        </Button>
        <Button variant="ghost" size="md" className="flex-1" onClick={async () => onChange(await bridge.auth.cancel())}>
          Vazgeç
        </Button>
      </div>
    </motion.div>
  );
}
