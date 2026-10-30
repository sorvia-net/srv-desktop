import { Activity, AlertTriangle, CheckCircle2, CircleSlash, XCircle } from "lucide-react";

import type { StatusBoard } from "@shared/contracts";
import { adminApi } from "@/data/api";
import { relative } from "@/data/format";
import { useQuery } from "@/data/query";
import { cn, Empty, ErrorNote, Skeleton } from "@/design/ui";

const TONE: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  HEALTHY: { label: "Çalışıyor", color: "#4ade80", icon: CheckCircle2 },
  WARNING: { label: "Yavaş", color: "#fbbf24", icon: AlertTriangle },
  DEGRADED: { label: "Sorunlu", color: "#fb923c", icon: AlertTriangle },
  DOWN: { label: "Erişilemiyor", color: "#fb7185", icon: XCircle },
  UNKNOWN: { label: "Ölçülmedi", color: "#968c84", icon: CircleSlash },
};

const OVERALL: Record<string, string> = { HEALTHY: "Bütün sistemler çalışıyor", DEGRADED: "Bazı servislerde sorun var", DOWN: "Kesinti var", UNKNOWN: "Durum ölçülemiyor" };

function dayColor(day: { total: number; up: number; slow: number }) {
  if (!day.total) return "rgba(255,255,255,0.08)";
  const ratio = day.up / day.total;
  if (ratio < 0.9) return "#fb7185";
  if (ratio < 0.995 || day.slow > day.total * 0.05) return "#fbbf24";
  return "#4ade80";
}

export function Status() {
  const board = useQuery<StatusBoard>("status:board", () => adminApi.status(), { refreshMs: 30_000 });
  const data = board.data;
  const overall = TONE[data?.overall.status ?? "UNKNOWN"] ?? TONE.UNKNOWN!;
  return (
    <div className="scroll-area fade-bottom -mr-3 h-full pr-3">
      <header className="mb-5">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Durum</h1>
        <p className="mt-1 text-[14px] text-ink-2">{data ? `Son ölçüm ${relative(data.generatedAt)}${data.stale ? " · veri eski olabilir" : ""}` : "Yükleniyor…"}</p>
      </header>
      {board.error && <ErrorNote message={board.error} onRetry={board.refresh} />}
      {!data ? (
        board.loading ? <Skeleton className="h-40 rounded-[24px]" /> : <Empty icon={<Activity className="size-6" />} title="Durum alınamadı" />
      ) : (
        <>
          <section className="flex items-center gap-4 rounded-[24px] p-5" style={{ background: `color-mix(in oklab, ${overall.color} 16%, transparent)` }}>
            <overall.icon className="size-8" style={{ color: overall.color }} />
            <div>
              <p className="text-[18px] font-semibold text-ink">{OVERALL[data.overall.status] ?? data.overall.status}</p>
              <p className="text-[13px] text-ink-2">{data.overall.total} servis izleniyor{data.overall.degraded ? ` · ${data.overall.degraded} serviste sorun` : ""}</p>
            </div>
          </section>

          {data.incidents.filter((item) => !item.resolvedAt).length > 0 && (
            <section className="mt-5 space-y-2">
              {data.incidents
                .filter((item) => !item.resolvedAt)
                .map((incident) => (
                  <div key={incident.id} className="rounded-[18px] bg-warn/10 px-4 py-3">
                    <p className="text-[14px] font-medium text-ink">{incident.title}</p>
                    <p className="text-[12.5px] text-ink-3">{incident.serviceName ?? "Genel"} · {relative(incident.startedAt)} başladı · {incident.status}</p>
                  </div>
                ))}
            </section>
          )}

          <section className="mt-5 space-y-2 pb-8">
            {data.services.map((service) => {
              const tone = TONE[service.status] ?? TONE.UNKNOWN!;
              return (
                <div key={service.id} className="rounded-[20px] bg-white/[0.05] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="size-2.5 rounded-full" style={{ background: tone.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium text-ink">{service.name}</span>
                      {service.group && <span className="text-[12px] text-ink-4">{service.group}</span>}
                    </span>
                    <span className="text-[12.5px]" style={{ color: tone.color }}>{tone.label}</span>
                    <span className="w-20 text-right text-[12.5px] tabular-nums text-ink-3">{service.latencyMs !== null ? `${service.latencyMs} ms` : "—"}</span>
                    <span className="w-20 text-right text-[12.5px] tabular-nums text-ink-2">{service.uptime.window !== null ? `%${service.uptime.window.toFixed(2)}` : "—"}</span>
                  </div>
                  <div className="mt-3 flex gap-[3px]">
                    {service.days.map((day) => (
                      <span key={day.date} title={`${day.date}: ${day.total ? `%${((day.up / day.total) * 100).toFixed(1)}` : "ölçüm yok"}`} className={cn("h-7 flex-1 rounded-[3px]")} style={{ background: dayColor(day) }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
