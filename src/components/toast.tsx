"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type Toast = { id: number; kind: "success" | "error"; text: string };
const Ctx = createContext<{ push: (kind: Toast["kind"], text: string) => void }>({ push: () => {} });

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div aria-live="polite" role="status" className="no-print fixed bottom-4 right-4 left-4 sm:left-auto z-[200] flex flex-col gap-2 sm:w-[360px]">
        {items.map((t) => (
          <div key={t.id} className="pop card flex items-start gap-3 p-3 shadow-lg" style={{ borderColor: t.kind === "error" ? "var(--danger)" : "var(--success)" }}>
            {t.kind === "error" ? <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--danger-ink)" }} /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: "var(--success-ink)" }} />}
            <p className="flex-1 text-[13.5px]">{t.text}</p>
            <button className="btn-ghost btn btn-icon btn-sm" aria-label="Dismiss" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
