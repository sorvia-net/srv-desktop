import { AlertTriangle, Briefcase, CalendarClock, CreditCard, Inbox, KeyRound, LifeBuoy, ShoppingCart, UserPlus, Users } from "lucide-react";
import type { ReactNode } from "react";

import type { AdminOverview, ModuleId } from "@shared/contracts";
import { adminApi } from "@/data/api";
import { useQuery } from "@/data/query";
import { cn, ErrorNote, Skeleton } from "@/design/ui";
import { useOs } from "@/os/state";

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function Admin() {
  const os = useOs();
  const overview = useQuery<AdminOverview>("admin:overview", () => adminApi.overview(), { refreshMs: 60_000 });
  const data = overview.data;
  const max = Math.max(1, ...(data?.salesChart.map((item) => item.count) ?? [1]));

  return (
    <div className="scroll-area fade-bottom -mr-3 h-full pr-3">
      <header className="mb-5">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Yönetim</h1>
        <p className="mt-1 text-[14px] text-ink-2">Sorvia'nın anlık özeti</p>
      </header>
      {overview.error && <ErrorNote message={overview.error} onRetry={overview.refresh} />}
      {!data ? (
        <div className="grid grid-cols-4 gap-3">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-28 rounded-[22px]" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.revenue.map((row) => (
              <Card key={row.currency} icon={<CreditCard className="size-5" />} label={`Son 30 gün (${row.currency})`} value={money(row.total, row.currency)} hint={`${row.count} ödeme`} accent />
            ))}
            <Card icon={<ShoppingCart className="size-5" />} label="Bugünkü sipariş" value={String(data.ordersToday)} hint={`${data.awaiting} ödeme bekliyor`} onClick={() => os.openApp("orders")} />
            <Card icon={<LifeBuoy className="size-5" />} label="Açık talep" value={String(data.openTickets)} hint={`${data.waitingTickets} yanıt bekliyor`} tone={data.waitingTickets ? "warn" : undefined} onClick={() => os.openApp("tickets")} />
            <Card icon={<Users className="size-5" />} label="Kullanıcı" value={data.users.toLocaleString("tr-TR")} hint={`bu hafta +${data.newUsersWeek}`} onClick={() => os.openApp("users")} />
            <Card icon={<KeyRound className="size-5" />} label="Aktif lisans" value={data.licenses.toLocaleString("tr-TR")} onClick={() => os.openApp("products" as ModuleId)} />
            <Card icon={<CreditCard className="size-5" />} label="Ödeme bildirimi" value={String(data.claims)} tone={data.claims ? "warn" : undefined} onClick={() => os.openApp("orders")} />
            <Card icon={<Inbox className="size-5" />} label="Yeni iletişim mesajı" value={String(data.contacts)} />
            <Card icon={<CalendarClock className="size-5" />} label="Onay bekleyen görüşme" value={String(data.meetings)} onClick={() => os.openApp("calendar")} />
            <Card icon={<Briefcase className="size-5" />} label="Yeni iş başvurusu" value={String(data.applications)} />
            <Card icon={<AlertTriangle className="size-5" />} label="Son 24 saatte hata" value={String(data.errors24)} tone={data.errors24 ? "bad" : undefined} />
            <Card icon={<UserPlus className="size-5" />} label="Yeni üye (7 gün)" value={String(data.newUsersWeek)} />
          </div>
          <section className="mt-5 rounded-[24px] bg-white/[0.05] p-5">
            <p className="text-[14px] font-semibold text-ink">Son 14 günde ödenen siparişler</p>
            <div className="mt-4 flex h-40 items-end gap-2">
              {data.salesChart.map((day) => (
                <div key={day.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10.5px] tabular-nums text-ink-3">{day.count || ""}</span>
                  <div className="w-full rounded-t-[8px] bg-accent/80" style={{ height: `${Math.max(3, (day.count / max) * 120)}px` }} />
                  <span className="text-[10px] text-ink-4">{day.day.slice(8, 10)}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Card({ icon, label, value, hint, tone, accent = false, onClick }: { icon: ReactNode; label: string; value: string; hint?: string; tone?: "warn" | "bad"; accent?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn(!onClick && "cursor-default", "flex flex-col gap-2 rounded-[22px] p-4 text-left transition", accent ? "bg-accent/15" : "bg-white/[0.05]", onClick && "hover:bg-white/[0.09]")}>
      <span className={cn("flex size-9 items-center justify-center rounded-[12px]", tone === "bad" ? "bg-bad/20 text-bad" : tone === "warn" ? "bg-warn/20 text-warn" : "bg-white/[0.08] text-ink-2")}>{icon}</span>
      <span className="text-[12px] text-ink-3">{label}</span>
      <span className="text-[22px] font-semibold leading-none tabular-nums text-ink">{value}</span>
      {hint && <span className="text-[11.5px] text-ink-4">{hint}</span>}
    </button>
  );
}
