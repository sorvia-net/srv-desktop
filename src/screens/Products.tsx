import { Download, Eye, EyeOff, Package, Search, Star, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import type { ProductDetail, ProductPage } from "@shared/contracts";
import { adminApi } from "@/data/api";
import { relative } from "@/data/format";
import { invalidate, useQuery } from "@/data/query";
import { Button, cn, Empty, ErrorNote, IconButton, Pill, Segmented, Skeleton } from "@/design/ui";
import { useSession } from "@/shell/context";

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "soft" | "info" }> = {
  PUBLISHED: { label: "Yayında", tone: "ok" },
  DRAFT: { label: "Taslak", tone: "soft" },
  HIDDEN: { label: "Gizli", tone: "warn" },
  ARCHIVED: { label: "Arşiv", tone: "soft" },
  SCHEDULED: { label: "Zamanlı", tone: "info" },
};
const TYPE: Record<string, string> = { MINECRAFT_PLUGIN: "Minecraft", FIVEM_SCRIPT: "FiveM", DISCORD_BOT: "Discord", WEB_TEMPLATE: "Web", OTHER: "Diğer" };

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function Products() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  const page = useQuery<ProductPage>(`products:list:${status}:${search}`, () => adminApi.products({ q: search || undefined, status: status || undefined }));
  const items = page.data?.items ?? [];

  return (
    <div className="flex h-full min-h-0 gap-6">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Ürünler</h1>
            <p className="mt-1 text-[14px] text-ink-2">{page.data ? `${items.length} ürün · son 30 günde ${items.reduce((sum, item) => sum + item.sold30, 0)} satış` : "Yükleniyor…"}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Segmented value={status} onChange={setStatus} options={[{ value: "", label: "Tümü" }, { value: "PUBLISHED", label: "Yayında" }, { value: "DRAFT", label: "Taslak" }, { value: "HIDDEN", label: "Gizli" }]} />
            <label className="flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4">
              <Search className="size-4 text-ink-3" />
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Ürün ara" className="w-48 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4" />
            </label>
          </div>
        </header>
        {page.error && <ErrorNote message={page.error} onRetry={page.refresh} />}
        <div className="scroll-area fade-bottom -mr-3 min-h-0 flex-1 pr-3">
          {page.loading && !page.data ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-40 rounded-[22px]" />)}</div>
          ) : !items.length ? (
            <Empty icon={<Package className="size-6" />} title="Ürün yok" />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 pb-6">
              {items.map((item) => (
                <button key={item.id} onClick={() => setSelected(item.id)} className={cn("focus-ring flex flex-col gap-3 rounded-[22px] bg-white/[0.05] p-4 text-left ring-2 transition hover:bg-white/[0.08]", selected === item.id ? "ring-accent" : "ring-transparent")}>
                  <div className="flex items-start gap-3">
                    {item.image ? <img src={item.image} alt="" className="size-12 rounded-[14px] object-cover" /> : <span className="flex size-12 items-center justify-center rounded-[14px] bg-accent/20 text-accent-2"><Package className="size-6" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-ink">{item.name}</span>
                      <span className="block truncate text-[12px] text-ink-3">{item.tagline ?? TYPE[item.type] ?? item.type}</span>
                    </span>
                    {item.featured && <Star className="size-4 shrink-0 fill-warn text-warn" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={STATUS[item.status]?.tone ?? "soft"}>{STATUS[item.status]?.label ?? item.status}</Pill>
                    <Pill tone="outline">{TYPE[item.type] ?? item.type}</Pill>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[12px]">
                    <Stat label="Fiyat" value={item.isFree ? "Ücretsiz" : money(item.salePrice ?? item.price, item.currency)} />
                    <Stat label="30 gün" value={`${item.sold30} satış`} />
                    <Stat label="Lisans" value={String(item.licenses)} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>{selected && <ProductPanel key={selected} id={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-white/[0.04] px-2.5 py-1.5">
      <p className="text-[10.5px] text-ink-4">{label}</p>
      <p className="truncate font-medium text-ink">{value}</p>
    </div>
  );
}

function ProductPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const session = useSession();
  const product = useQuery<ProductDetail>(`products:detail:${id}`, () => adminApi.product(id));
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const data = product.data;
  useEffect(() => {
    if (data) setPrice(String(data.price));
  }, [data?.price]);

  const update = async (patch: { status?: string; featured?: boolean; price?: number }) => {
    setBusy(true);
    const result = await adminApi.updateProduct(id, patch);
    setBusy(false);
    if (!result.ok) return session.toast(result.message, "bad");
    session.toast("Ürün güncellendi", "ok");
    invalidate("products:");
  };

  return (
    <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} className="scroll-area flex w-[380px] shrink-0 flex-col rounded-[26px] bg-white/[0.06] p-5">
      <div className="flex justify-end">
        <IconButton label="Kapat" size={32} onClick={onClose}><X className="size-4" /></IconButton>
      </div>
      {!data ? (
        product.error ? <ErrorNote message={product.error} onRetry={product.refresh} /> : <Skeleton className="h-60 rounded-[20px]" />
      ) : (
        <>
          {data.image && <img src={data.image} alt="" className="mb-4 h-36 w-full rounded-[18px] object-cover" />}
          <p className="text-[19px] font-semibold text-ink">{data.name}</p>
          <p className="text-[13px] text-ink-3">{data.tagline}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={STATUS[data.status]?.tone ?? "soft"}>{STATUS[data.status]?.label ?? data.status}</Pill>
            {data.licenseCode && <Pill tone="outline">{data.licenseCode}</Pill>}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
            <Stat label="İndirme" value={String(data.downloads)} />
            <Stat label="Görüntülenme" value={String(data.views)} />
            <Stat label="Lisans" value={String(data.counts.licenses)} />
          </div>
          {data.canEdit && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] text-ink-3">Fiyat ({data.currency})</span>
                <input value={price} onChange={(event) => setPrice(event.target.value.replace(",", "."))} className="h-9 w-24 rounded-[10px] bg-black/30 px-3 text-[13px] text-ink outline-none ring-1 ring-white/10" />
                <Button size="sm" disabled={busy || Number(price) === data.price || !Number.isFinite(Number(price))} onClick={() => void update({ price: Number(price) })}>Kaydet</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.status === "PUBLISHED" ? (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm("Ürün sitede gizlensin mi?") && void update({ status: "HIDDEN" })}><EyeOff className="size-4" /> Gizle</Button>
                ) : (
                  <Button size="sm" variant="accent" disabled={busy} onClick={() => void update({ status: "PUBLISHED" })}><Eye className="size-4" /> Yayınla</Button>
                )}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void update({ featured: !data.featured })}><Star className="size-4" /> {data.featured ? "Öne çıkarmayı kaldır" : "Öne çıkar"}</Button>
              </div>
            </div>
          )}
          <p className="mb-1.5 mt-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">Sürümler</p>
          <ul className="space-y-1">
            {data.versions.map((version) => (
              <li key={version.id} className="flex items-center justify-between rounded-[12px] bg-white/[0.04] px-3 py-2 text-[12.5px]">
                <span className="text-ink">{version.version}{version.isLatest && <span className="ml-1.5 text-ok">güncel</span>}</span>
                <span className="flex items-center gap-1 text-ink-3"><Download className="size-3" /> {version.downloads} · {relative(version.releasedAt)}</span>
              </li>
            ))}
            {!data.versions.length && <li className="text-[12.5px] text-ink-4">Sürüm yok</li>}
          </ul>
          {data.reviews.length > 0 && (
            <>
              <p className="mb-1.5 mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">Son yorumlar</p>
              {data.reviews.map((review) => (
                <div key={review.id} className="mb-1.5 rounded-[12px] bg-white/[0.04] px-3 py-2 text-[12.5px]">
                  <p className="text-warn">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)} <span className="text-ink-3">{review.author}</span></p>
                  {review.body && <p className="mt-0.5 text-ink-2">{review.body}</p>}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </motion.aside>
  );
}
