import { Ban, CheckCircle2, KeyRound, Mail, Search, ShieldCheck, Users as UsersIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import type { AdminUserDetail, AdminUserPage } from "@shared/contracts";
import { adminApi } from "@/data/api";
import { relative } from "@/data/format";
import { invalidate, useQuery } from "@/data/query";
import { Avatar, Button, cn, Empty, ErrorNote, IconButton, Pill, Segmented, Skeleton } from "@/design/ui";
import { useSession } from "@/shell/context";

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "soft" }> = {
  ACTIVE: { label: "Aktif", tone: "ok" },
  PENDING: { label: "Onay bekliyor", tone: "warn" },
  SUSPENDED: { label: "Askıda", tone: "warn" },
  BANNED: { label: "Yasaklı", tone: "bad" },
  DELETED: { label: "Silinmiş", tone: "soft" },
};

const FILTERS = [
  { value: "", label: "Herkes" },
  { value: "staff", label: "Ekip" },
  { value: "CUSTOMER", label: "Müşteriler" },
];

export function Users() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  const page = useQuery<AdminUserPage>(`users:list:${role}:${search}`, () => adminApi.users({ q: search || undefined, role: role || undefined }));

  return (
    <div className="flex h-full min-h-0 gap-6">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Kullanıcılar</h1>
            <p className="mt-1 text-[14px] text-ink-2">{page.data ? `${page.data.total} hesap` : "Yükleniyor…"}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Segmented value={role} onChange={setRole} options={FILTERS} />
            <label className="flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4">
              <Search className="size-4 text-ink-3" />
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Ad, e-posta, kimlik" className="w-56 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4" />
            </label>
          </div>
        </header>
        {page.error && <ErrorNote message={page.error} onRetry={page.refresh} />}
        <div className="scroll-area fade-bottom -mr-3 min-h-0 flex-1 pr-3">
          {page.loading && !page.data ? (
            <div className="space-y-2">{Array.from({ length: 10 }, (_, index) => <Skeleton key={index} className="h-14 rounded-[16px]" />)}</div>
          ) : !page.data?.items.length ? (
            <Empty icon={<UsersIcon className="size-6" />} title="Kullanıcı bulunamadı" />
          ) : (
            <ul className="space-y-1 pb-6">
              {page.data.items.map((user) => (
                <li key={user.id}>
                  <button onClick={() => setSelected(user.id)} className={cn("focus-ring flex w-full items-center gap-3.5 rounded-[16px] px-3.5 py-2.5 text-left transition", selected === user.id ? "bg-white/[0.12]" : "hover:bg-white/[0.06]")}>
                    <Avatar name={user.name} src={user.avatarUrl} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{user.name}</span>
                      <span className="block truncate text-[12.5px] text-ink-3">{user.email}</span>
                    </span>
                    {user.role !== "CUSTOMER" && <Pill tone="info">{user.roleLabel}</Pill>}
                    {user.status !== "ACTIVE" && <Pill tone={STATUS[user.status]?.tone ?? "soft"}>{STATUS[user.status]?.label ?? user.status}</Pill>}
                    <span className="w-24 text-right text-[12px] text-ink-4">{user.lastLoginAt ? relative(user.lastLoginAt) : "giriş yok"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <AnimatePresence>{selected && <UserPanel key={selected} id={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
    </div>
  );
}

function UserPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const session = useSession();
  const user = useQuery<AdminUserDetail>(`users:detail:${id}`, () => adminApi.user(id));
  const [busy, setBusy] = useState(false);
  const data = user.data;

  const update = async (patch: { role?: string; status?: string }, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    const result = await adminApi.updateUser(id, patch);
    setBusy(false);
    if (!result.ok) return session.toast(result.message, "bad");
    session.toast("Kullanıcı güncellendi", "ok");
    invalidate("users:");
  };

  return (
    <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} className="scroll-area flex w-[380px] shrink-0 flex-col rounded-[26px] bg-white/[0.06] p-5">
      <div className="flex justify-end">
        <IconButton label="Kapat" size={32} onClick={onClose}><X className="size-4" /></IconButton>
      </div>
      {!data ? (
        user.error ? <ErrorNote message={user.error} onRetry={user.refresh} /> : <Skeleton className="h-60 rounded-[20px]" />
      ) : (
        <>
          <div className="flex flex-col items-center text-center">
            <Avatar name={data.name} src={data.avatarUrl} size={76} />
            <p className="mt-3 text-[18px] font-semibold text-ink">{data.name}</p>
            <p className="text-[13px] text-ink-3">{data.email}</p>
            <div className="mt-2 flex gap-1.5">
              <Pill tone="info">{data.roleLabel}</Pill>
              <Pill tone={STATUS[data.status]?.tone ?? "soft"}>{STATUS[data.status]?.label ?? data.status}</Pill>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-2 text-[12.5px]">
            <Fact label="Kayıt" value={relative(data.createdAt)} />
            <Fact label="Son giriş" value={data.lastLoginAt ? relative(data.lastLoginAt) : "—"} />
            <Fact label="Sipariş" value={String(data.counts.orders)} />
            <Fact label="Lisans" value={String(data.counts.licenses)} />
            <Fact label="Destek talebi" value={String(data.counts.ticketsRequested)} />
            <Fact label="Cüzdan" value={`$${data.walletBalance.toFixed(2)}`} />
          </dl>
          <div className="mt-4 space-y-1.5 text-[12.5px] text-ink-2">
            <p className="flex items-center gap-2"><Mail className="size-3.5 text-ink-3" /> {data.emailVerified ? "E-posta doğrulandı" : "E-posta doğrulanmadı"}</p>
            <p className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-ink-3" /> {data.twoFactorEnabled ? "İki adımlı doğrulama açık" : "İki adımlı doğrulama kapalı"}</p>
            {data.lastLoginIp && <p className="flex items-center gap-2"><KeyRound className="size-3.5 text-ink-3" /> Son IP {data.lastLoginIp}</p>}
          </div>

          {data.canRoles && (
            <div className="mt-5">
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">Rol</p>
              <select
                value={data.role}
                disabled={busy}
                onChange={(event) => void update({ role: event.target.value }, `${data.name} kullanıcısının rolü değişsin mi?`)}
                className="h-10 w-full rounded-[12px] bg-black/30 px-3 text-[13.5px] text-ink outline-none ring-1 ring-white/10"
              >
                {data.roles.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
          )}
          {data.canEdit && (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.status !== "ACTIVE" && (
                <Button size="sm" disabled={busy} onClick={() => void update({ status: "ACTIVE" })}><CheckCircle2 className="size-4" /> Etkinleştir</Button>
              )}
              {data.status !== "SUSPENDED" && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void update({ status: "SUSPENDED" }, "Hesap askıya alınsın mı? Açık oturumları kapatılır.")}>Askıya al</Button>
              )}
              {data.status !== "BANNED" && (
                <Button size="sm" variant="ghost" className="text-bad" disabled={busy} onClick={() => void update({ status: "BANNED" }, "Hesap yasaklansın mı? Açık oturumları kapatılır.")}><Ban className="size-4" /> Yasakla</Button>
              )}
            </div>
          )}

          {data.orders.length > 0 && (
            <div className="mt-6">
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">Son siparişler</p>
              <ul className="space-y-1">
                {data.orders.map((order) => (
                  <li key={order.id} className="flex items-center justify-between rounded-[12px] bg-white/[0.04] px-3 py-2 text-[12.5px]">
                    <span className="text-ink">{order.number}</span>
                    <span className="text-ink-3">{order.total.toFixed(2)} {order.currency}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.licenses.length > 0 && (
            <div className="mt-5">
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">Lisanslar</p>
              <ul className="space-y-1">
                {data.licenses.map((license) => (
                  <li key={license.id} className="flex items-center justify-between rounded-[12px] bg-white/[0.04] px-3 py-2 text-[12.5px]">
                    <span className="text-ink">{license.product}</span>
                    <span className="font-mono text-ink-3">{license.key}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </motion.aside>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-white/[0.04] px-3 py-2">
      <dt className="text-[11px] text-ink-4">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
