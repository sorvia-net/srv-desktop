import {
  BarChart3, CalendarClock, Check, Clapperboard, Copy, ExternalLink, Film, Heart, ImagePlus, Images, Camera as Instagram, Link2, MessageCircle, RefreshCw, Send, Settings2, Sparkles, Trash2, Upload, Wand2, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SocialOverview, SocialPost, SocialPrefs } from "@shared/contracts";
import { socialApi } from "@/data/api";
import { bridge } from "@/data/bridge";
import { relative } from "@/data/format";
import { invalidate, useQuery } from "@/data/query";
import { onTransferDone, useTransfers } from "@/data/transfers";
import { Button, cn, Empty, ErrorNote, Pill, Segmented, Skeleton, Switch } from "@/design/ui";
import { ask, askText } from "@/shell/ask";
import { useSession } from "@/shell/context";

type Tab = "queue" | "calendar" | "published" | "insights" | "settings";
const KEY = "social:overview";
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const SHORT_DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

const TYPE_LABEL: Record<SocialPost["type"], string> = { IMAGE: "Gönderi", CAROUSEL: "Kaydırmalı", REEL: "Reels", STORY: "Hikâye" };
const STATUS: Record<SocialPost["status"], { label: string; tone: "soft" | "info" | "warn" | "ok" | "bad" | "accent" }> = {
  DRAFT: { label: "Taslak", tone: "soft" },
  PENDING: { label: "Onay bekliyor", tone: "warn" },
  NEEDS_MEDIA: { label: "Medya bekliyor", tone: "info" },
  SCHEDULED: { label: "Zamanlandı", tone: "accent" },
  PUBLISHING: { label: "Yayınlanıyor", tone: "info" },
  PUBLISHED: { label: "Yayında", tone: "ok" },
  FAILED: { label: "Başarısız", tone: "bad" },
  REJECTED: { label: "Reddedildi", tone: "soft" },
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function when(iso: string | null) {
  if (!iso) return "Saat seçilmedi";
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} · ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
}

function n(value: unknown) {
  return typeof value === "number" ? value.toLocaleString("tr-TR") : "—";
}

export function Social() {
  const session = useSession();
  const overview = useQuery<SocialOverview>(KEY, () => socialApi.overview(), { refreshMs: 60_000 });
  const data = overview.data;
  const [tab, setTab] = useState<Tab>("queue");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (data && !data.account.connected && tab === "queue" && data.queue.length === 0) setTab("settings");
  }, [data?.account.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async <T,>(label: string, task: () => Promise<{ ok: true; data: T } | { ok: false; message: string }>, done?: string) => {
    setBusy(label);
    try {
      const result = await task();
      if (!result.ok) session.toast(result.message, "bad");
      else {
        if (done) session.toast(done, "ok");
        invalidate(KEY);
      }
      return result.ok ? result.data : null;
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    const theme = await askText({ title: "Yeni içerik planı", body: "Claude, Sorvia'nın son sürümlerinden, ürünlerinden ve açık ilanlarından gönderi fikirleri çıkarır, kart görsellerini çizer ve en iyi saatlere yerleştirir. Hepsi önce onayına düşer.", placeholder: "Bu haftanın odağı (boş bırakabilirsin) — ör. işe alım", action: "Plan üret" });
    if (theme === null) return;
    const r = await run("generate", () => socialApi.generate({ theme: theme.trim() || undefined }));
    if (r) {
      session.toast(`${r.created} gönderi onay kuyruğuna eklendi`, "ok");
      setTab("queue");
    }
  };

  const pending = data ? data.queue.filter((p) => ["PENDING", "NEEDS_MEDIA", "DRAFT", "FAILED"].includes(p.status)).length : 0;

  return (
    <div className="flex h-full flex-col">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-[16px] bg-[radial-gradient(circle_at_30%_110%,#fdf497_0%,#fd5949_45%,#d6249f_60%,#285AEB_90%)] text-white"><Instagram className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">Sosyal</h1>
          <p className="truncate text-[13.5px] text-ink-2">
            {data?.account.connected ? (
              <>@{data.account.username} · {n(data.account.followers)} takipçi · {n(data.account.mediaCount)} gönderi{data.account.syncedAt ? ` · ${relative(data.account.syncedAt)} güncellendi` : ""}</>
            ) : (
              "Instagram hesabı bağlı değil"
            )}
          </p>
        </div>
        {data?.account.connected && (
          <Button size="sm" variant="ghost" loading={busy === "sync"} onClick={() => run("sync", () => socialApi.sync(), "Instagram verileri güncellendi")}>
            <RefreshCw /> Güncelle
          </Button>
        )}
        <Button size="sm" variant="accent" loading={busy === "generate"} onClick={generate}>
          <Sparkles /> Plan üret
        </Button>
      </header>

      <div className="mb-4">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "queue", label: "Kuyruk", count: pending || undefined },
            { value: "calendar", label: "Takvim" },
            { value: "published", label: "Yayınlanan" },
            { value: "insights", label: "Analiz" },
            { value: "settings", label: "Ayarlar" },
          ]}
        />
      </div>

      {data?.account.lastError && <div className="mb-3 rounded-[14px] bg-warn/15 px-3 py-2 text-[12.5px] text-warn">{data.account.lastError}</div>}
      {overview.error && <ErrorNote message={overview.error} onRetry={overview.refresh} />}

      <div className="scroll-area fade-bottom -mr-3 min-h-0 flex-1 pr-3">
        {!data ? (
          overview.loading ? <Skeleton className="h-80 rounded-[24px]" /> : <Empty icon={<Instagram className="size-6" />} title="Veri alınamadı" />
        ) : tab === "queue" ? (
          <Queue data={data} onGenerate={generate} generating={busy === "generate"} />
        ) : tab === "calendar" ? (
          <CalendarView data={data} />
        ) : tab === "published" ? (
          <Published data={data} />
        ) : tab === "insights" ? (
          <Insights data={data} />
        ) : (
          <SettingsView data={data} />
        )}
      </div>
    </div>
  );
}

/* ---------- kuyruk ---------- */

function Queue({ data, onGenerate, generating }: { data: SocialOverview; onGenerate: () => void; generating: boolean }) {
  const order: SocialPost["status"][] = ["FAILED", "NEEDS_MEDIA", "PENDING", "DRAFT", "PUBLISHING", "SCHEDULED"];
  const list = [...data.queue].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  if (!list.length)
    return (
      <Empty
        icon={<Sparkles className="size-6" />}
        title="Kuyruk boş"
        body="Claude'dan haftalık plan iste: son sürümler, ürünler ve açık ilanlardan gönderiler hazırlar, sen onaylayınca en iyi saatte kendiliğinden yayınlanır."
        action={<Button variant="accent" loading={generating} onClick={onGenerate}><Sparkles /> Plan üret</Button>}
      />
    );
  return (
    <div className="space-y-4 pb-6">
      {list.map((post) => (
        <PostCard key={post.id} post={post} connected={data.account.connected} />
      ))}
    </div>
  );
}

function Preview({ post, compact = false }: { post: SocialPost; compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const media = post.media;
  const current = media[Math.min(index, media.length - 1)];
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-[18px] bg-black/40", compact ? "w-[120px]" : "w-[260px]", post.type === "REEL" || post.type === "STORY" ? "aspect-[9/16]" : "aspect-[4/5]")}>
      {current ? (
        current.kind === "video" ? (
          <video src={current.url} className="size-full object-cover" muted loop playsInline controls={!compact} />
        ) : (
          <img src={current.url} alt="" className="size-full object-cover" draggable={false} />
        )
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-ink-3">
          {post.type === "REEL" ? <Clapperboard className="size-7" /> : <Images className="size-7" />}
          {!compact && <span className="text-[12px]">{post.type === "REEL" ? "Video bekleniyor" : "Görsel yok"}</span>}
        </div>
      )}
      {media.length > 1 && !compact && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {media.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)} className={cn("size-2 rounded-full", i === index ? "bg-white" : "bg-white/40")} aria-label={`${i + 1}. medya`} />
          ))}
        </div>
      )}
      {media.length > 1 && compact && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 text-[10px] text-white">{media.length}</span>}
    </div>
  );
}

function PostCard({ post, connected }: { post: SocialPost; connected: boolean }) {
  const session = useSession();
  const [caption, setCaption] = useState(post.caption);
  const [tags, setTags] = useState(post.hashtags.map((t) => `#${t}`).join(" "));
  const [at, setAt] = useState(toLocalInput(post.scheduledAt));
  const [busy, setBusy] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const uploads = useRef(new Set<string>());
  const transfers = useTransfers();
  const uploading = transfers.some((t) => uploads.current.has(t.id) && (t.status === "queued" || t.status === "running"));

  useEffect(() => setCaption(post.caption), [post.caption]);
  useEffect(() => setTags(post.hashtags.map((t) => `#${t}`).join(" ")), [post.hashtags]);
  useEffect(() => setAt(toLocalInput(post.scheduledAt)), [post.scheduledAt]);

  // Bu karta ait yükleme bitince medyayı gönderiye ekle.
  useEffect(
    () =>
      onTransferDone((transfer) => {
        if (!uploads.current.has(transfer.id) || !transfer.resultId) return;
        uploads.current.delete(transfer.id);
        const kind: "image" | "video" = /\.(mp4|mov)$/i.test(transfer.resultId) ? "video" : "image";
        const item = { url: transfer.resultId, kind };
        const media = post.type === "REEL" && kind === "video" ? [item] : [...post.media, item];
        void socialApi.post(post.id, { action: "update", media }).then((r) => {
          if (!r.ok) session.toast(r.message, "bad");
          invalidate(KEY);
        });
      }),
    [post.id, post.media, post.type, session],
  );

  const locked = post.status === "PUBLISHING";
  const dirty = caption !== post.caption || tags !== post.hashtags.map((t) => `#${t}`).join(" ") || at !== toLocalInput(post.scheduledAt);
  const hashtags = () => tags.split(/[\s,]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean);
  const length = caption.length + (tags ? tags.length + 2 : 0);

  const act = async (label: string, body: Parameters<typeof socialApi.post>[1], done?: string) => {
    setBusy(label);
    try {
      const r = await socialApi.post(post.id, body);
      if (!r.ok) session.toast(r.message, "bad");
      else if (done) session.toast(done, "ok");
      invalidate(KEY);
      return r.ok;
    } finally {
      setBusy(null);
    }
  };

  const save = () => act("save", { action: "update", caption, hashtags: hashtags(), scheduledAt: at ? new Date(at).toISOString() : null }, "Kaydedildi");

  const approve = async () => {
    if (dirty && !(await act("save", { action: "update", caption, hashtags: hashtags(), scheduledAt: at ? new Date(at).toISOString() : null }))) return;
    await act("approve", { action: "approve", scheduledAt: at ? new Date(at).toISOString() : null }, "Onaylandı, zamanı gelince yayınlanacak");
  };

  const publishNow = async () => {
    if (!(await ask({ title: "Şimdi yayınlansın mı?", body: "Gönderi hemen @" + "sorvianet hesabında yayınlanır. Yayınlanan gönderi buradan geri alınamaz.", action: "Yayınla" }))) return;
    if (dirty) await act("save", { action: "update", caption, hashtags: hashtags() });
    await act("publish", { action: "publish-now" }, "Yayınlandı");
  };

  const pickMedia = async () => {
    if (session.preview) return session.toast("Önizlemede yükleme yapılmaz", "info");
    const paths = await bridge.files.pick({ multiple: post.type !== "REEL", images: false });
    if (!paths.length) return;
    const r = await bridge.files.uploadSocial(paths);
    if (!r.ok) return session.toast(r.message, "bad");
    r.data.forEach((id) => uploads.current.add(id));
    session.toast("Yükleniyor…", "info");
  };

  const removeMedia = (index: number) => act("media", { action: "update", media: post.media.filter((_, i) => i !== index) });

  const rewrite = async () => {
    const instruction = await askText({ title: "Açıklamayı yeniden yaz", placeholder: "ör. daha kısa ve esprili olsun, sonuna soru ekle", value: "Daha kısa ve samimi yap", action: "Yeniden yaz" });
    if (instruction) await act("rewrite", { action: "rewrite", instruction }, "Açıklama yenilendi");
  };

  const reject = async () => {
    if (await ask({ title: "Gönderi reddedilsin mi?", body: "Kuyruktan kalkar; Claude benzerini tekrar önermemek için bunu hatırlar.", action: "Reddet", danger: true })) await act("reject", { action: "reject" }, "Reddedildi");
  };

  return (
    <article className="flex gap-4 rounded-[24px] bg-white/[0.05] p-4">
      <div className="flex flex-col gap-2">
        <Preview post={post} />
        {post.media.length > 0 && post.status !== "SCHEDULED" && (
          <div className="flex flex-wrap gap-1">
            {post.media.map((m, i) => (
              <button key={m.url} onClick={() => removeMedia(i)} className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-ink-3 hover:text-bad">
                <X className="size-3" /> {m.kind === "video" ? "Video" : `Görsel ${i + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={STATUS[post.status].tone}>{STATUS[post.status].label}</Pill>
          <Pill tone="outline">{post.type === "REEL" ? <Film className="size-3" /> : null}{TYPE_LABEL[post.type]}</Pill>
          {post.pillar && <Pill tone="soft">{post.pillar}</Pill>}
          <span className="ml-auto text-[11.5px] text-ink-4">{post.source.startsWith("ai") ? "Claude hazırladı" : "Elle eklendi"} · {relative(post.createdAt)}</span>
        </div>

        {post.hook && <p className="text-[16px] font-semibold leading-snug text-ink">{post.hook}</p>}

        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} disabled={locked} rows={6} className="focus-ring w-full resize-y rounded-[14px] bg-black/25 px-3 py-2.5 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-4" placeholder="Açıklama" />
        <div className="flex items-center gap-2">
          <input value={tags} onChange={(e) => setTags(e.target.value)} disabled={locked} className="focus-ring h-9 min-w-0 flex-1 rounded-[12px] bg-black/25 px-3 text-[13px] text-info" placeholder="#etiketler" />
          <span className={cn("shrink-0 text-[11.5px] tabular-nums", length > 2200 ? "text-bad" : "text-ink-4")}>{length}/2200</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarClock className="size-4 text-ink-3" />
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} disabled={locked} className="focus-ring h-9 rounded-[12px] bg-black/25 px-3 text-[13px] text-ink [color-scheme:dark]" />
          <span className="text-[12px] text-ink-3">{post.status === "SCHEDULED" ? `Yayın: ${when(post.scheduledAt)}` : at ? "Önerilen saat" : "Onaylayınca en iyi boş saate yerleşir"}</span>
        </div>

        {post.aiNotes && (
          <p className="flex gap-2 rounded-[12px] bg-accent/10 px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" /> {post.aiNotes}
          </p>
        )}
        {post.brief && (
          <div className="rounded-[12px] bg-white/[0.04] px-3 py-2">
            <button onClick={() => setShowBrief((v) => !v)} className="flex w-full items-center gap-2 text-[12.5px] font-medium text-ink">
              <Clapperboard className="size-3.5" /> Video çekim/kurgu notu {showBrief ? "▲" : "▼"}
            </button>
            {showBrief && <pre className="mt-2 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink-2">{post.brief}</pre>}
          </div>
        )}
        {post.problem && post.status !== "PUBLISHED" && <p className="text-[12.5px] text-warn">{post.problem}</p>}
        {post.error && <p className="rounded-[12px] bg-bad/10 px-3 py-2 text-[12.5px] text-bad">Son deneme: {post.error}</p>}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {post.status === "SCHEDULED" ? (
            <Button size="sm" variant="glass" loading={busy === "unschedule"} onClick={() => act("unschedule", { action: "unschedule" }, "Zamanlama kaldırıldı")}>
              <X /> Zamanlamayı kaldır
            </Button>
          ) : (
            <Button size="sm" variant="accent" disabled={!!post.problem || locked || !connected} loading={busy === "approve"} onClick={approve} title={!connected ? "Önce Instagram hesabını bağla" : post.problem ?? undefined}>
              <Check /> Onayla ve zamanla
            </Button>
          )}
          <Button size="sm" variant="glass" disabled={!!post.problem || locked || !connected} loading={busy === "publish"} onClick={publishNow}>
            <Send /> Şimdi yayınla
          </Button>
          <Button size="sm" variant="glass" disabled={locked} loading={uploading} onClick={pickMedia}>
            {post.type === "REEL" ? <Upload /> : <ImagePlus />} {post.type === "REEL" ? "Video yükle" : "Görsel ekle"}
          </Button>
          <Button size="sm" variant="ghost" disabled={locked} loading={busy === "rewrite"} onClick={rewrite}>
            <Wand2 /> Yeniden yaz
          </Button>
          {post.design && post.type !== "REEL" && (
            <Button size="sm" variant="ghost" disabled={locked} loading={busy === "rerender"} onClick={() => act("rerender", { action: "rerender" }, "Görsel yeniden çizildi")}>
              <RefreshCw /> Görseli yeniden çiz
            </Button>
          )}
          {dirty && (
            <Button size="sm" variant="ghost" loading={busy === "save"} onClick={save}>
              Kaydet
            </Button>
          )}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" disabled={locked} loading={busy === "reject"} onClick={reject} className="hover:text-bad">
            <Trash2 /> Reddet
          </Button>
        </div>
      </div>
    </article>
  );
}

/* ---------- takvim ---------- */

function CalendarView({ data }: { data: SocialOverview }) {
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => new Date(start.getTime() + i * 86_400_000));
  }, []);
  const all = [...data.queue, ...data.published];
  const best = (d: Date) => {
    const row = data.heat.heat[d.getDay()] ?? [];
    const top = row.map((v, h) => ({ v, h })).sort((a, b) => b.v - a.v)[0];
    return top ? `${String(top.h).padStart(2, "0")}:00` : "";
  };
  return (
    <div className="grid grid-cols-2 gap-3 pb-6 lg:grid-cols-7">
      {days.map((d) => {
        const items = all.filter((p) => {
          const t = p.status === "PUBLISHED" ? p.publishedAt : p.scheduledAt;
          return t && new Date(t).toDateString() === d.toDateString();
        });
        return (
          <div key={d.toISOString()} className="flex min-h-[160px] flex-col gap-2 rounded-[18px] bg-white/[0.05] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] font-semibold text-ink">{SHORT_DAYS[d.getDay()]} {d.getDate()}</span>
              <span className="text-[10.5px] text-ink-4" title="Bu günün en iyi saati">★ {best(d)}</span>
            </div>
            {items.map((p) => (
              <div key={p.id} className={cn("flex gap-2 rounded-[12px] p-1.5", p.status === "PUBLISHED" ? "bg-ok/10" : p.status === "SCHEDULED" ? "bg-accent/12" : "bg-white/[0.04]")}>
                <Preview post={p} compact />
                <div className="min-w-0 text-[11px] leading-snug">
                  <p className="font-semibold text-ink">{new Date((p.status === "PUBLISHED" ? p.publishedAt : p.scheduledAt)!).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="text-ink-3">{TYPE_LABEL[p.type]}</p>
                  <p className="line-clamp-3 text-ink-2">{p.hook ?? p.caption}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- yayınlanan ---------- */

function Published({ data }: { data: SocialOverview }) {
  if (!data.published.length) return <Empty icon={<Send className="size-6" />} title="Henüz yayın yok" body="Onayladığın gönderiler yayınlandıkça burada erişim, beğeni ve kaydetme sayılarıyla görünür." />;
  return (
    <div className="grid grid-cols-1 gap-3 pb-6 lg:grid-cols-2">
      {data.published.map((p) => {
        const m = (p.metrics ?? {}) as Record<string, number>;
        return (
          <article key={p.id} className="flex gap-3 rounded-[20px] bg-white/[0.05] p-3">
            <Preview post={p} compact />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Pill tone="outline">{TYPE_LABEL[p.type]}</Pill>
                <span className="text-[11.5px] text-ink-4">{p.publishedAt ? when(p.publishedAt) : ""}</span>
              </div>
              <p className="line-clamp-2 text-[13px] text-ink">{p.hook ?? p.caption}</p>
              <div className="mt-auto flex flex-wrap gap-3 text-[12px] text-ink-2">
                <span title="Erişim">👁 {n(m.reach ?? m.views)}</span>
                <span className="flex items-center gap-1"><Heart className="size-3.5" /> {n(m.likes)}</span>
                <span className="flex items-center gap-1"><MessageCircle className="size-3.5" /> {n(m.comments)}</span>
                <span title="Kaydetme">🔖 {n(m.saved)}</span>
                <span title="Paylaşım">↗ {n(m.shares)}</span>
              </div>
              {p.permalink && (
                <button onClick={() => void bridge.system.openExternal(p.permalink!)} className="flex w-fit items-center gap-1 text-[12px] text-info hover:underline">
                  Instagram'da aç <ExternalLink className="size-3" />
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ---------- analiz ---------- */

function Insights({ data }: { data: SocialOverview }) {
  const daily = data.daily;
  const first = daily[0]?.followers ?? 0;
  const last = daily[daily.length - 1]?.followers ?? data.account.followers ?? 0;
  const pub = data.published.filter((p) => p.metrics);
  const sum = (k: string) => pub.reduce((acc, p) => acc + (Number((p.metrics as Record<string, number>)[k]) || 0), 0);
  const top = [...pub].sort((a, b) => (Number((b.metrics as Record<string, number>).reach) || 0) - (Number((a.metrics as Record<string, number>).reach) || 0)).slice(0, 5);
  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Takipçi" value={n(data.account.followers)} hint={daily.length > 1 ? `${last - first >= 0 ? "+" : ""}${last - first} (son ${daily.length} gün)` : undefined} />
        <Tile label="Toplam erişim (30 gün)" value={n(sum("reach"))} />
        <Tile label="Etkileşim" value={n(sum("likes") + sum("comments") + sum("saved") + sum("shares"))} hint="beğeni + yorum + kaydetme + paylaşım" />
        <Tile label="Yayın" value={n(data.published.length)} hint={`${data.counts.SCHEDULED ?? 0} zamanlanmış`} />
      </div>

      <section className="rounded-[22px] bg-white/[0.05] p-4">
        <p className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-ink"><BarChart3 className="size-4" /> Takipçi eğrisi</p>
        {daily.length > 1 ? <Spark values={daily.map((d) => d.followers)} labels={daily.map((d) => d.day.slice(5))} /> : <p className="text-[12.5px] text-ink-4">Hesap bağlandıktan sonra her gün bir nokta eklenir.</p>}
      </section>

      <section className="rounded-[22px] bg-white/[0.05] p-4">
        <p className="mb-1 text-[13.5px] font-semibold text-ink">En iyi paylaşım saatleri</p>
        <p className="mb-3 text-[12px] text-ink-3">
          {data.heat.samples === 0
            ? "Şimdilik Türkiye'deki genç oyun kitlesinin genel kalıbı kullanılıyor. Gönderilerin yayınlandıkça kendi erişim ve etkileşim verine göre güncellenir."
            : `Haritanın %${Math.round(data.heat.alpha * 100)}'i senin ${data.heat.samples} gönderinin verisinden, kalanı genel kalıptan.`}
        </p>
        <Heatmap heat={data.heat.heat} />
      </section>

      {top.length > 0 && (
        <section className="rounded-[22px] bg-white/[0.05] p-4">
          <p className="mb-2 text-[13.5px] font-semibold text-ink">En çok erişen gönderiler</p>
          <div className="space-y-1">
            {top.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.03] px-3 py-2 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate text-ink">{TYPE_LABEL[p.type]} · {p.hook ?? p.caption}</span>
                <span className="shrink-0 tabular-nums text-ink-3">{n((p.metrics as Record<string, number>).reach)} erişim</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] bg-white/[0.05] p-4">
      <span className="text-[12px] text-ink-3">{label}</span>
      <span className="text-[22px] font-semibold leading-none tabular-nums text-ink">{value}</span>
      {hint && <span className="text-[11.5px] text-ink-4">{hint}</span>}
    </div>
  );
}

function Spark({ values, labels }: { values: number[]; labels: string[] }) {
  const W = 640;
  const H = 120;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 10 - ((v - min) / span) * (H - 24)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full" preserveAspectRatio="none">
        <path d={`${d} L${W},${H} L0,${H} Z`} fill="rgb(var(--accent-rgb, 224 120 47) / 0.15)" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-accent" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10.5px] text-ink-4">
        <span>{labels[0]} · {values[0]}</span>
        <span>{labels[labels.length - 1]} · {values[values.length - 1]}</span>
      </div>
    </div>
  );
}

function Heatmap({ heat }: { heat: number[][] }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[620px] gap-[3px]" style={{ gridTemplateColumns: "44px repeat(24, minmax(0, 1fr))" }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[9.5px] text-ink-4">{h % 3 === 0 ? h : ""}</span>
        ))}
        {order.map((d) => (
          <Row key={d} label={SHORT_DAYS[d]} row={heat[d] ?? []} />
        ))}
      </div>
    </div>
  );
}

function Row({ label, row }: { label: string; row: number[] }) {
  return (
    <>
      <span className="pr-1 text-right text-[11px] leading-[18px] text-ink-3">{label}</span>
      {row.map((v, h) => (
        <span key={h} title={`${label} ${String(h).padStart(2, "0")}:00 · ${Math.round(v * 100)}/100`} className="h-[18px] rounded-[4px]" style={{ background: `rgba(224, 120, 47, ${0.06 + v * 0.9})` }} />
      ))}
    </>
  );
}

/* ---------- ayarlar ---------- */

function SettingsView({ data }: { data: SocialOverview }) {
  const session = useSession();
  const a = data.account;
  const [appId, setAppId] = useState(a.appId ?? "");
  const [secret, setSecret] = useState("");
  const [prefs, setPrefs] = useState<SocialPrefs>(data.prefs);
  const [pillars, setPillars] = useState(data.prefs.pillars.join("\n"));
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setPrefs(data.prefs);
    setPillars(data.prefs.pillars.join("\n"));
  }, [data.prefs]);

  const go = async <T,>(label: string, task: () => Promise<{ ok: true; data: T } | { ok: false; message: string }>, done?: string) => {
    setBusy(label);
    try {
      const r = await task();
      if (!r.ok) session.toast(r.message, "bad");
      else if (done) session.toast(done, "ok");
      invalidate(KEY);
      return r.ok ? r.data : null;
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    if (appId !== (a.appId ?? "") || secret) {
      if (!(await go("app", () => socialApi.saveApp(appId, secret || undefined)))) return;
      setSecret("");
    }
    const r = await go("connect", () => socialApi.connectUrl());
    if (r) {
      await bridge.system.openExternal(r.url);
      session.toast("Tarayıcıda Instagram'a giriş yapıp izin ver; bitince burası kendiliğinden güncellenir.", "info");
      // Bağlantı tarayıcıda tamamlanır; birkaç kez yokla.
      for (const delay of [8000, 16000, 30000, 60000]) setTimeout(() => invalidate(KEY), delay);
    }
  };

  const set = <K extends keyof SocialPrefs>(key: K, value: SocialPrefs[K]) => setPrefs((p) => ({ ...p, [key]: value }));
  const savePrefs = () => go("prefs", () => socialApi.savePrefs({ ...prefs, pillars: pillars.split("\n").map((s) => s.trim()).filter(Boolean) }), "Tercihler kaydedildi");

  return (
    <div className="grid gap-4 pb-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-[22px] bg-white/[0.05] p-4">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Link2 className="size-4" /> Instagram bağlantısı</p>
        {a.connected ? (
          <div className="flex items-center gap-3 rounded-[16px] bg-ok/10 p-3">
            {a.avatarUrl ? <img src={a.avatarUrl} alt="" className="size-11 rounded-full" /> : <Instagram className="size-8 text-ok" />}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink">@{a.username}</p>
              <p className="text-[12px] text-ink-3">Bağlı{a.tokenExpiresAt ? ` · erişim anahtarı ${new Date(a.tokenExpiresAt).toLocaleDateString("tr-TR")} tarihine kadar geçerli, kendiliğinden yenilenir` : ""}</p>
            </div>
            <Button size="sm" variant="ghost" loading={busy === "disconnect"} onClick={async () => (await ask({ title: "Bağlantı kesilsin mi?", body: "Zamanlanmış gönderiler yayınlanmaz. Gönderiler ve geçmiş silinmez.", action: "Bağlantıyı kes", danger: true })) && go("disconnect", () => socialApi.disconnect(), "Bağlantı kesildi")}>
              Kes
            </Button>
          </div>
        ) : (
          <ol className="list-decimal space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-ink-2">
            <li><button className="text-info hover:underline" onClick={() => void bridge.system.openExternal("https://developers.facebook.com/apps/creation/")}>developers.facebook.com</button>'da yeni uygulama oluştur (tür: <b>İşletme</b>).</li>
            <li>Ürün olarak <b>Instagram</b> ekle → <b>Instagram girişli API</b> kurulumunu aç.</li>
            <li>"Instagram işletme girişi" ayarlarında yönlendirme adresine şunu ekle:</li>
            <li className="list-none">
              <button onClick={() => { void navigator.clipboard.writeText(a.redirectUri); session.toast("Kopyalandı", "ok"); }} className="flex w-full items-center gap-2 rounded-[10px] bg-black/30 px-3 py-2 text-left font-mono text-[11.5px] text-ink hover:bg-black/40">
                <span className="min-w-0 flex-1 truncate">{a.redirectUri}</span> <Copy className="size-3.5 shrink-0" />
              </button>
            </li>
            <li>Uygulama rollerinde @sorvianet hesabını <b>Instagram test kullanıcısı</b> olarak ekle; Instagram'da Ayarlar → Uygulamalar ve web siteleri → Test davetleri'nden kabul et.</li>
            <li>Instagram uygulama kimliğini ve gizli anahtarını aşağıya yaz, <b>Bağlan</b>'a bas.</li>
          </ol>
        )}
        <label className="block text-[12px] text-ink-3">
          Instagram uygulama kimliği
          <input value={appId} onChange={(e) => setAppId(e.target.value.trim())} className="focus-ring mt-1 h-10 w-full rounded-[12px] bg-black/25 px-3 font-mono text-[13px] text-ink" placeholder="ör. 1234567890123456" />
        </label>
        <label className="block text-[12px] text-ink-3">
          Instagram uygulama gizli anahtarı {a.appSecretSet && <span className="text-ok">· kayıtlı</span>}
          <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" className="focus-ring mt-1 h-10 w-full rounded-[12px] bg-black/25 px-3 font-mono text-[13px] text-ink" placeholder={a.appSecretSet ? "değiştirmek için yaz" : "gizli anahtar"} autoComplete="off" />
        </label>
        <div className="flex gap-2">
          <Button variant="accent" size="sm" disabled={!appId || (!secret && !a.appSecretSet)} loading={busy === "connect" || busy === "app"} onClick={connect}>
            <Instagram /> {a.connected ? "Yeniden bağlan" : "Bağlan"}
          </Button>
          {(appId !== (a.appId ?? "") || secret) && (
            <Button variant="ghost" size="sm" loading={busy === "app"} onClick={() => go("app", () => socialApi.saveApp(appId, secret || undefined), "Kaydedildi").then(() => setSecret(""))}>
              Yalnızca kaydet
            </Button>
          )}
        </div>
        <p className="text-[11.5px] leading-relaxed text-ink-4">Anahtarlar sunucuda şifreli saklanır, bu bilgisayarda tutulmaz. Facebook sayfası gerekmez; işletme hesabı yeterli.</p>
      </section>

      <section className="space-y-3 rounded-[22px] bg-white/[0.05] p-4">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Settings2 className="size-4" /> İçerik tercihleri</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Haftalık gönderi" value={prefs.postsPerWeek} onChange={(v) => set("postsPerWeek", v)} max={14} />
          <NumberField label="Haftalık Reels" value={prefs.reelsPerWeek} onChange={(v) => set("reelsPerWeek", v)} max={14} />
          <NumberField label="Gönderiler arası en az (saat)" value={prefs.minGapHours} onChange={(v) => set("minGapHours", v)} min={2} max={72} />
          <div className="text-[12px] text-ink-3">
            Sessiz saatler
            <div className="mt-1 flex items-center gap-1.5">
              <HourSelect value={prefs.quietStart} onChange={(v) => set("quietStart", v)} /> – <HourSelect value={prefs.quietEnd} onChange={(v) => set("quietEnd", v)} />
            </div>
          </div>
        </div>
        <label className="block text-[12px] text-ink-3">
          Marka sesi
          <textarea value={prefs.voice} onChange={(e) => set("voice", e.target.value)} rows={3} className="focus-ring mt-1 w-full rounded-[12px] bg-black/25 px-3 py-2 text-[13px] text-ink" />
        </label>
        <label className="block text-[12px] text-ink-3">
          İçerik eksenleri (her satıra bir tane)
          <textarea value={pillars} onChange={(e) => setPillars(e.target.value)} rows={5} className="focus-ring mt-1 w-full rounded-[12px] bg-black/25 px-3 py-2 text-[13px] text-ink" />
        </label>
        <div className="space-y-2 rounded-[14px] bg-black/20 p-3">
          <Switch checked={prefs.autoPlan} onChange={(v) => set("autoPlan", v)} label="Her hafta otomatik plan üret" />
          {prefs.autoPlan && (
            <div className="flex items-center gap-2 text-[12px] text-ink-3">
              Plan günü
              <select value={prefs.autoPlanDay} onChange={(e) => set("autoPlanDay", Number(e.target.value))} className="focus-ring h-8 rounded-[10px] bg-black/30 px-2 text-[12.5px] text-ink [color-scheme:dark]">
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
              saat 10:00
            </div>
          )}
          <p className="text-[11.5px] leading-relaxed text-ink-4">Otomatik plan da önce onayına düşer; sen onaylamadan hiçbir şey yayınlanmaz.</p>
        </div>
        <Button variant="accent" size="sm" loading={busy === "prefs"} onClick={savePrefs}>Kaydet</Button>
      </section>
    </div>
  );
}

function NumberField({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max: number }) {
  return (
    <label className="block text-[12px] text-ink-3">
      {label}
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} className="focus-ring mt-1 h-10 w-full rounded-[12px] bg-black/25 px-3 text-[13px] tabular-nums text-ink [color-scheme:dark]" />
    </label>
  );
}

function HourSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="focus-ring h-10 rounded-[12px] bg-black/25 px-2 text-[13px] text-ink [color-scheme:dark]">
      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
    </select>
  );
}
