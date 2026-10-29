import { useId, type CSSProperties } from "react";

import type { DesktopUser } from "@shared/contracts";
import { LogoMark } from "@/design/logo";
import { cn } from "@/design/ui";

import { folderItems, type AppDef, type FolderDef, type HomeItem, type LinkDef } from "./registry";

const WEEKDAY = new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "Europe/Istanbul" });
const DAY = new Intl.DateTimeFormat("tr-TR", { day: "numeric", timeZone: "Europe/Istanbul" });
const PETALS = ["#ff9f0a", "#ffd60a", "#30d158", "#64d2ff", "#0a84ff", "#bf5af2", "#ff375f", "#ff6b3d"];

function radius(size: number) {
  return Math.round(size * 0.235);
}

function CalendarGlyph({ size }: { size: number }) {
  const now = new Date();
  return (
    <span className="flex h-full w-full flex-col items-center justify-center leading-none">
      <span className="font-semibold uppercase text-[#ff3b30]" style={{ fontSize: Math.max(6, size * 0.16) }}>
        {WEEKDAY.format(now).replace(".", "")}
      </span>
      <span className="font-light tracking-[-0.04em] text-[#1c1c1e]" style={{ fontSize: size * 0.47, marginTop: size * 0.02 }}>
        {DAY.format(now)}
      </span>
    </span>
  );
}

function FlowerGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size * 0.78} height={size * 0.78} aria-hidden>
      {PETALS.map((color, index) => (
        <ellipse key={color} cx="50" cy="28" rx="13" ry="22" fill={color} opacity="0.92" transform={`rotate(${index * 45} 50 50)`} style={{ mixBlendMode: "multiply" }} />
      ))}
    </svg>
  );
}

function FolderGlyph({ size }: { size: number }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" width={size * 0.72} height={size * 0.72} aria-hidden>
      <defs>
        <linearGradient id={`${id}-back`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5ac8fa" />
          <stop offset="1" stopColor="#0a84ff" />
        </linearGradient>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fdcff" />
          <stop offset="1" stopColor="#3aa0ff" />
        </linearGradient>
      </defs>
      <path d="M10 26a8 8 0 0 1 8-8h22l8 9h34a8 8 0 0 1 8 8v41a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8z" fill={`url(#${id}-back)`} />
      <path d="M10 38a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6v38a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8z" fill={`url(#${id}-front)`} />
    </svg>
  );
}

export function Tile({ item, size, className }: { item: AppDef | LinkDef; size: number; className?: string }) {
  const Icon = item.icon;
  const light = item.tile.startsWith("#f");
  const style: CSSProperties = { width: size, height: size, borderRadius: radius(size), background: item.tile };
  let glyph = <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.9} className={light ? "text-[#1c1c1e]" : "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"} />;
  if (item.id === "calendar") glyph = <CalendarGlyph size={size} />;
  else if (item.id === "gallery") glyph = <FlowerGlyph size={size} />;
  else if (item.id === "storage") glyph = <FolderGlyph size={size} />;
  else if (item.id === "link-site") glyph = <LogoMark size={size * 0.62} />;
  return (
    <span
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden shadow-[0_10px_24px_-10px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.35)]", className)}
      style={style}
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),transparent_45%)]" />
      {glyph}
      {item.kind === "link" && size >= 40 && <span className="absolute bottom-[6%] right-[6%] size-[14%] rounded-full bg-white/85 shadow-[0_0_0_1.5px_rgba(0,0,0,0.12)]" />}
    </span>
  );
}

export function FolderTile({ folder, size, user, installed }: { folder: FolderDef; size: number; user: DesktopUser; installed: Set<string> }) {
  const children = folderItems(folder, user, installed).slice(0, 9);
  const mini = Math.floor((size - size * 0.24) / 3) - 2;
  return (
    <span
      className="grid shrink-0 grid-cols-3 content-start gap-[3px] border border-white/25 bg-white/[0.18] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-xl"
      style={{ width: size, height: size, borderRadius: radius(size), padding: size * 0.12 }}
    >
      {children.map((child) => (
        <Tile key={child.id} item={child} size={mini} className="shadow-none" />
      ))}
    </span>
  );
}

export function ItemTile({ item, size, user, installed }: { item: HomeItem; size: number; user: DesktopUser; installed: Set<string> }) {
  return item.kind === "folder" ? <FolderTile folder={item} size={size} user={user} installed={installed} /> : <Tile item={item} size={size} />;
}

export function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={cn("absolute -right-1.5 -top-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[12px] font-semibold text-white shadow-[0_2px_6px_rgba(0,0,0,0.35)]", className)}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
