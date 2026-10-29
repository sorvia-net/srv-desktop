import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

export type ConfirmState = { title: string; body: ReactNode; action: string; danger?: boolean; icon?: ReactNode; onConfirm: () => void } | null;

export function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  return (
    <AnimatePresence>
      {state && (
        <motion.div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/40 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            role="alertdialog"
            aria-label={state.title}
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
            onMouseDown={(event) => event.stopPropagation()}
            className="glass-sheet w-[300px] overflow-hidden rounded-[22px] text-center"
          >
            <div className="px-5 pb-4 pt-5">
              {state.icon && <div className="mb-3 flex justify-center">{state.icon}</div>}
              <p className="text-[15px] font-semibold text-ink">{state.title}</p>
              <div className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{state.body}</div>
            </div>
            <div className="grid grid-cols-2 border-t border-white/10">
              <button onClick={onClose} className="h-11 border-r border-white/10 text-[14px] text-[#5ac8fa] hover:bg-white/[0.06]">
                Vazgeç
              </button>
              <button
                autoFocus
                onClick={() => {
                  state.onConfirm();
                  onClose();
                }}
                className={`h-11 text-[14px] font-semibold hover:bg-white/[0.06] ${state.danger ? "text-[#ff453a]" : "text-[#5ac8fa]"}`}
              >
                {state.action}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
