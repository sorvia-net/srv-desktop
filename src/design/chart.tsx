import { motion } from "motion/react";
import { useId, useMemo, useState } from "react";

export type Series = { name: string; color: string; values: number[]; dashedFrom?: number };

function smoothPath(points: [number, number][]) {
  if (points.length < 2) return "";
  let path = `M${points[0]![0]},${points[0]![1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return path;
}

export function LineChart({ series, labels, height = 190, format = (value: number) => value.toLocaleString("tr-TR") }: { series: Series[]; labels: string[]; height?: number; format?: (value: number) => string }) {
  const id = useId();
  const width = 640;
  const pad = { top: 34, bottom: 30, left: 12, right: 12 };
  const max = Math.max(1, ...series.flatMap((item) => item.values)) * 1.12;
  const min = Math.min(0, ...series.flatMap((item) => item.values));
  const count = Math.max(...series.map((item) => item.values.length), labels.length);
  const x = (index: number) => pad.left + (index * (width - pad.left - pad.right)) / Math.max(1, count - 1);
  const y = (value: number) => pad.top + (1 - (value - min) / (max - min || 1)) * (height - pad.top - pad.bottom);
  const [hover, setHover] = useState<number | null>(null);
  const focus = hover ?? Math.max(0, count - 1);

  const paths = useMemo(
    () =>
      series.map((item) => {
        const points = item.values.map((value, index) => [x(index), y(value)] as [number, number]);
        if (item.dashedFrom === undefined) return { solid: smoothPath(points), dashed: "" };
        return { solid: smoothPath(points.slice(0, item.dashedFrom + 1)), dashed: smoothPath(points.slice(item.dashedFrom)) };
      }),
    [series, height],
  );

  const lead = series[0];
  return (
    <div className="relative w-full select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {lead && paths[0]?.solid && (
          <motion.path
            d={`${paths[0].solid} L${x(lead.dashedFrom ?? lead.values.length - 1)},${height - pad.bottom} L${x(0)},${height - pad.bottom} Z`}
            fill={`url(#${id}-fade)`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.3 }}
          />
        )}
        {series.map((item, index) => (
          <g key={item.name}>
            <motion.path d={paths[index]!.solid} fill="none" stroke={item.color} strokeWidth={2.6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: index * 0.12 }} />
            {paths[index]!.dashed && <motion.path d={paths[index]!.dashed} fill="none" stroke={item.color} strokeWidth={2.4} strokeDasharray="5 7" strokeLinecap="round" initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} transition={{ duration: 0.6, delay: 1 }} />}
          </g>
        ))}
        {lead && lead.values[focus] !== undefined && (
          <g>
            <line x1={x(focus)} x2={x(focus)} y1={y(lead.values[focus]!) + 8} y2={height - pad.bottom} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
            <circle cx={x(focus)} cy={y(lead.values[focus]!)} r={6} fill="#1f1a17" stroke="#fff" strokeWidth={2.4} />
          </g>
        )}
        {Array.from({ length: count }, (_, index) => (
          <rect key={index} x={x(index) - (width / count) / 2} y={0} width={width / count} height={height} fill="transparent" onMouseEnter={() => setHover(index)} />
        ))}
      </svg>
      {lead && lead.values[focus] !== undefined && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-white/14 bg-[#2a2420]/92 px-2.5 py-1 text-[11.5px] font-semibold text-ink shadow-[0_8px_20px_-8px_rgba(0,0,0,0.7)] backdrop-blur"
          style={{ left: `${(x(focus) / width) * 100}%`, top: `${((y(lead.values[focus]!) - 12) / height) * 100}%` }}
        >
          {format(lead.values[focus]!)}
        </div>
      )}
      <div className="mt-1 flex justify-between px-1 text-[12px] font-medium text-ink-2">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
