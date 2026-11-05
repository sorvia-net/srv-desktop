import { ArrowUp, Check, CircleStop, Globe, MessageSquarePlus, Search, Sparkles, Trash2, Wrench, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { AssistantAction, AssistantEvent, AssistantOverview } from "@shared/contracts";
import { adminApi } from "@/data/api";
import { bridge } from "@/data/bridge";
import { invalidate, useQuery } from "@/data/query";
import { Button, cn, ErrorNote, Spinner } from "@/design/ui";
import { ask } from "@/shell/ask";
import { useSession } from "@/shell/context";

type Tool = { id: string; label: string; status: string };
type Turn = { id: string; role: "user" | "assistant"; content: string; tools?: Tool[]; error?: string };

const SUGGESTIONS = [
  "Bu ayın finans özetini çıkar",
  "Önümüzdeki 30 günün ödemeleri ve beyanları",
  "Son 7 günün satışlarını ve destek yükünü özetle",
  "Giderlerde tasarruf edebileceğimiz kalemler neler?",
];

/** Siri benzeri küre: düşünürken nefes alır, yazarken hızlanır. */
function Orb({ state, size = 120 }: { state: "idle" | "thinking" | "speaking"; size?: number }) {
  const speed = state === "idle" ? 9 : state === "thinking" ? 3 : 1.6;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: "conic-gradient(from 0deg,#f0abfc,#8b5cf6,#2563eb,#22d3ee,#f472b6,#f0abfc)" }}
        animate={{ rotate: 360, scale: state === "idle" ? [0.85, 0.95, 0.85] : [0.9, 1.15, 0.9], opacity: state === "idle" ? 0.45 : 0.8 }}
        transition={{ rotate: { duration: speed * 2, repeat: Infinity, ease: "linear" }, scale: { duration: speed / 2, repeat: Infinity }, opacity: { duration: 0.6 } }}
      />
      <motion.div
        className="absolute inset-[14%] rounded-full"
        style={{ background: "conic-gradient(from 90deg,#22d3ee,#8b5cf6,#f0abfc,#2563eb,#22d3ee)", boxShadow: "inset 0 0 30px rgba(255,255,255,.35)" }}
        animate={{ rotate: -360, scale: state === "speaking" ? [1, 1.06, 0.97, 1] : 1 }}
        transition={{ rotate: { duration: speed * 1.5, repeat: Infinity, ease: "linear" }, scale: { duration: 0.8, repeat: Infinity } }}
      />
      <div className="absolute inset-[30%] rounded-full bg-white/25 blur-md" />
    </div>
  );
}

/* ── Küçük, güvenli Markdown: HTML üretmez, React öğeleri döndürür ─────────── */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const k = `${key}-${i++}`;
    if (token.startsWith("`")) out.push(<code key={k} className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[12.5px]">{token.slice(1, -1)}</code>);
    else if (token.startsWith("**")) out.push(<strong key={k} className="font-semibold text-ink">{token.slice(2, -2)}</strong>);
    else if (token.startsWith("[")) {
      const label = token.slice(1, token.indexOf("]"));
      const url = match[2]!;
      out.push(<a key={k} href={url} onClick={(event) => { event.preventDefault(); void bridge.system.openBrowser(url); }} className="text-[#a5b4fc] underline decoration-white/20 underline-offset-2 hover:decoration-[#a5b4fc]">{label}</a>);
    } else out.push(<em key={k}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const lines = text.replace(/```actions[\s\S]*?```/g, "").split("\n");
    const result: ReactNode[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;
    let code: string[] | null = null;
    let para: string[] = [];
    const flushPara = () => {
      if (para.length) result.push(<p key={`p${result.length}`} className="my-2">{inline(para.join(" "), `p${result.length}`)}</p>);
      para = [];
    };
    const flushList = () => {
      if (!list) return;
      const Tag = list.ordered ? "ol" : "ul";
      result.push(<Tag key={`l${result.length}`} className={cn("my-2 space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>{list.items.map((item, index) => <li key={index}>{inline(item, `l${result.length}-${index}`)}</li>)}</Tag>);
      list = null;
    };
    for (const line of lines) {
      if (code) {
        if (line.startsWith("```")) {
          result.push(<pre key={`c${result.length}`} className="my-2 overflow-x-auto rounded-xl bg-black/35 p-3 font-mono text-[12.5px] leading-relaxed">{code.join("\n")}</pre>);
          code = null;
        } else code.push(line);
        continue;
      }
      if (line.startsWith("```")) { flushPara(); flushList(); code = []; continue; }
      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
      const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (heading) { flushPara(); flushList(); result.push(<div key={`h${result.length}`} className="mb-1 mt-3 text-[15px] font-semibold text-ink">{inline(heading[2]!, `h${result.length}`)}</div>); }
      else if (bullet || numbered) {
        flushPara();
        const ordered = Boolean(numbered);
        if (list && list.ordered !== ordered) flushList();
        list ??= { ordered, items: [] };
        list.items.push((bullet ?? numbered)![1]!);
      } else if (!line.trim()) { flushPara(); flushList(); }
      else { flushList(); para.push(line); }
    }
    if (code) result.push(<pre key="c-end" className="my-2 overflow-x-auto rounded-xl bg-black/35 p-3 font-mono text-[12.5px]">{code.join("\n")}</pre>);
    flushPara();
    flushList();
    return result;
  }, [text]);
  return <div className="text-[14px] leading-relaxed text-ink-2 [&>*:first-child]:mt-0">{blocks}</div>;
}

/* ── Ekran ──────────────────────────────────────────────────────────────── */

export function Assistant() {
  const session = useSession();
  const overview = useQuery<AssistantOverview>("assistant:overview", () => adminApi.assistant(), { refreshMs: 60_000 });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<null | "thinking" | "speaking">(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [filter, setFilter] = useState("");
  const streamId = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const firstName = (session.user.name ?? session.user.username ?? "").split(" ")[0];

  useEffect(() => {
    return bridge.api.onStream(({ id, event }) => {
      if (id !== streamId.current) return;
      apply(event);
    });
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    field.current?.focus();
  }, [conversationId]);

  function patchLast(update: (turn: Turn) => Turn) {
    setTurns((list) => list.map((turn, index) => (index === list.length - 1 && turn.role === "assistant" ? update(turn) : turn)));
  }

  function apply(event: AssistantEvent) {
    if (event.type === "meta") setConversationId(event.conversationId);
    else if (event.type === "delta") { setBusy("speaking"); patchLast((turn) => ({ ...turn, content: turn.content + event.text })); }
    else if (event.type === "replace") patchLast((turn) => ({ ...turn, content: event.text }));
    else if (event.type === "tool") {
      const tool: Tool = { id: String(event.id ?? event.name ?? Math.random()), label: String(event.label ?? event.name ?? "Araç"), status: String(event.status ?? "start") };
      patchLast((turn) => {
        const tools = turn.tools ?? [];
        const index = tools.findIndex((item) => item.id === tool.id);
        return { ...turn, tools: index >= 0 ? tools.map((item, i) => (i === index ? tool : item)) : [...tools, tool] };
      });
    } else if (event.type === "error") patchLast((turn) => ({ ...turn, error: event.message }));
  }

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    const id = `as${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    streamId.current = id;
    setTurns((list) => [...list, { id: `u-${id}`, role: "user", content: message }, { id: `a-${id}`, role: "assistant", content: "" }]);
    setBusy("thinking");
    const result = await bridge.api.stream(id, "/api/desktop/assistant", { conversationId, message });
    if (!result.ok) patchLast((turn) => ({ ...turn, error: result.message }));
    setBusy(null);
    streamId.current = null;
    invalidate("assistant:overview");
  }

  function stop() {
    if (streamId.current) void bridge.api.abort(streamId.current);
  }

  async function openThread(id: string) {
    if (busy) return;
    setLoadingThread(true);
    const result = await adminApi.assistantThread(id);
    setLoadingThread(false);
    if (!result.ok) return session.toast(result.message, "bad");
    setConversationId(result.data.id);
    setTurns(result.data.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
  }

  function newChat() {
    if (busy) return;
    setConversationId(null);
    setTurns([]);
    setInput("");
  }

  async function remove(id: string, title: string) {
    if (!(await ask({ title: "Sohbet silinsin mi?", body: `“${title}” arşive taşınır.`, action: "Sil", danger: true, icon: <Trash2 className="size-5" /> }))) return;
    const result = await adminApi.archiveAssistant(id);
    if (!result.ok) return session.toast(result.message, "bad");
    if (id === conversationId) newChat();
    invalidate("assistant:overview");
  }

  const conversations = (overview.data?.conversations ?? []).filter((c) => c.title.toLowerCase().includes(filter.toLowerCase()));
  const pending = overview.data?.pending ?? [];
  const orbState = busy ?? "idle";

  return (
    <div className="flex h-full gap-5">
      <aside className="flex w-[260px] shrink-0 flex-col">
        <Button onClick={newChat} disabled={Boolean(busy)} className="mb-3 w-full justify-start">
          <MessageSquarePlus className="size-4" /> Yeni sohbet
        </Button>
        <label className="mb-2 flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-[13px] text-ink-3">
          <Search className="size-4" />
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Sohbetlerde ara" className="w-full bg-transparent text-ink outline-none placeholder:text-ink-4" />
        </label>
        <div className="scroll-area -mr-2 flex-1 space-y-0.5 pr-2">
          {overview.error && <ErrorNote message={overview.error} onRetry={overview.refresh} />}
          {conversations.map((c) => (
            <div key={c.id} className={cn("group flex items-center rounded-xl", c.id === conversationId ? "bg-white/[0.1]" : "hover:bg-white/[0.05]")}>
              <button type="button" onClick={() => void openThread(c.id)} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-[13px] text-ink-2">
                {c.title}
              </button>
              <button type="button" aria-label="Sil" onClick={() => void remove(c.id, c.title)} className="mr-1 hidden rounded-lg p-1.5 text-ink-4 hover:bg-white/10 hover:text-bad group-hover:block">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {overview.data && conversations.length === 0 && <p className="px-3 py-2 text-[12.5px] text-ink-4">Sohbet yok.</p>}
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col">
        {pending.length > 0 && <PendingBar actions={pending} />}

        <div ref={scroller} className="scroll-area fade-bottom -mr-3 flex-1 pr-3">
          {loadingThread ? (
            <div className="flex h-full items-center justify-center"><Spinner /></div>
          ) : turns.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Orb state={orbState} size={140} />
              <h1 className="mt-6 text-[30px] font-bold tracking-[-0.03em] text-ink">{firstName ? `Merhaba ${firstName}, ` : ""}nasıl yardımcı olayım?</h1>
              <p className="mt-2 max-w-md text-[14px] text-ink-3">Defteri, ödemeleri, vergi takvimini, site metriklerini ve bilgi bankasını biliyorum. Webde arayabilir, işlem önerebilirim; sen onaylamadan hiçbir şey uygulanmaz.</p>
              <div className="mt-7 grid w-full max-w-2xl grid-cols-2 gap-2.5">
                {SUGGESTIONS.map((text) => (
                  <button key={text} type="button" onClick={() => void sendMessage(text)} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-[13.5px] text-ink-2 transition hover:border-white/20 hover:bg-white/[0.09] hover:text-ink">
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5 pb-6 pt-2">
              {turns.map((turn, index) => (
                <Fragment key={turn.id}>
                  {turn.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-gradient-to-br from-[#8b5cf6] to-[#2563eb] px-4 py-2.5 text-[14px] text-white shadow-lg">{turn.content}</div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0"><Orb state={index === turns.length - 1 && busy ? busy : "idle"} size={30} /></div>
                      <div className="min-w-0 flex-1">
                        {turn.tools && turn.tools.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {turn.tools.map((tool) => (
                              <span key={tool.id} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]", tool.status === "error" ? "border-bad/30 text-bad" : "border-white/10 text-ink-3")}>
                                {tool.status === "start" ? <Spinner className="size-3" /> : /web|ara|search|fetch/i.test(tool.label) ? <Globe className="size-3" /> : <Wrench className="size-3" />}
                                {tool.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {turn.content ? <Markdown text={turn.content} /> : !turn.error && <span className="text-[13px] text-ink-4">Düşünüyor…</span>}
                        {turn.error && <p className="mt-2 rounded-xl bg-bad/10 px-3 py-2 text-[13px] text-bad">{turn.error}</p>}
                      </div>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(event) => { event.preventDefault(); void sendMessage(input); }}
          className="mx-auto mt-3 flex w-full max-w-3xl items-end gap-2 rounded-[24px] border border-white/12 bg-white/[0.07] p-2 pl-4 shadow-[0_10px_40px_-10px_rgba(139,92,246,.45)] focus-within:border-[#8b5cf6]/60"
        >
          <Sparkles className="mb-2.5 size-4 shrink-0 text-[#c4b5fd]" />
          <textarea
            ref={field}
            value={input}
            rows={1}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(input); }
            }}
            placeholder="Asistana sor…  (Enter gönderir, Shift+Enter yeni satır)"
            className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[14px] text-ink outline-none placeholder:text-ink-4 [field-sizing:content]"
          />
          {busy ? (
            <button type="button" onClick={stop} aria-label="Durdur" className="flex size-9 items-center justify-center rounded-full bg-white/15 text-ink hover:bg-white/25"><CircleStop className="size-4" /></button>
          ) : (
            <button type="submit" disabled={!input.trim()} aria-label="Gönder" className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#2563eb] text-white disabled:opacity-40"><ArrowUp className="size-4" /></button>
          )}
        </form>
      </section>
    </div>
  );
}

function PendingBar({ actions }: { actions: AssistantAction[] }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  async function decide(id: string, decision: "approve" | "reject") {
    setWorking(id);
    const result = await adminApi.decideAction(id, decision);
    setWorking(null);
    session.toast(result.ok ? result.data.message : result.message, result.ok ? "ok" : "bad");
    invalidate("assistant:overview");
  }

  return (
    <div className="mx-auto mb-3 w-full max-w-3xl">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2 rounded-2xl border border-warn/25 bg-warn/10 px-4 py-2.5 text-left text-[13px] text-warn">
        <Sparkles className="size-4" /> Onayını bekleyen {actions.length} işlem var
        <span className="ml-auto text-[12px] text-ink-3">{open ? "Gizle" : "Göster"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-2 space-y-2">
              {actions.map((action) => (
                <div key={action.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-ink-4">{action.label}</div>
                    <div className="text-[13.5px] text-ink">{action.summary}</div>
                  </div>
                  <Button size="sm" variant="ghost" disabled={working === action.id} onClick={() => void decide(action.id, "reject")}><X className="size-4" /> Reddet</Button>
                  <Button size="sm" variant="accent" loading={working === action.id} onClick={() => void decide(action.id, "approve")}><Check className="size-4" /> Onayla</Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
