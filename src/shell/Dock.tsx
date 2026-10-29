import { Power } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import type { ModuleId } from "@shared/contracts";
import { cn } from "@/design/ui";

import { useNav, useSession } from "./context";
import { MODULES } from "./modules";

export function Dock({ badges }: { badges: Partial<Record<ModuleId, number>> }) {
  const nav = useNav();
  const session = useSession();
  const items = MODULES.filter((item) => session.user.modules.includes(item.id));
  const [hover, setHover] = useState<ModuleId | "logout" | null>(null);

  return (
    <nav className="glass-float no-drag relative z-30 flex w-[68px] flex-col items-center gap-2 rounded-full px-2.5 py-3" aria-label="Modüller">
      {items.map((item) => {
        const active = nav.route.screen === item.id;
        const Icon = item.icon;
        const badge = badges[item.id] ?? 0;
        return (
          <button
            key={item.id}
            onClick={() => nav.go(item.id)}
            onMouseEnter={() => setHover(item.id)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(item.id)}
            onBlur={() => setHover(null)}
            aria-label={item.title}
            aria-current={active ? "page" : undefined}
            className="focus-ring group relative flex size-[46px] items-center justify-center rounded-full text-ink-2 outline-none transition-colors hover:text-ink"
          >
            {active && <motion.span layoutId="dock-active" className="accent-fill absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 460, damping: 34 }} />}
            <Icon className={cn("relative size-[20px] transition-transform duration-300", active ? "text-white" : "group-hover:scale-110")} strokeWidth={active ? 2.1 : 1.8} />
            {badge > 0 && !active && <span className="absolute right-[5px] top-[5px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-accent px-1 text-[9.5px] font-bold text-white ring-2 ring-[#3b3430]">{badge > 9 ? "9+" : badge}</span>}
            {hover === item.id && <Tip label={item.title} hint={item.shortcut} />}
          </button>
        );
      })}
      <span className="my-1 h-px w-7 bg-white/10" />
      <button
        onClick={session.logout}
        onMouseEnter={() => setHover("logout")}
        onMouseLeave={() => setHover(null)}
        aria-label={session.preview ? "Önizlemeden çık" : "Oturumu kapat"}
        className="focus-ring relative flex size-[46px] items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-white/8 hover:text-bad"
      >
        <Power className="size-[19px]" />
        {hover === "logout" && <Tip label={session.preview ? "Önizlemeden çık" : "Oturumu kapat"} />}
      </button>
    </nav>
  );
}

function Tip({ label, hint }: { label: string; hint?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16 }}
      className="glass-float pointer-events-none absolute left-[58px] top-1/2 z-50 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink"
    >
      {label}
      {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
    </motion.span>
  );
}
