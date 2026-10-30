import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { motion } from "motion/react";

import { mediaControl, useNowPlaying } from "@/data/feed";
import { cn } from "@/design/ui";

import { Tile } from "./icons";
import { itemById } from "./registry";
import { useOs } from "./state";

export function NowPlayingCard({ className, compact = false }: { className?: string; compact?: boolean }) {
  const playing = useNowPlaying();
  const os = useOs();
  if (!playing) return null;
  const source = itemById(playing.app);
  const control = (action: "play" | "pause" | "previoustrack" | "nexttrack") => (event: React.MouseEvent) => {
    event.stopPropagation();
    mediaControl(action);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => !os.locked && os.openApp(playing.app as never)}
      className={cn("flex cursor-default items-center gap-3 rounded-[24px] bg-white/[0.18] p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/20 backdrop-blur-2xl", className)}
    >
      {playing.artwork ? (
        <img src={playing.artwork} alt="" className={cn("shrink-0 rounded-[14px] object-cover", compact ? "size-12" : "size-16")} draggable={false} />
      ) : source && source.kind !== "folder" ? (
        <Tile item={source} size={compact ? 48 : 64} className="shadow-none" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">
          {source && source.kind !== "folder" && <Tile item={source} size={14} className="shadow-none" />}
          {playing.playing ? "Şimdi çalıyor" : "Duraklatıldı"}
        </p>
        <p className="truncate text-[14px] font-semibold text-white">{playing.title}</p>
        {playing.artist && <p className="truncate text-[12.5px] text-white/75">{playing.artist}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1 text-white">
        <button onClick={control("previoustrack")} aria-label="Önceki" className="flex size-9 items-center justify-center rounded-full hover:bg-white/15"><SkipBack className="size-4 fill-current" /></button>
        <button onClick={control(playing.playing ? "pause" : "play")} aria-label={playing.playing ? "Duraklat" : "Çal"} className="flex size-10 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
          {playing.playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
        </button>
        <button onClick={control("nexttrack")} aria-label="Sonraki" className="flex size-9 items-center justify-center rounded-full hover:bg-white/15"><SkipForward className="size-4 fill-current" /></button>
      </div>
    </motion.div>
  );
}
