import { ArrowDownToLine, ChevronRight, Clock, Download, FileText, Folder, FolderOpen, FolderPlus, HardDrive, Pencil, RotateCcw, Search, Star, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { DragEvent } from "react";

import type { DriveFile, DriveFolder, DriveMode, DriveView, LocalDownload, LocalUsage, StorageOverview } from "@shared/contracts";
import { filesApi, type DriveAction } from "@/data/api";
import { bridge } from "@/data/bridge";
import { bytes, relative } from "@/data/format";
import { invalidate, useQuery } from "@/data/query";
import { clearFinishedTransfers, onTransferDone, useTransfers } from "@/data/transfers";
import { Button, cn, Empty, ErrorNote, IconButton, Progress, Segmented, Skeleton } from "@/design/ui";
import { useSession } from "@/shell/context";

type Tab = "overview" | "drive" | "local";

export function Storage() {
  const session = useSession();
  const founder = session.user.role === "OWNER";
  const [tab, setTab] = useState<Tab>("overview");
  const options: { value: Tab; label: string }[] = [
    { value: "overview", label: "Özet" },
    ...(founder ? [{ value: "drive" as const, label: "Kurucu deposu" }] : []),
    { value: "local", label: "Bu bilgisayar" },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Depolama</h1>
          <p className="mt-1 text-[14px] text-ink-2">Sunucudaki alan, dosyalar ve indirilenler</p>
        </div>
        <Segmented value={tab} onChange={setTab} options={options} />
      </header>
      <div className="min-h-0 flex-1">
        {tab === "overview" && <Overview />}
        {tab === "drive" && founder && <Drive />}
        {tab === "local" && <Local />}
      </div>
    </div>
  );
}

function Overview() {
  const overview = useQuery<StorageOverview>("storage:overview", () => filesApi.overview(), { refreshMs: 5 * 60_000 });
  const usage = useQuery<LocalUsage>("files:usage", async () => ({ ok: true, data: await bridge.files.usage() }));
  const data = overview.data;
  const total = data?.categories.reduce((sum, item) => sum + item.bytes, 0) ?? 0;
  const disk = data?.disk;
  return (
    <div className="scroll-area fade-bottom -mr-3 h-full pr-3">
      {overview.error && <ErrorNote message={overview.error} onRetry={overview.refresh} />}
      <section className="rounded-[24px] bg-white/[0.06] p-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[15px] font-semibold text-ink">Sunucu</p>
          <p className="text-[13px] text-ink-3">{disk ? `${bytes(disk.total - disk.free)} / ${bytes(disk.total)} dolu` : data ? `${bytes(total)} kullanımda` : "Hesaplanıyor…"}</p>
        </div>
        {!data ? (
          <Skeleton className="mt-4 h-4 rounded-full" />
        ) : (
          <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-white/[0.08]">
            {data.categories.map((item) => (
              <span key={item.id} title={`${item.label}: ${bytes(item.bytes)}`} style={{ width: `${disk ? (item.bytes / disk.total) * 100 : total ? (item.bytes / total) * 100 : 0}%`, background: item.color }} />
            ))}
          </div>
        )}
        <div className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {data?.categories.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <span className="size-3 rounded-full" style={{ background: item.color }} />
              <span className="flex-1 text-[14px] text-ink">{item.label}</span>
              <span className="text-[13px] tabular-nums text-ink-2">{bytes(item.bytes)}{item.count !== null ? ` · ${item.count}` : ""}</span>
            </div>
          ))}
        </div>
        {data?.scope === "limited" && <p className="mt-4 text-[12px] text-ink-4">Disk ayrıntıları yalnızca kuruculara gösterilir.</p>}
      </section>

      <section className="mt-5 rounded-[24px] bg-white/[0.06] p-6">
        <p className="text-[15px] font-semibold text-ink">Bu bilgisayar</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[18px] bg-white/[0.05] p-4">
            <p className="text-[12px] text-ink-3">İndirilenler</p>
            <p className="mt-1 text-[22px] font-semibold text-ink">{usage.data ? bytes(usage.data.downloads) : "—"}</p>
            <p className="text-[12px] text-ink-3">{usage.data?.downloadCount ?? 0} dosya</p>
          </div>
          <div className="rounded-[18px] bg-white/[0.05] p-4">
            <p className="text-[12px] text-ink-3">Önbellek</p>
            <p className="mt-1 text-[22px] font-semibold text-ink">{usage.data ? bytes(usage.data.cache) : "—"}</p>
            <button
              className="mt-1 text-[12px] font-medium text-accent-2 hover:underline"
              onClick={async () => {
                await bridge.files.clearCache();
                invalidate("files:usage");
              }}
            >
              Önbelleği temizle
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

const MODES: { value: DriveMode; label: string; icon: typeof Folder }[] = [
  { value: "folder", label: "Dosyalarım", icon: FolderOpen },
  { value: "recent", label: "Son kullanılan", icon: Clock },
  { value: "starred", label: "Yıldızlı", icon: Star },
  { value: "trash", label: "Çöp kutusu", icon: Trash2 },
];

function Drive() {
  const session = useSession();
  const [mode, setMode] = useState<DriveMode>("folder");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [over, setOver] = useState(false);
  const effective: DriveMode = search ? "search" : mode;
  const key = `drive:${effective}:${folderId ?? ""}:${search}`;
  const view = useQuery<DriveView>(key, () => filesApi.drive({ mode: effective, folder: folderId ?? undefined, q: search || undefined }));

  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => onTransferDone((transfer) => transfer.target === "drive" && invalidate("drive:")), []);

  const act = async (body: DriveAction, success?: string) => {
    const result = await filesApi.act(body);
    if (!result.ok) return session.toast(result.message, "bad");
    session.toast(result.data.message ?? success ?? "Tamam", "ok");
    invalidate("drive:");
  };

  const upload = async (paths: string[]) => {
    if (!paths.length) return;
    if (session.preview) return session.toast("Önizlemede yükleme yapılmaz", "info");
    const result = await bridge.files.uploadDrive(paths, { folderId: mode === "folder" ? folderId : null });
    session.toast(result.ok ? `${paths.length} dosya yükleme kuyruğunda` : result.message, result.ok ? "ok" : "bad");
  };

  const newFolder = async () => {
    const name = window.prompt("Klasör adı");
    if (!name?.trim()) return;
    const result = await filesApi.createFolder(folderId, name.trim());
    if (!result.ok) return session.toast(result.message, "bad");
    invalidate("drive:");
  };

  const rename = (kind: "file" | "folder", id: string, current: string) => {
    const name = window.prompt("Yeni ad", current);
    if (name?.trim() && name.trim() !== current) void act({ action: "rename", kind, id, name: name.trim() }, "Yeniden adlandırıldı");
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    void upload([...event.dataTransfer.files].map((file) => bridge.files.pathFor(file)).filter(Boolean));
  };

  const data = view.data;
  const open = (folder: DriveFolder) => {
    setMode("folder");
    setQ("");
    setFolderId(folder.id);
  };

  return (
    <div className="relative flex h-full min-h-0 gap-5" onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
      <nav className="w-[190px] shrink-0 space-y-1">
        {MODES.map((item) => (
          <button
            key={item.value}
            onClick={() => {
              setMode(item.value);
              setQ("");
              if (item.value === "folder") setFolderId(null);
            }}
            className={cn("focus-ring flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-[14px] transition", effective === item.value ? "bg-white/[0.12] font-semibold text-ink" : "text-ink-2 hover:bg-white/[0.06]")}
          >
            <item.icon className="size-4" /> {item.label}
          </button>
        ))}
        {data && (
          <div className="px-3 pt-5">
            <Progress value={data.stats.quota ? data.stats.used / data.stats.quota : 0} />
            <p className="mt-2 text-[12px] text-ink-3">{bytes(data.stats.used)} / {bytes(data.stats.quota)}</p>
            <p className="text-[12px] text-ink-4">{data.stats.files} dosya · {data.stats.folders} klasör</p>
          </div>
        )}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-1 text-[14px] text-ink-2">
            <button className="hover:text-ink" onClick={() => { setMode("folder"); setFolderId(null); setQ(""); }}>Depo</button>
            {effective === "folder" && data?.path.map((crumb) => (
              <span key={crumb.id} className="flex items-center gap-1">
                <ChevronRight className="size-3.5 text-ink-4" />
                <button className="truncate hover:text-ink" onClick={() => setFolderId(crumb.id)}>{crumb.name}</button>
              </span>
            ))}
          </div>
          <label className="flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4">
            <Search className="size-4 text-ink-3" />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Depoda ara" className="w-44 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4" />
          </label>
          {effective === "folder" && (
            <>
              <Button onClick={() => void newFolder()}><FolderPlus className="size-4" /> Klasör</Button>
              <Button variant="accent" onClick={async () => upload(await bridge.files.pick({ multiple: true, images: false }))}><Upload className="size-4" /> Yükle</Button>
            </>
          )}
          {effective === "trash" && data && data.trash.length > 0 && (
            <Button variant="ghost" className="text-bad" onClick={() => window.confirm("Çöp kutusu kalıcı olarak boşaltılsın mı?") && void act({ action: "empty-trash" }, "Çöp kutusu boşaltıldı")}>Boşalt</Button>
          )}
        </div>

        {view.error && <ErrorNote message={view.error} onRetry={view.refresh} />}
        <div className="scroll-area fade-bottom -mr-3 min-h-0 flex-1 pr-3">
          {view.loading && !data ? (
            <div className="space-y-2">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-12 rounded-[14px]" />)}</div>
          ) : !data ? null : effective === "trash" ? (
            data.trash.length === 0 ? (
              <Empty icon={<Trash2 className="size-6" />} title="Çöp kutusu boş" />
            ) : (
              <ul className="space-y-1.5 pb-6">
                {data.trash.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="flex items-center gap-3 rounded-[14px] bg-white/[0.04] px-4 py-3">
                    {item.type === "folder" ? <Folder className="size-5 text-warn" /> : <FileText className="size-5 text-ink-3" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-ink">{item.name}</span>
                      <span className="text-[12px] text-ink-4">{item.origin} · {relative(item.trashedAt)} silindi</span>
                    </span>
                    <IconButton label="Geri yükle" size={34} onClick={() => void act({ action: "restore", ...(item.type === "file" ? { fileIds: [item.id] } : { folderIds: [item.id] }) }, "Geri yüklendi")}><RotateCcw className="size-4" /></IconButton>
                    <IconButton label="Kalıcı sil" size={34} onClick={() => window.confirm(`${item.name} kalıcı olarak silinsin mi?`) && void act({ action: "purge", ...(item.type === "file" ? { fileIds: [item.id] } : { folderIds: [item.id] }) }, "Kalıcı olarak silindi")}><X className="size-4" /></IconButton>
                  </li>
                ))}
              </ul>
            )
          ) : data.folders.length === 0 && data.files.length === 0 ? (
            <Empty icon={<HardDrive className="size-6" />} title={search ? "Sonuç yok" : "Burası boş"} body={effective === "folder" ? "Dosyaları bu pencereye sürükleyip bırakarak yükleyebilirsin." : undefined} />
          ) : (
            <div className="pb-6">
              {data.folders.length > 0 && (
                <div className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                  {data.folders.map((folder) => (
                    <div key={folder.id} className="group relative">
                      <button onDoubleClick={() => open(folder)} onClick={() => open(folder)} className="focus-ring flex w-full items-center gap-3 rounded-[18px] bg-white/[0.06] px-4 py-3.5 text-left transition hover:bg-white/[0.1]">
                        <Folder className="size-6 shrink-0" style={{ color: folder.color ?? "#f5b13d" }} fill="currentColor" />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-ink">{folder.name}</span>
                          <span className="text-[11.5px] text-ink-4">{folder.files} dosya · {bytes(folder.bytes)}</span>
                        </span>
                      </button>
                      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                        <IconButton label="Yeniden adlandır" size={28} onClick={() => rename("folder", folder.id, folder.name)}><Pencil className="size-3.5" /></IconButton>
                        <IconButton label="Çöpe at" size={28} onClick={() => void act({ action: "trash", folderIds: [folder.id] }, "Çöp kutusuna taşındı")}><Trash2 className="size-3.5" /></IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <ul className="space-y-1">
                {data.files.map((file) => (
                  <FileRow key={file.id} file={file} onAct={act} onRename={() => rename("file", file.id, file.name)} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {over && effective === "folder" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[26px] border-2 border-dashed border-accent bg-accent/10 text-[17px] font-semibold text-ink">
          {data?.path.at(-1)?.name ?? "Depo"} klasörüne yükle
        </div>
      )}
    </div>
  );
}

function FileRow({ file, onAct, onRename }: { file: DriveFile; onAct: (body: DriveAction, success?: string) => Promise<void>; onRename: () => void }) {
  const session = useSession();
  const download = async (open: boolean) => {
    const result = await bridge.files.downloadDrive({ id: file.id, name: file.name, size: file.size }, { ask: !open, open });
    if (!result.ok) session.toast(result.message, "bad");
  };
  return (
    <li className="group flex items-center gap-3 rounded-[14px] px-4 py-2.5 transition hover:bg-white/[0.06]" onDoubleClick={() => void download(true)}>
      <FileText className="size-5 shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-ink">{file.name}</span>
        <span className="text-[11.5px] text-ink-4">{bytes(file.size)} · {relative(file.updatedAt)}{file.versions > 1 ? ` · ${file.versions} sürüm` : ""}</span>
      </span>
      <button aria-label={file.starred ? "Yıldızı kaldır" : "Yıldızla"} onClick={() => void onAct({ action: file.starred ? "unstar" : "star", fileIds: [file.id] })} className={cn("rounded-full p-1.5", file.starred ? "text-warn" : "text-ink-4 opacity-0 group-hover:opacity-100")}>
        <Star className="size-4" fill={file.starred ? "currentColor" : "none"} />
      </button>
      <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
        <IconButton label="İndir" size={32} onClick={() => void download(false)}><Download className="size-4" /></IconButton>
        <IconButton label="Yeniden adlandır" size={32} onClick={onRename}><Pencil className="size-4" /></IconButton>
        <IconButton label="Çöpe at" size={32} onClick={() => void onAct({ action: "trash", fileIds: [file.id] }, "Çöp kutusuna taşındı")}><Trash2 className="size-4" /></IconButton>
      </div>
    </li>
  );
}

function Local() {
  const session = useSession();
  const transfers = useTransfers();
  const downloads = useQuery<LocalDownload[]>("files:downloads", async () => ({ ok: true, data: await bridge.files.downloads() }));
  useEffect(() => onTransferDone(() => invalidate("files:")), []);
  return (
    <div className="scroll-area fade-bottom -mr-3 h-full pr-3">
      {transfers.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[15px] font-semibold text-ink">Aktarımlar</p>
            <button className="text-[12.5px] text-ink-3 hover:text-ink" onClick={clearFinishedTransfers}>Bitenleri temizle</button>
          </div>
          <ul className="space-y-1.5">
            {transfers.map((item) => (
              <li key={item.id} className="rounded-[14px] bg-white/[0.05] px-4 py-3">
                <div className="flex items-center gap-3">
                  {item.kind === "upload" ? <Upload className="size-4 text-accent-2" /> : <ArrowDownToLine className="size-4 text-info" />}
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{item.name}</span>
                  <span className={cn("text-[12px]", item.status === "failed" ? "text-bad" : "text-ink-3")}>
                    {item.status === "running" ? `${Math.round((item.done / Math.max(item.size, 1)) * 100)}%` : item.status === "done" ? "Tamam" : item.status === "failed" ? (item.error ?? "Başarısız") : item.status === "queued" ? "Sırada" : "İptal"}
                  </span>
                  {(item.status === "running" || item.status === "queued") && (
                    <IconButton label="İptal" size={28} onClick={() => void bridge.files.cancel(item.id)}><X className="size-3.5" /></IconButton>
                  )}
                </div>
                {item.status === "running" && <Progress value={item.done / Math.max(item.size, 1)} className="mt-2" />}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mb-2 text-[15px] font-semibold text-ink">İndirilenler</p>
      {!downloads.data || downloads.data.length === 0 ? (
        <Empty icon={<ArrowDownToLine className="size-6" />} title="Henüz indirme yok" body="Depodan ya da galeriden indirdiğin dosyalar burada listelenir." />
      ) : (
        <ul className="space-y-1">
          {downloads.data.map((item) => (
            <li key={item.id} className="group flex items-center gap-3 rounded-[14px] px-4 py-2.5 hover:bg-white/[0.06]">
              <FileText className={cn("size-5", item.exists ? "text-ink-3" : "text-ink-4")} />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[14px]", item.exists ? "text-ink" : "text-ink-4 line-through")}>{item.name}</span>
                <span className="text-[11.5px] text-ink-4">{bytes(item.size)} · {relative(item.savedAt)}</span>
              </span>
              {item.exists && (
                <>
                  <Button size="sm" variant="ghost" onClick={async () => { const result = await bridge.files.open(item.path); if (!result.ok) session.toast(result.message, "bad"); }}>Aç</Button>
                  <Button size="sm" variant="ghost" onClick={() => bridge.files.reveal(item.path)}>Klasörde göster</Button>
                </>
              )}
              <IconButton label="Listeden kaldır" size={30} onClick={async () => { await bridge.files.forget(item.id); invalidate("files:"); }}><X className="size-3.5" /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
