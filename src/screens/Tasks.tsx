import { CalendarClock, GripVertical, ListChecks, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import type { Priority, Task, TaskStatus } from "@shared/contracts";
import { api, type TaskScope } from "@/data/api";
import { dueLabel, isPast, relative } from "@/data/format";
import { invalidate, setQueryData, useQuery } from "@/data/query";
import { Avatar, Button, cn, Empty, ErrorNote, Pill, PRIORITY_LABEL, PRIORITY_TONE, Segmented, Skeleton } from "@/design/ui";
import { AssigneePicker, canAssign } from "@/shell/AssigneePicker";
import { useNav, useOverlay, useSession } from "@/shell/context";

const COLUMNS: { status: TaskStatus; title: string; dot: string }[] = [
  { status: "todo", title: "Yapılacak", dot: "bg-ink-3" },
  { status: "doing", title: "Sürüyor", dot: "bg-accent" },
  { status: "review", title: "İncelemede", dot: "bg-info" },
  { status: "done", title: "Bitti", dot: "bg-ok" },
];

export function Tasks() {
  const nav = useNav();
  const overlay = useOverlay();
  const session = useSession();
  const [scope, setScope] = useState<TaskScope>("mine");
  const [view, setView] = useState<"board" | "list">("board");
  const [board, setBoard] = useState<string | null>(nav.route.params?.board ?? null);
  const [selected, setSelected] = useState<string | null>(nav.route.params?.id ?? null);
  const key = `tasks:${scope}`;
  const tasks = useQuery<Task[]>(key, () => api.tasks(scope), { refreshMs: 60_000 });
  const lead = ["MODERATOR", "ADMIN", "OWNER"].includes(session.user.role);

  useEffect(() => {
    if (nav.route.params?.board) setBoard(nav.route.params.board);
    if (nav.route.params?.id) setSelected(nav.route.params.id);
  }, [nav.route.params]);

  const all = tasks.data ?? [];
  const boards = useMemo(() => [...new Set(all.map((item) => item.board))].sort((a, b) => a.localeCompare(b, "tr")), [all]);
  const visible = board ? all.filter((item) => item.board === board) : all;
  const current = all.find((item) => item.id === selected) ?? null;

  const update = async (task: Task, patch: Partial<Task> & { assigneeId?: string }) => {
    setQueryData<Task[]>(key, (list) => (list ?? []).map((item) => (item.id === task.id ? { ...item, ...patch } : item)));
    const result = await api.updateTask(task.id, patch);
    if (!result.ok) {
      session.toast(result.message, "bad");
      invalidate("tasks");
      return;
    }
    setQueryData<Task[]>(key, (list) => (list ?? []).map((item) => (item.id === task.id ? result.data : item)));
    invalidate("home");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-ink">Görevler</h1>
          <p className="mt-1 text-[14px] text-ink-2">{tasks.data ? `${all.filter((item) => item.status !== "done").length} açık görev · ${boards.length} pano` : "Yükleniyor…"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented<TaskScope> value={scope} onChange={setScope} options={[{ value: "mine", label: "Bana atanan" }, { value: "created", label: "Oluşturduklarım" }, ...(lead ? [{ value: "all" as TaskScope, label: "Ekip" }] : [])]} />
          <Segmented<"board" | "list"> value={view} onChange={setView} options={[{ value: "board", label: "Pano" }, { value: "list", label: "Liste" }]} />
          <Button variant="accent" onClick={() => overlay.open("quickTask")}>
            <Plus /> Yeni görev
          </Button>
        </div>
      </header>

      {boards.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Chip active={!board} onClick={() => setBoard(null)}>Tüm panolar</Chip>
          {boards.map((item) => (
            <Chip key={item} active={board === item} onClick={() => setBoard(item)}>
              {item}
            </Chip>
          ))}
        </div>
      )}

      {tasks.error && !tasks.data ? <ErrorNote message={tasks.error} onRetry={tasks.refresh} /> : null}

      <div className="relative min-h-0 flex-1">
        {tasks.loading ? (
          <div className="grid h-full grid-cols-4 gap-4">{COLUMNS.map((column) => <Skeleton key={column.status} className="h-[320px] rounded-[22px]" />)}</div>
        ) : visible.length === 0 ? (
          <div className="glass-card rounded-[24px]">
            <Empty icon={<ListChecks />} title="Görev yok" body="Sana atanmış bir görev bulunmuyor. Yeni bir görev ekleyerek başlayabilirsin." action={<Button variant="accent" onClick={() => overlay.open("quickTask")}><Plus /> Görev ekle</Button>} />
          </div>
        ) : view === "board" ? (
          <BoardView tasks={visible} onOpen={setSelected} onMove={(task, status) => void update(task, { status })} />
        ) : (
          <ListView tasks={visible} onOpen={setSelected} onToggle={(task) => void update(task, { status: task.status === "done" ? "todo" : "done" })} />
        )}
        <AnimatePresence>{current && <Detail task={current} onClose={() => setSelected(null)} onUpdate={(patch) => void update(current, patch)} />}</AnimatePresence>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("focus-ring h-8 rounded-full px-3.5 text-[12.5px] font-medium transition-colors", active ? "accent-fill" : "bg-white/8 text-ink-2 hover:bg-white/12 hover:text-ink")}>
      {children}
    </button>
  );
}

function BoardView({ tasks, onOpen, onMove }: { tasks: Task[]; onOpen: (id: string) => void; onMove: (task: Task, status: TaskStatus) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  return (
    <div className="grid h-full min-h-0 grid-cols-4 gap-4">
      {COLUMNS.map((column) => {
        const items = tasks.filter((item) => item.status === column.status);
        return (
          <section
            key={column.status}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(column.status);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              const task = tasks.find((item) => item.id === event.dataTransfer.getData("text/task"));
              if (task && task.status !== column.status) onMove(task, column.status);
              setOver(null);
              setDragging(null);
            }}
            className={cn("glass-card flex min-h-0 flex-col rounded-[24px] p-3 transition-colors", over === column.status && "bg-white/[0.08] ring-1 ring-accent/50")}
          >
            <header className="flex items-center gap-2 px-2 pb-3 pt-1.5">
              <span className={cn("size-2 rounded-full", column.dot)} />
              <h2 className="text-[13.5px] font-semibold text-ink">{column.title}</h2>
              <span className="ml-auto rounded-full bg-white/8 px-2 text-[11.5px] leading-5 text-ink-3">{items.length}</span>
            </header>
            <div className="scroll-area -mr-1 min-h-0 flex-1 space-y-2.5 pr-1">
              <AnimatePresence initial={false}>
                {items.map((task) => (
                  <motion.div layout key={task.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: dragging === task.id ? 0.45 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
                  <button
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/task", task.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDragging(task.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => onOpen(task.id)}
                    className="focus-ring group block w-full rounded-[18px] border border-white/8 bg-white/[0.06] p-3.5 text-left outline-none transition-colors hover:bg-white/[0.1]"
                  >
                    <div className="flex items-start gap-2">
                      <p className={cn("min-w-0 flex-1 text-[13.5px] font-medium leading-snug", task.status === "done" ? "text-ink-3 line-through" : "text-ink")}>{task.title}</p>
                      <GripVertical className="size-4 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Pill tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Pill>
                      <span className="rounded-full bg-white/8 px-2 py-[3px] text-[11px] text-ink-2">{task.board}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11.5px]">
                      <span className={cn("flex items-center gap-1.5", task.dueAt && isPast(task.dueAt) && task.status !== "done" ? "text-bad" : "text-ink-3")}>
                        <CalendarClock className="size-3.5" />
                        {dueLabel(task.dueAt)}
                      </span>
                      {task.assignee && <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size={22} />}
                    </div>
                  </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {items.length === 0 && <p className="rounded-[16px] border border-dashed border-white/10 px-3 py-6 text-center text-[12px] text-ink-4">Buraya sürükle</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ListView({ tasks, onOpen, onToggle }: { tasks: Task[]; onOpen: (id: string) => void; onToggle: (task: Task) => void }) {
  const sorted = [...tasks].sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
  return (
    <div className="glass-card scroll-area h-full rounded-[24px] p-2">
      {sorted.map((task) => (
        <div key={task.id} className="group flex items-center gap-3 rounded-[16px] px-3 py-3 transition-colors hover:bg-white/[0.06]">
          <button onClick={() => onToggle(task)} aria-label={task.status === "done" ? "Geri al" : "Tamamla"} className={cn("focus-ring flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors", task.status === "done" ? "border-accent bg-accent text-white" : "border-white/30 hover:border-accent")}>
            {task.status === "done" && <svg viewBox="0 0 12 12" className="size-3"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
          <button onClick={() => onOpen(task.id)} className="min-w-0 flex-1 text-left">
            <span className={cn("block truncate text-[14px]", task.status === "done" ? "text-ink-3 line-through" : "text-ink")}>{task.title}</span>
            <span className="text-[12px] text-ink-3">{task.board} · güncellendi {relative(task.updatedAt)}</span>
          </button>
          <Pill tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Pill>
          <span className={cn("w-[96px] text-right text-[12px]", task.dueAt && isPast(task.dueAt) && task.status !== "done" ? "text-bad" : "text-ink-3")}>{dueLabel(task.dueAt)}</span>
        </div>
      ))}
    </div>
  );
}

function Detail({ task, onClose, onUpdate }: { task: Task; onClose: () => void; onUpdate: (patch: Partial<Task> & { assigneeId?: string }) => void }) {
  const session = useSession();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
  }, [task.id]);
  const dirty = title.trim() !== task.title || description !== (task.description ?? "");
  const localDue = task.dueAt ? new Date(new Date(task.dueAt).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";

  return (
    <motion.aside
      initial={{ x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      className="glass-float absolute inset-y-0 right-0 z-20 flex w-[420px] flex-col rounded-[26px] p-6"
    >
      <div className="flex items-start gap-3">
        <textarea value={title} onChange={(event) => setTitle(event.target.value)} rows={2} className="min-w-0 flex-1 resize-none bg-transparent text-[19px] font-semibold leading-snug text-ink outline-none" />
        <button onClick={onClose} aria-label="Kapat" className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-5 space-y-4">
        <Field label="Durum">
          <Segmented<TaskStatus> size="sm" value={task.status} onChange={(status) => onUpdate({ status })} options={COLUMNS.map((column) => ({ value: column.status, label: column.title }))} />
        </Field>
        <Field label="Öncelik">
          <Segmented<Priority> size="sm" value={task.priority} onChange={(priority) => onUpdate({ priority })} options={(["LOW", "NORMAL", "HIGH", "URGENT"] as Priority[]).map((value) => ({ value, label: PRIORITY_LABEL[value]! }))} />
        </Field>
        {canAssign(session.user.role) && (
          <Field label="Sorumlu">
            <AssigneePicker value={task.assignee?.id ?? null} onChange={(assigneeId) => assigneeId !== task.assignee?.id && onUpdate({ assigneeId })} />
          </Field>
        )}
        <Field label="Son tarih">
          <input type="datetime-local" defaultValue={localDue} onBlur={(event) => onUpdate({ dueAt: event.target.value ? new Date(event.target.value).toISOString() : null })} className="h-9 rounded-full bg-black/30 px-3.5 text-[13px] text-ink outline-none ring-1 ring-white/10 [color-scheme:dark] focus:ring-accent/70" />
        </Field>
        <Field label="Açıklama">
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={6} placeholder="Ayrıntı ekle…" className="w-full resize-none rounded-2xl bg-black/25 px-4 py-3 text-[13.5px] leading-relaxed text-ink outline-none ring-1 ring-white/10 placeholder:text-ink-4 focus:ring-accent/70" />
        </Field>
      </div>
      {dirty && (
        <Button variant="accent" className="mt-4 self-end" onClick={() => onUpdate({ title: title.trim(), description: description.trim() || null })}>
          Kaydet
        </Button>
      )}
      <div className="mt-auto space-y-1.5 border-t border-white/8 pt-4 text-[12px] text-ink-3">
        <p>Pano: <span className="text-ink-2">{task.board}</span></p>
        {task.creator && <p>Oluşturan: <span className="text-ink-2">{task.creator.name}</span> · {relative(task.createdAt)}</p>}
        {task.completedAt && <p>Tamamlandı: {relative(task.completedAt)}</p>}
      </div>
    </motion.aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-medium text-ink-3">{label}</p>
      {children}
    </div>
  );
}
