import { AlertTriangle, HelpCircle, Pencil } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { cn } from "@/design/ui";

type Request = {
  id: number;
  title: string;
  body?: ReactNode;
  action: string;
  cancel: string;
  danger: boolean;
  icon?: ReactNode;
  input?: { value: string; placeholder?: string };
  resolve: (value: string | boolean | null) => void;
};

let current: Request | null = null;
let counter = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function open(request: Omit<Request, "id">) {
  current?.resolve(current.input ? null : false);
  current = { ...request, id: ++counter };
  emit();
}

function close(value: string | boolean | null) {
  const request = current;
  current = null;
  emit();
  request?.resolve(value);
}

export function ask(options: { title: string; body?: ReactNode; action?: string; cancel?: string; danger?: boolean; icon?: ReactNode }): Promise<boolean> {
  return new Promise((resolve) =>
    open({ title: options.title, body: options.body, action: options.action ?? "Tamam", cancel: options.cancel ?? "Vazgeç", danger: options.danger ?? false, icon: options.icon, resolve: (value) => resolve(value === true) }),
  );
}

export function askText(options: { title: string; body?: ReactNode; value?: string; placeholder?: string; action?: string }): Promise<string | null> {
  return new Promise((resolve) =>
    open({ title: options.title, body: options.body, action: options.action ?? "Kaydet", cancel: "Vazgeç", danger: false, icon: <Pencil className="size-7" />, input: { value: options.value ?? "", placeholder: options.placeholder }, resolve: (value) => resolve(typeof value === "string" ? value : null) }),
  );
}

export function AskHost() {
  const request = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
  const [text, setText] = useState("");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) return;
    setText(request.input?.value ?? "");
    setTimeout(() => field.current?.select(), 60);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(request.input ? null : false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [request]);

  const confirm = () => {
    if (!request) return;
    if (request.input) {
      if (!text.trim()) return;
      close(text.trim());
    } else close(true);
  };

  return (
    <AnimatePresence>
      {request && (
        <motion.div key={request.id} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 backdrop-blur-[4px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => close(request.input ? null : false)}>
          <motion.div
            role="alertdialog"
            aria-label={request.title}
            initial={{ scale: 1.06, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 32 }}
            onMouseDown={(event) => event.stopPropagation()}
            className="glass-sheet w-[340px] rounded-[28px] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
          >
            <span className={cn("mb-4 flex size-14 items-center justify-center rounded-[16px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]", request.danger ? "bg-gradient-to-b from-[#ff6b5e] to-[#e0352b]" : "bg-gradient-to-b from-[#a1a1aa] to-[#52525b]")}>
              {request.icon ?? (request.danger ? <AlertTriangle className="size-7" /> : <HelpCircle className="size-7" />)}
            </span>
            <p className="text-[16px] font-bold leading-snug text-ink">{request.title}</p>
            {request.body && <div className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{request.body}</div>}
            {request.input && (
              <input
                ref={field}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && confirm()}
                placeholder={request.input.placeholder}
                className="mt-4 h-11 w-full rounded-[14px] bg-black/30 px-4 text-[14px] text-ink outline-none ring-1 ring-white/10 focus:ring-accent/70"
              />
            )}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button onClick={() => close(request.input ? null : false)} className="h-11 rounded-full bg-white/[0.12] text-[14px] font-medium text-ink hover:bg-white/[0.18]">
                {request.cancel}
              </button>
              <button autoFocus={!request.input} onClick={confirm} className={cn("h-11 rounded-full text-[14px] font-semibold text-white", request.danger ? "bg-[#ff453a] hover:bg-[#ff5a50]" : "bg-[#0a84ff] hover:bg-[#2a95ff]")}>
                {request.action}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
