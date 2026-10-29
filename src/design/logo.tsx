import { useId } from "react";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffc58a" />
          <stop offset="1" stopColor="#ff6a0d" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="rgba(20,16,14,0.72)" stroke={`url(#${id}-g)`} strokeWidth="1.3" />
      <path
        d="M21.6 11.2c-1.15-1.5-3-2.45-5.2-2.45-3.1 0-5.3 1.6-5.3 3.95 0 2.1 1.45 3.35 4.5 4.05l1.7.4c1.75.4 2.45.95 2.45 1.95 0 1.2-1.2 2-3 2-1.95 0-3.35-.85-4.2-2.3l-2.35 1.5c1.2 2.05 3.5 3.3 6.5 3.3 3.45 0 5.85-1.75 5.85-4.35 0-2.2-1.45-3.5-4.6-4.2l-1.7-.38c-1.65-.37-2.35-.9-2.35-1.85 0-1.1 1.05-1.8 2.7-1.8 1.6 0 2.85.65 3.6 1.85l2.4-1.67Z"
        fill={`url(#${id}-g)`}
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={28} />
      <span className="text-[14px] font-semibold tracking-[0.16em] text-ink">
        SORVIA<span className="text-accent">.</span>
      </span>
    </span>
  );
}
