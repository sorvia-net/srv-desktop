import { ArrowLeft, Check, Lock, Search, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import { Button, cn, Pill, Spinner } from "@/design/ui";
import { useModules, useCatalog } from "@/os/modules";
import { Tile } from "@/os/icons";
import { available, lockReason, type AppDef, type LinkDef } from "@/os/registry";
import { useOs } from "@/os/state";
import { bridge } from "@/data/bridge";
import { useSession } from "@/shell/context";

type Item = AppDef | LinkDef;

export function Store() {
  const session = useSession();
  const modules = useModules();
  const items = useCatalog();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(items.map((item) => item.category))], [items]);
  const list = items.filter((item) => (!category || item.category === category) && (!q || `${item.title} ${item.subtitle} ${item.description}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))));
  const featured = items.find((item) => item.id === modules.featured) ?? null;
  const current = items.find((item) => item.id === selected) ?? null;
  const updates = items.filter((item) => modules.installed.has(item.id)).length;

  return (
    <div className="relative h-full min-h-0">
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div key="detail" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="h-full">
            <Detail item={current} onBack={() => setSelected(null)} />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="scroll-area fade-bottom -mr-3 h-full pr-3">
            <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Mağaza</h1>
                <p className="mt-1 text-[14px] text-ink-2">{items.length} Sorvia modülü · {updates} yüklü</p>
              </div>
              <label className="flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4">
                <Search className="size-4 text-ink-3" />
                <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Modül ara" className="w-56 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4" />
              </label>
            </header>

            {modules.notice && <p className="mb-4 rounded-[16px] bg-info/15 px-4 py-3 text-[13px] text-ink">{modules.notice}</p>}

            {featured && !q && !category && (
              <button onClick={() => setSelected(featured.id)} className="focus-ring relative mb-6 flex w-full items-center gap-6 overflow-hidden rounded-[28px] p-7 text-left" style={{ background: featured.tile }}>
                <span className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
                <Tile item={featured} size={96} className="relative" />
                <span className="relative">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/75">Öne çıkan</span>
                  <span className="mt-1 block text-[28px] font-bold leading-tight text-white">{featured.title}</span>
                  <span className="mt-1 block max-w-lg text-[14px] text-white/85">{featured.description}</span>
                </span>
              </button>
            )}

            <div className="mb-4 flex flex-wrap gap-2">
              <Chip label="Tümü" active={!category} onClick={() => setCategory(null)} />
              {categories.map((entry) => <Chip key={entry} label={entry} active={category === entry} onClick={() => setCategory(entry)} />)}
            </div>

            <div className="grid gap-3 pb-8 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((item) => (
                <div key={item.id} className="flex items-center gap-4 rounded-[22px] bg-white/[0.05] p-4 transition hover:bg-white/[0.08]">
                  <button onClick={() => setSelected(item.id)} className="focus-ring flex min-w-0 flex-1 items-center gap-4 text-left">
                    <Tile item={item} size={58} />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-ink">{item.title}</span>
                      <span className="block truncate text-[12.5px] text-ink-3">{item.subtitle}</span>
                    </span>
                  </button>
                  <Action item={item} compact />
                </div>
              ))}
            </div>
            {session.preview && <p className="pb-6 text-center text-[12px] text-ink-4">Önizlemede yüklemeler yalnızca bu cihazda tutulur.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("focus-ring rounded-full px-3.5 py-1.5 text-[13px] transition", active ? "accent-fill font-semibold" : "bg-white/[0.07] text-ink-2 hover:bg-white/[0.12]")}>
      {label}
    </button>
  );
}

function Action({ item, compact = false }: { item: Item; compact?: boolean }) {
  const session = useSession();
  const modules = useModules();
  const os = useOs();
  const lock = lockReason(item, session.user);
  const installed = modules.installed.has(item.id);
  if (lock) {
    return (
      <span title={lock} className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] text-ink-4">
        <Lock className="size-3.5" /> {compact ? "Kilitli" : lock}
      </span>
    );
  }
  if (modules.installing.has(item.id)) {
    return (
      <span className="flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-1.5 text-[12.5px] text-ink-2">
        <Spinner className="size-3.5" /> Yükleniyor
      </span>
    );
  }
  if (!installed) {
    return (
      <Button size="sm" variant="accent" onClick={() => void modules.install(item.id)}>
        Yükle
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={() => {
          if (item.kind === "app") os.openApp(item.id);
          else void bridge.system.openExternal(item.url);
        }}
      >
        Aç
      </Button>
      {!compact && !item.system && (
        <Button size="sm" variant="ghost" className="text-bad" onClick={() => window.confirm(`${item.title} kaldırılsın mı?`) && void modules.uninstall(item.id)}>
          Kaldır
        </Button>
      )}
    </div>
  );
}

function Detail({ item, onBack }: { item: Item; onBack: () => void }) {
  const session = useSession();
  const modules = useModules();
  const ok = available(item, session.user);
  return (
    <div className="scroll-area fade-bottom -mr-3 h-full pr-3">
      <button onClick={onBack} className="mb-5 flex items-center gap-1.5 text-[14px] text-accent-2 hover:underline">
        <ArrowLeft className="size-4" /> Mağaza
      </button>
      <div className="flex flex-wrap items-center gap-6">
        <Tile item={item} size={120} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em] text-ink">{item.title}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{item.subtitle}</p>
          <div className="mt-4">
            <Action item={item} />
          </div>
        </div>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Kategori" value={item.category} />
        <Fact label="Sürüm" value={item.version} />
        <Fact label="Boyut" value={item.size} />
        <Fact label="Tür" value={item.kind === "app" ? (item.system ? "Sistem" : "Uygulama") : "Web"} />
      </div>
      {item.screenshots && item.screenshots.length > 0 && (
        <div className="scroll-area mt-7 flex gap-4 overflow-x-auto pb-2">
          {item.screenshots.map((shot) => (
            <img key={shot} src={shot} alt="" onError={(event) => (event.currentTarget.style.display = "none")} className="h-[240px] shrink-0 rounded-[20px] border border-white/10 object-cover" />
          ))}
        </div>
      )}
      <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-ink">{item.description}</p>
      {item.features.length > 0 && (
        <ul className="mt-5 space-y-2">
          {item.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5 text-[14px] text-ink-2">
              <Check className="size-4 text-ok" /> {feature}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-7 flex flex-wrap gap-2">
        {item.permission && <Pill tone="outline"><ShieldCheck className="size-3.5" /> {item.permission}</Pill>}
        {item.role && <Pill tone="outline">{item.role === "OWNER" ? "Kurucular" : "Yöneticiler"}</Pill>}
        {ok && modules.installed.has(item.id) && <Pill tone="ok">Yüklü</Pill>}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-white/[0.05] px-4 py-3">
      <p className="text-[11.5px] uppercase tracking-[0.12em] text-ink-4">{label}</p>
      <p className="mt-1 truncate text-[15px] font-semibold text-ink">{value}</p>
    </div>
  );
}
