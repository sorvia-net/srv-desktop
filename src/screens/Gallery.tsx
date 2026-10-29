import { Download, Folder, ImageUp, Images, Search, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";

import type { MediaItem, MediaPage } from "@shared/contracts";
import { galleryApi } from "@/data/api";
import { bridge } from "@/data/bridge";
import { bytes, relative } from "@/data/format";
import { invalidate, useQuery } from "@/data/query";
import { onTransferDone } from "@/data/transfers";
import { Button, cn, Empty, ErrorNote, IconButton, Pill, Skeleton } from "@/design/ui";
import { useSession } from "@/shell/context";

export function Gallery() {
  const session = useSession();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [extra, setExtra] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const key = `media:${folder ?? ""}:${search}`;
  const page = useQuery<MediaPage>(key, () => galleryApi.list({ q: search || undefined, folder: folder ?? undefined }));

  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    setExtra([]);
    setCursor(null);
  }, [key]);
  useEffect(() => onTransferDone((transfer) => transfer.target === "media" && invalidate("media:")), []);

  const items = useMemo(() => [...(page.data?.items ?? []), ...extra], [page.data, extra]);
  const current = items.find((item) => item.id === selected) ?? null;
  const next = cursor ?? page.data?.nextCursor ?? null;

  const upload = async (paths: string[]) => {
    if (!paths.length) return;
    if (session.preview) return session.toast("Önizlemede yükleme yapılmaz", "info");
    const result = await bridge.files.uploadMedia(paths, { folder });
    session.toast(result.ok ? `${paths.length} dosya yükleme kuyruğunda` : result.message, result.ok ? "ok" : "bad");
  };

  const pick = async () => upload(await bridge.files.pick({ multiple: true, images: true }));

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    void upload([...event.dataTransfer.files].map((file) => bridge.files.pathFor(file)).filter(Boolean));
  };

  const more = async () => {
    if (!next) return;
    const result = await galleryApi.list({ q: search || undefined, folder: folder ?? undefined, cursor: next });
    if (!result.ok) return session.toast(result.message, "bad");
    setExtra((list) => [...list, ...result.data.items]);
    setCursor(result.data.nextCursor ?? "");
  };

  return (
    <div className="relative flex h-full min-h-0 gap-6" onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Galeri</h1>
            <p className="mt-1 text-[14px] text-ink-2">{page.data ? `${page.data.library.count} görsel · ${bytes(page.data.library.bytes)}` : "Yükleniyor…"}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <label className="flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4">
              <Search className="size-4 text-ink-3" />
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Dosya adı ya da açıklama" className="w-56 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4" />
            </label>
            {page.data?.canUpload && (
              <Button variant="accent" onClick={() => void pick()}>
                <ImageUp className="size-4" /> Yükle
              </Button>
            )}
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          <FolderChip label="Tümü" active={folder === null} onClick={() => setFolder(null)} />
          {page.data?.folders.map((entry) => (
            <FolderChip key={entry.folder} label={`${entry.folder} · ${entry.count}`} active={folder === entry.folder} onClick={() => setFolder(entry.folder)} />
          ))}
        </div>

        {page.error && <ErrorNote message={page.error} onRetry={page.refresh} />}
        <div className="scroll-area fade-bottom -mr-3 min-h-0 flex-1 pr-3">
          {page.loading && !page.data ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
              {Array.from({ length: 12 }, (_, index) => <Skeleton key={index} className="aspect-square rounded-[18px]" />)}
            </div>
          ) : items.length === 0 ? (
            <Empty icon={<Images className="size-6" />} title="Görsel yok" body="Dosyaları bu pencereye sürükleyip bırakarak yükleyebilirsin." />
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 pb-6">
                {items.map((item) => (
                  <button key={item.id} onClick={() => setSelected(item.id)} className={cn("focus-ring group relative aspect-square overflow-hidden rounded-[18px] bg-white/[0.05] ring-2 transition", selected === item.id ? "ring-accent" : "ring-transparent hover:ring-white/20")}>
                    <img src={item.url} alt={item.alt ?? ""} loading="lazy" draggable={false} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-left text-[11.5px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">{item.fileName}</span>
                  </button>
                ))}
              </div>
              {next && (
                <div className="pb-8 text-center">
                  <Button variant="ghost" onClick={() => void more()}>Daha fazla</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {current && <Inspector key={current.id} item={current} canDelete={page.data?.canDelete ?? false} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      {over && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[26px] border-2 border-dashed border-accent bg-accent/10 text-[17px] font-semibold text-ink">
          Yüklemek için bırak
        </div>
      )}
    </div>
  );
}

function FolderChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("focus-ring flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition", active ? "accent-fill font-semibold" : "bg-white/[0.07] text-ink-2 hover:bg-white/[0.12]")}>
      <Folder className="size-3.5" /> {label}
    </button>
  );
}

function Inspector({ item, canDelete, onClose }: { item: MediaItem; canDelete: boolean; onClose: () => void }) {
  const session = useSession();
  const [alt, setAlt] = useState(item.alt ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await galleryApi.update(item.id, { alt });
    setSaving(false);
    session.toast(result.ok ? "Açıklama kaydedildi" : result.message, result.ok ? "ok" : "bad");
    if (result.ok) invalidate("media:");
  };

  const remove = async () => {
    const used = item.usedIn?.length ?? 0;
    if (!window.confirm(used ? `Bu görsel ${used} yerde kullanılıyor. Yine de silinsin mi?` : `${item.fileName} silinsin mi?`)) return;
    const result = await galleryApi.remove(item.id, used > 0);
    if (!result.ok) return session.toast(result.message, "bad");
    session.toast("Görsel silindi", "ok");
    invalidate("media:");
    onClose();
  };

  return (
    <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} className="scroll-area flex w-[320px] shrink-0 flex-col rounded-[24px] bg-white/[0.06] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="truncate text-[15px] font-semibold text-ink">{item.fileName}</p>
        <IconButton label="Kapat" size={32} onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
      <img src={item.url} alt={item.alt ?? ""} className="max-h-[260px] w-full rounded-[16px] bg-black/30 object-contain" />
      <dl className="mt-4 space-y-1.5 text-[12.5px] text-ink-3">
        <div className="flex justify-between"><dt>Boyut</dt><dd className="text-ink-2">{bytes(item.sizeBytes)}</dd></div>
        {item.width && <div className="flex justify-between"><dt>Çözünürlük</dt><dd className="text-ink-2">{item.width}×{item.height}</dd></div>}
        <div className="flex justify-between"><dt>Klasör</dt><dd className="text-ink-2">{item.folder}</dd></div>
        <div className="flex justify-between"><dt>Yüklenme</dt><dd className="text-ink-2">{relative(item.createdAt)}{item.uploader ? ` · ${item.uploader.name}` : ""}</dd></div>
      </dl>
      {item.usedIn && item.usedIn.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.usedIn.slice(0, 6).map((place) => <Pill key={place} tone="soft">{place}</Pill>)}
        </div>
      )}
      <label className="mt-4 text-[12px] font-medium text-ink-3">Açıklama (alt metin)</label>
      <textarea value={alt} onChange={(event) => setAlt(event.target.value)} rows={3} maxLength={300} className="mt-1 resize-none rounded-[14px] bg-white/[0.07] px-3 py-2 text-[13.5px] text-ink outline-none focus:ring-2 focus:ring-accent/60" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="accent" loading={saving} disabled={alt === (item.alt ?? "")} onClick={() => void save()}>Kaydet</Button>
        <Button size="sm" variant="ghost" onClick={() => void bridge.files.downloadMedia({ url: item.url, fileName: item.fileName, size: item.sizeBytes }, { ask: true })}>
          <Download className="size-4" /> İndir
        </Button>
        {canDelete && (
          <Button size="sm" variant="ghost" className="text-bad" onClick={() => void remove()}>
            <Trash2 className="size-4" /> Sil
          </Button>
        )}
      </div>
    </motion.aside>
  );
}
