import { CheckCircle2, Receipt, RotateCcw, Search, X, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import type { AdminOrderDetail, AdminOrderPage } from "@shared/contracts";
import { adminApi } from "@/data/api";
import { relative } from "@/data/format";
import { invalidate, useQuery } from "@/data/query";
import { Button, cn, Empty, ErrorNote, IconButton, Pill, Segmented, Skeleton } from "@/design/ui";
import { useSession } from "@/shell/context";

export const ORDER_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "soft" | "info" }> = {
  PENDING: { label: "Bekliyor", tone: "warn" },
  AWAITING_PAYMENT: { label: "Ödeme bekliyor", tone: "warn" },
  PAID: { label: "Ödendi", tone: "info" },
  FULFILLED: { label: "Tamamlandı", tone: "ok" },
  REFUNDED: { label: "İade", tone: "soft" },
  CANCELLED: { label: "İptal", tone: "soft" },
  FAILED: { label: "Başarısız", tone: "bad" },
};

const FILTERS = [
  { value: "", label: "Tümü" },
  { value: "open", label: "Bekleyen" },
  { value: "FULFILLED", label: "Tamamlanan" },
  { value: "REFUNDED", label: "İade" },
];

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function Orders() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  const page = useQuery<AdminOrderPage>(`orders:list:${status}:${search}`, () => adminApi.orders({ q: search || undefined, status: status || undefined }), { refreshMs: 60_000 });

  return (
    <div className="flex h-full min-h-0 gap-6">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Siparişler</h1>
            <p className="mt-1 text-[14px] text-ink-2">{page.data ? `${page.data.total} sipariş · ${page.data.summary.awaiting} ödeme bekliyor` : "Yükleniyor…"}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Segmented value={status} onChange={setStatus} options={FILTERS} />
            <label className="flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4">
              <Search className="size-4 text-ink-3" />
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Sipariş no, e-posta" className="w-52 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4" />
            </label>
          </div>
        </header>
        {page.data && (
          <div className="mb-4 flex flex-wrap gap-3">
            {page.data.summary.revenue.map((row) => (
              <div key={row.currency} className="rounded-[18px] bg-white/[0.06] px-4 py-3">
                <p className="text-[11.5px] text-ink-4">Son 30 gün · {row.count} ödeme</p>
                <p className="mt-0.5 text-[20px] font-semibold text-ink">{money(row.total, row.currency)}</p>
              </div>
            ))}
          </div>
        )}
        {page.error && <ErrorNote message={page.error} onRetry={page.refresh} />}
        <div className="scroll-area fade-bottom -mr-3 min-h-0 flex-1 pr-3">
          {page.loading && !page.data ? (
            <div className="space-y-2">{Array.from({ length: 10 }, (_, index) => <Skeleton key={index} className="h-14 rounded-[16px]" />)}</div>
          ) : !page.data?.items.length ? (
            <Empty icon={<Receipt className="size-6" />} title="Sipariş yok" />
          ) : (
            <ul className="space-y-1 pb-6">
              {page.data.items.map((order) => (
                <li key={order.id}>
                  <button onClick={() => setSelected(order.id)} className={cn("focus-ring flex w-full items-center gap-3.5 rounded-[16px] px-4 py-3 text-left transition", selected === order.id ? "bg-white/[0.12]" : "hover:bg-white/[0.06]")}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13.5px] text-ink">{order.number}</span>
                      <span className="block truncate text-[12.5px] text-ink-3">{order.customer ?? order.email} · {order.items} ürün · {order.provider ?? "—"}</span>
                    </span>
                    <Pill tone={ORDER_STATUS[order.status]?.tone ?? "soft"}>{ORDER_STATUS[order.status]?.label ?? order.status}</Pill>
                    <span className="w-28 text-right text-[14px] font-semibold tabular-nums text-ink">{money(order.total, order.currency)}</span>
                    <span className="w-20 text-right text-[12px] text-ink-4">{relative(order.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <AnimatePresence>{selected && <OrderPanel key={selected} id={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
    </div>
  );
}

function OrderPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const session = useSession();
  const order = useQuery<AdminOrderDetail>(`orders:detail:${id}`, () => adminApi.order(id));
  const [busy, setBusy] = useState(false);
  const data = order.data;

  const act = async (action: "mark-paid" | "cancel" | "refund", question: string) => {
    if (!window.confirm(question)) return;
    setBusy(true);
    const result = await adminApi.orderAction(id, action);
    setBusy(false);
    if (!result.ok) return session.toast(result.message, "bad");
    session.toast("Sipariş güncellendi", "ok");
    invalidate("orders:");
  };

  return (
    <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} className="scroll-area flex w-[400px] shrink-0 flex-col rounded-[26px] bg-white/[0.06] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[16px] font-semibold text-ink">{data?.number ?? "…"}</p>
          {data && <p className="text-[12.5px] text-ink-3">{new Date(data.createdAt).toLocaleString("tr-TR")}</p>}
        </div>
        <IconButton label="Kapat" size={32} onClick={onClose}><X className="size-4" /></IconButton>
      </div>
      {!data ? (
        order.error ? <ErrorNote message={order.error} onRetry={order.refresh} /> : <Skeleton className="mt-4 h-60 rounded-[20px]" />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill tone={ORDER_STATUS[data.status]?.tone ?? "soft"}>{ORDER_STATUS[data.status]?.label ?? data.status}</Pill>
            {data.provider && <Pill tone="outline">{data.provider}</Pill>}
            {data.coupon && <Pill tone="outline">Kupon {data.coupon}</Pill>}
          </div>
          <div className="mt-4 rounded-[16px] bg-white/[0.04] p-3.5">
            <p className="text-[13.5px] font-medium text-ink">{data.user?.name ?? data.email}</p>
            <p className="text-[12.5px] text-ink-3">{data.email}{data.country ? ` · ${data.country}` : ""}</p>
          </div>
          <ul className="mt-4 space-y-1.5">
            {data.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-ink">{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}</span>
                <span className="tabular-nums text-ink-2">{money(item.total, data.currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-white/[0.08] pt-3 text-[12.5px]">
            <Line label="Ara toplam" value={money(data.subtotal, data.currency)} />
            {data.discount > 0 && <Line label="İndirim" value={`−${money(data.discount, data.currency)}`} />}
            {data.tax > 0 && <Line label="Vergi" value={money(data.tax, data.currency)} />}
            <Line label="Toplam" value={money(data.total, data.currency)} strong />
          </dl>
          {data.paidAt && <p className="mt-2 text-[12px] text-ink-3">Ödeme: {new Date(data.paidAt).toLocaleString("tr-TR")}</p>}
          {data.invoice && <p className="text-[12px] text-ink-3">Fatura {data.invoice.number}</p>}
          {data.licenses.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">Lisanslar</p>
              {data.licenses.map((license) => (
                <p key={license.id} className="flex justify-between text-[12.5px] text-ink-2"><span>{license.product}</span><span className="font-mono">{license.key}</span></p>
              ))}
            </div>
          )}
          {data.notes && <p className="mt-4 whitespace-pre-wrap rounded-[12px] bg-white/[0.04] p-3 text-[12.5px] text-ink-2">{data.notes}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {data.actions.markPaid && <Button size="sm" variant="accent" disabled={busy} onClick={() => void act("mark-paid", "Sipariş ödendi olarak işaretlensin ve ürünler müşteriye açılsın mı?")}><CheckCircle2 className="size-4" /> Ödendi işaretle</Button>}
            {data.actions.cancel && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act("cancel", "Sipariş iptal edilsin mi?")}><XCircle className="size-4" /> İptal et</Button>}
            {data.actions.refund && <Button size="sm" variant="ghost" className="text-bad" disabled={busy} onClick={() => void act("refund", "Sipariş iade edilsin mi? Lisanslar iptal edilir.")}><RotateCcw className="size-4" /> İade et</Button>}
          </div>
        </>
      )}
    </motion.aside>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-[14px] font-semibold text-ink" : "text-ink-2")}>{value}</dd>
    </div>
  );
}
