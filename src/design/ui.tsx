import { motion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";

import { initials } from "@/data/format";

export function cn(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

type ButtonVariant = "accent" | "glass" | "ghost" | "danger";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" | "icon"; loading?: boolean }>(
  function Button({ variant = "glass", size = "md", loading = false, className, children, disabled, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "focus-ring no-drag inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition-[transform,background,opacity,box-shadow] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
          size === "sm" && "h-8 px-3.5 text-[12.5px] [&_svg]:size-3.5",
          size === "md" && "h-10 px-4.5 text-[13.5px] [&_svg]:size-4",
          size === "lg" && "h-12 px-6 text-[15px] [&_svg]:size-[18px]",
          size === "icon" && "size-10 [&_svg]:size-[18px]",
          variant === "accent" && "accent-fill hover:brightness-110",
          variant === "glass" && "glass-soft text-ink hover:bg-white/12",
          variant === "ghost" && "text-ink-2 hover:bg-white/8 hover:text-ink",
          variant === "danger" && "bg-bad/90 text-white hover:bg-bad",
          className,
        )}
        {...props}
      >
        {loading ? <Spinner /> : null}
        {children}
      </button>
    );
  },
);

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-4 animate-spin rounded-full border-2 border-white/25 border-t-white", className)} aria-hidden />;
}

export function IconButton({ label, children, active, className, size = 40, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; size?: number }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring no-drag relative inline-flex shrink-0 items-center justify-center rounded-full text-ink-2 transition-all duration-200 hover:text-ink active:scale-95",
        active ? "accent-fill text-white" : "hover:bg-white/10",
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      {children}
    </button>
  );
}

export function ActionCircle({ icon, label, onClick, badge }: { icon: ReactNode; label: string; onClick?: () => void; badge?: number }) {
  return (
    <button onClick={onClick} className="focus-ring no-drag group flex w-[68px] flex-col items-center gap-2 rounded-2xl outline-none">
      <span className="icon-ring relative flex size-[54px] items-center justify-center rounded-full text-ink transition-all duration-300 ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:bg-white/16 group-active:scale-95 [&_svg]:size-[21px]">
        {icon}
        {badge ? <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10.5px] font-semibold text-white ring-2 ring-[#2a2421]">{badge}</span> : null}
      </span>
      <span className="text-[12.5px] font-medium text-ink-2 transition-colors group-hover:text-ink">{label}</span>
    </button>
  );
}

export function Pill({ children, tone = "accent", className }: { children: ReactNode; tone?: "accent" | "soft" | "ok" | "warn" | "bad" | "info" | "outline"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold leading-none",
        tone === "accent" && "accent-fill",
        tone === "soft" && "bg-white/10 text-ink-2",
        tone === "ok" && "bg-ok/15 text-ok",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "bad" && "bg-bad/15 text-bad",
        tone === "info" && "bg-info/15 text-info",
        tone === "outline" && "border border-accent/60 text-accent-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

const AVATAR_TONES = ["from-[#ffb36b] to-[#e8641a]", "from-[#f8d49a] to-[#c98a3c]", "from-[#9fd3c7] to-[#3f8a7c]", "from-[#c7b8f5] to-[#7b62c9]", "from-[#f6a5b5] to-[#c4506b]"];

export function Avatar({ name, src, size = 40, ring = false, className }: { name: string; src?: string | null; size?: number; ring?: boolean; className?: string }) {
  const tone = AVATAR_TONES[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white", ring && "ring-2 ring-accent/70 ring-offset-2 ring-offset-transparent", className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="size-full object-cover" draggable={false} /> : <span className={cn("flex size-full items-center justify-center bg-gradient-to-br", tone)}>{initials(name)}</span>}
    </span>
  );
}

export function Progress({ value, className, tone = "accent" }: { value: number; className?: string; tone?: "accent" | "light" }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <span className={cn("block h-[7px] overflow-hidden rounded-full bg-black/45", className)}>
      <motion.span
        className={cn("block h-full rounded-full", tone === "accent" ? "bg-gradient-to-r from-[#ff8a2b] to-[#ff6a0d]" : "bg-white/80")}
        initial={{ width: 0 }}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </span>
  );
}

export function Ring({ value, size = 84, label }: { value: number; size?: number; label?: string }) {
  const id = useId();
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb06a" />
            <stop offset="1" stopColor="#ff6a0d" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-[9px] flex items-center justify-center rounded-full bg-[#f4efe9] text-[13px] font-semibold text-[#2a211b] shadow-[inset_0_-2px_6px_rgba(0,0,0,0.12)]">
        {label ?? `${Math.round(clamped * 100)}%`}
      </span>
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "md" }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (value: T) => void; size?: "sm" | "md" }) {
  const id = useId();
  return (
    <div className={cn("no-drag inline-flex rounded-full bg-black/30 p-1 ring-1 ring-white/8", size === "sm" ? "h-8" : "h-9")} role="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn("focus-ring relative rounded-full px-3.5 font-medium transition-colors", size === "sm" ? "text-[12px]" : "text-[13px]", active ? "text-ink" : "text-ink-3 hover:text-ink-2")}
          >
            {active && <motion.span layoutId={`${id}-thumb`} className="absolute inset-0 rounded-full bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_-6px_rgba(0,0,0,0.6)]" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
            <span className="relative flex items-center gap-1.5">
              {option.label}
              {option.count !== undefined && option.count > 0 ? <span className={cn("rounded-full px-1.5 text-[10.5px] leading-[16px]", active ? "bg-accent text-white" : "bg-white/10")}>{option.count}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("focus-ring no-drag relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300", checked ? "bg-accent" : "bg-white/18")}
    >
      <motion.span
        className="absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.35),0_1px_1px_rgba(0,0,0,0.16)]"
        animate={{ left: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 560, damping: 36 }}
      />
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("skeleton block", className)} />;
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="icon-ring mb-4 flex size-14 items-center justify-center rounded-full text-ink-2 [&_svg]:size-6">{icon}</span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-md border border-white/12 bg-white/8 px-1.5 font-sans text-[11px] font-medium text-ink-2">{children}</kbd>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-bad/25 bg-bad/10 px-4 py-3 text-[13px] text-[#ffd0d8]">
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" variant="glass" onClick={onRetry}>
          Tekrar dene
        </Button>
      )}
    </div>
  );
}

export const PRIORITY_LABEL: Record<string, string> = { LOW: "Düşük", NORMAL: "Normal", HIGH: "Yüksek", URGENT: "Acil" };
export const PRIORITY_TONE: Record<string, "soft" | "info" | "warn" | "bad"> = { LOW: "soft", NORMAL: "info", HIGH: "warn", URGENT: "bad" };
