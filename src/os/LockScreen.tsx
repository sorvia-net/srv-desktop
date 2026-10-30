import { ArrowRight, Fingerprint, KeyRound, Lock } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/data/api";
import { bridge } from "@/data/bridge";
import { Avatar, Spinner } from "@/design/ui";
import { Background } from "@/shell/Background";
import { useSession } from "@/shell/context";

import { useOs } from "./state";
import { useNow } from "./StatusBar";

const TIME = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const DATE = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Istanbul" });

export function LockScreen() {
  const os = useOs();
  const session = useSession();
  const now = useNow(1000);
  const input = useRef<HTMLInputElement>(null);
  const shake = useAnimationControls();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "passkey" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const methods = session.user.unlock ?? { password: true, passkey: false };
  const free = session.preview || (!methods.password && !methods.passkey);

  useEffect(() => {
    if (!os.locked) {
      setPassword("");
      setError(null);
      return;
    }
    const timer = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [os.locked]);

  const unlocked = () => {
    void bridge.system.markUnlocked();
    os.unlock();
  };

  const fail = (message: string) => {
    setError(message);
    setPassword("");
    void shake.start({ x: [0, -14, 12, -8, 6, 0], transition: { duration: 0.42 } });
    input.current?.focus();
  };

  const submit = async () => {
    if (free) return unlocked();
    if (!password || busy) return;
    setBusy("password");
    setError(null);
    const result = await api.unlockPassword(password);
    setBusy(null);
    if (result.ok) unlocked();
    else fail(result.message);
  };

  const passkey = async () => {
    if (busy) return;
    setBusy("passkey");
    setError(null);
    const result = await bridge.system.passkeyUnlock();
    setBusy(null);
    if (result.ok) unlocked();
    else if (result.error !== "cancelled") fail(result.message);
  };

  return (
    <AnimatePresence>
      {os.locked && (
        <motion.div
          className="fixed inset-0 z-[95] flex flex-col items-center overflow-hidden text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.35 }}
          onClick={() => input.current?.focus()}
        >
          <Background wallpaper={session.prefs.wallpaper} />
          <div className="pointer-events-none fixed inset-0 bg-black/10" />
          <div className="drag absolute inset-x-0 top-0 h-10" />
          <div className="relative mt-[9vh] flex flex-col items-center">
            <p className="text-[22px] font-medium capitalize text-white/90 [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">{DATE.format(now)}</p>
            <p className="tabular -mt-1 text-[min(14vw,150px)] font-semibold leading-none tracking-[-0.04em] text-white/95 [text-shadow:0_10px_40px_rgba(0,0,0,0.3)]">{TIME.format(now)}</p>
          </div>

          <div className="absolute bottom-[10vh] z-10 flex flex-col items-center">
            <Avatar name={session.user.name} src={session.user.avatarUrl} size={72} ring />
            <p className="mt-3 text-[16px] font-semibold [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">{session.user.name}</p>
            <motion.form
              animate={shake}
              className="mt-4 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              {free ? (
                <button type="submit" className="flex h-9 items-center gap-2 rounded-full bg-white/25 px-5 text-[13px] font-medium backdrop-blur-xl hover:bg-white/35">
                  <Lock className="size-3.5" /> Kilidi aç
                </button>
              ) : methods.password ? (
                <div className="flex h-9 w-[240px] items-center rounded-full bg-white/25 pl-4 pr-1 ring-1 ring-white/20 backdrop-blur-xl focus-within:ring-white/50">
                  <input
                    ref={input}
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                    }}
                    placeholder="Parolayı girin"
                    autoComplete="current-password"
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/70"
                  />
                  <button type="submit" disabled={!password || busy !== null} aria-label="Kilidi aç" className="flex size-7 items-center justify-center rounded-full bg-white/30 transition hover:bg-white/45 disabled:opacity-40">
                    {busy === "password" ? <Spinner className="size-3.5" /> : <ArrowRight className="size-4" />}
                  </button>
                </div>
              ) : null}
            </motion.form>
            {!free && methods.passkey && (
              <button onClick={() => void passkey()} disabled={busy !== null} className="mt-3 flex items-center gap-1.5 text-[12.5px] text-white/85 hover:text-white">
                {busy === "passkey" ? <Spinner className="size-3.5" /> : methods.password ? <KeyRound className="size-3.5" /> : <Fingerprint className="size-4" />}
                {methods.password ? "Geçiş anahtarı kullan" : "Geçiş anahtarıyla aç"}
              </button>
            )}
            <p className="mt-3 h-4 text-[12px] text-[#ffd1d1] [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">{error}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
