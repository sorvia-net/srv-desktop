import { CalendarDays, Crown, FileText, Pin, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import type { FounderOverview } from "@shared/contracts";
import { adminApi } from "@/data/api";
import { day } from "@/data/format";
import { useQuery } from "@/data/query";
import { cn, Empty, ErrorNote, Skeleton } from "@/design/ui";

function money(value: number, currency = "TRY") {
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function Founder() {
  const overview = useQuery<FounderOverview>("founder:overview", () => adminApi.founder(), { refreshMs: 5 * 60_000 });
  const data = overview.data;
  return (
    <div className="scroll-area fade-bottom -mr-3 h-full pr-3">
      <header className="mb-5 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-[16px] bg-gradient-to-br from-[#fde68a] via-[#f59e0b] to-[#b45309] text-white"><Crown className="size-6" /></span>
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Kurucu paneli</h1>
          <p className="text-[14px] text-ink-2">Finans, vergi, ödemeler ve evraklar · yalnız kurucular</p>
        </div>
      </header>
      {overview.error && <ErrorNote message={overview.error} onRetry={overview.refresh} />}
      {!data ? (
        overview.loading ? <Skeleton className="h-60 rounded-[24px]" /> : <Empty icon={<Crown className="size-6" />} title="Veri alınamadı" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile icon={<TrendingUp className="size-5" />} label="Bu ay gelir" value={money(data.month.income)} tone="ok" />
            <Tile icon={<TrendingDown className="size-5" />} label="Bu ay gider" value={money(data.month.expense)} tone="bad" />
            <Tile icon={<Wallet className="size-5" />} label="Bu ay net" value={money(data.month.income - data.month.expense)} />
            <Tile icon={<Receipt className="size-5" />} label="Mağaza satışı (bu ay)" value={money(data.sales.totalTry)} hint={`${data.sales.count} sipariş`} />
            <Tile icon={<TrendingUp className="size-5" />} label="Yıl gelir" value={money(data.year.income)} />
            <Tile icon={<TrendingDown className="size-5" />} label="Yıl gider" value={money(data.year.expense)} />
            <Tile icon={<Receipt className="size-5" />} label="Ödenecek KDV (bu ay)" value={money(data.taxEstimate.vatPayable)} tone="warn" />
            <Tile icon={<Receipt className="size-5" />} label={`Kurumlar vergisi tahmini (%${data.taxEstimate.rate})`} value={money(data.taxEstimate.corporate)} tone="warn" />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Section title="Yaklaşan ödemeler (14 gün)">
              {data.due.length === 0 ? <Muted>Yaklaşan ödeme yok.</Muted> : data.due.map((item) => <Line key={item.id} left={item.name} right={`${money(item.amount, item.currency)} · ${day(item.nextDueAt)}`} warn={new Date(item.nextDueAt) < new Date()} />)}
            </Section>
            <Section title="Ödenmemiş faturalar">
              {data.invoices.length === 0 ? <Muted>Açık fatura yok.</Muted> : data.invoices.map((item) => <Line key={item.id} left={item.vendor ? `${item.vendor} · ${item.title}` : item.title} right={`${item.total !== null ? money(item.total, item.currency) : "—"}${item.dueAt ? ` · ${day(item.dueAt)}` : ""}`} warn={item.paymentState === "UNPAID"} />)}
            </Section>
            <Section title="Vergi takvimi" icon={<CalendarDays className="size-4" />}>
              {data.calendar.map((item) => <Line key={`${item.title}-${item.date}`} left={item.title} right={`${day(item.date)} · ${item.detail}`} />)}
            </Section>
            <Section title="Son evraklar" icon={<FileText className="size-4" />}>
              {data.documents.length === 0 ? <Muted>Evrak yok.</Muted> : data.documents.map((item) => <Line key={item.id} left={item.title} right={item.total !== null ? money(item.total, item.currency) : day(item.createdAt)} />)}
            </Section>
            {data.notes.length > 0 && (
              <Section title="Sabitlenen notlar" icon={<Pin className="size-4" />}>
                {data.notes.map((note) => <Line key={note.id} left={note.title} right={note.category ?? ""} />)}
              </Section>
            )}
          </div>
          <p className="mb-6 mt-4 text-[12px] text-ink-4">Kayıt girme, evrak yükleme ve banka hareketleri bir sonraki sürümde buraya gelecek; dosyalar için Depolama → Kurucu deposu kullanılabilir.</p>
        </>
      )}
    </div>
  );
}

function Tile({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint?: string; tone?: "ok" | "bad" | "warn" }) {
  return (
    <div className="flex flex-col gap-2 rounded-[22px] bg-white/[0.05] p-4">
      <span className={cn("flex size-9 items-center justify-center rounded-[12px]", tone === "ok" ? "bg-ok/20 text-ok" : tone === "bad" ? "bg-bad/20 text-bad" : tone === "warn" ? "bg-warn/20 text-warn" : "bg-white/[0.08] text-ink-2")}>{icon}</span>
      <span className="text-[12px] text-ink-3">{label}</span>
      <span className="text-[21px] font-semibold leading-none tabular-nums text-ink">{value}</span>
      {hint && <span className="text-[11.5px] text-ink-4">{hint}</span>}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[22px] bg-white/[0.05] p-4">
      <p className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold text-ink">{icon}{title}</p>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Line({ left, right, warn = false }: { left: string; right: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.03] px-3 py-2 text-[12.5px]">
      <span className="min-w-0 flex-1 truncate text-ink">{left}</span>
      <span className={cn("shrink-0 tabular-nums", warn ? "text-warn" : "text-ink-3")}>{right}</span>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="px-1 text-[12.5px] text-ink-4">{children}</p>;
}
