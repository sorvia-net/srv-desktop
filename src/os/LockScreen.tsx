import { ChevronUp, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

import type { AppNotification } from "@shared/contracts";
import { api } from "@/data/api";
import { relative } from "@/data/format";
import { useQuery } from "@/data/query";

import { useOs } from "./state";
import { useNow } from "./StatusBar";

const TIME = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const DATE = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Istanbul" });

export function LockScreen() {
  const os = useOs();
  const now = useNow(1000);
  const notes = useQuery<AppNotification[]>("notifications", () => api.notifications(), { enabled: os.locked });
  const unread = (notes.data ?? []).filter((item) => !item.readAt).slice(0, 3);

  useEffect(() => {
    if (!os.locked) return;
    const unlock = (event: KeyboardEvent) => {
      if (event.key === "Shift" || event.key === "Control" || event.key === "Alt") return;
      os.unlock();
    };
    window.addEventListener("keydown", unlock);
    return () => window.removeEventListener("keydown", unlock);
  }, [os]);

  return (
    <AnimatePresence>
      {os.locked && (
        <motion.div
          className="fixed inset-0 z-[95] flex flex-col items-center bg-black/30 text-white backdrop-blur-[38px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ y: "-100%", opacity: 0.6 }}
          transition={{ type: "spring", stiffness: 260, damping: 34 }}
          onClick={os.unlock}
        >
          <div className="drag absolute inset-x-0 top-0 h-10" />
          <Lock className="mt-16 size-5 text-white/80" />
          <p className="mt-3 text-[20px] font-medium capitalize text-white/90">{DATE.format(now)}</p>
          <p className="tabular text-[112px] font-semibold leading-none tracking-[-0.04em] [text-shadow:0_8px_30px_rgba(0,0,0,0.35)]">{TIME.format(now)}</p>
          <div className="mt-10 w-[min(420px,86vw)] space-y-2.5">
            {unread.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-white/15 bg-white/[0.14] px-4 py-3 backdrop-blur-2xl">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[13.5px] font-semibold">{item.title}</p>
                  <p className="shrink-0 text-[11.5px] text-white/60">{relative(item.createdAt)}</p>
                </div>
                {item.body && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-white/80">{item.body}</p>}
              </div>
            ))}
          </div>
          <motion.div className="absolute bottom-10 flex flex-col items-center gap-1 text-[13px] text-white/75" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.2 }}>
            <ChevronUp className="size-5" />
            Açmak için tıkla ya da bir tuşa bas
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
