"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { api, errMsg } from "@/components/api-client";
import { useToast } from "@/components/toast";
import { formatMoney } from "@/lib/money";

export function DemoButton({ remove = false, className = "btn" }: { remove?: boolean; className?: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        if (remove && !confirm("Remove all demo clients, invoices and payments?")) return;
        setBusy(true);
        try {
          await api("/api/v1/workspace/demo", { method: remove ? "DELETE" : "POST" });
          toast.push("success", remove ? "Demo data removed." : "Demo data loaded. It is labelled “[Demo]” and can be removed any time.");
          router.refresh();
        } catch (e) {
          toast.push("error", errMsg(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Sparkles size={15} /> {busy ? "Working…" : remove ? "Remove demo data" : "Load demo data"}
    </button>
  );
}

export interface MonthPoint { month: string; currency: string; amount: string }

/** Plain SVG bar chart. One series per currency (currencies are never combined). */
export function CollectionsChart({ data, months }: { data: MonthPoint[]; months: string[] }) {
  const currencies = [...new Set(data.map((d) => d.currency))];
  const [cur, setCur] = useState(currencies[0] ?? "USD");
  if (currencies.length === 0) {
    return <p className="px-5 py-10 text-center text-[13.5px] text-muted">No payments recorded in the last 6 months yet. Collections will chart here as you record payments.</p>;
  }
  const series = months.map((m) => ({ m, v: Number(data.find((d) => d.month === m && d.currency === cur)?.amount ?? 0) }));
  const max = Math.max(1, ...series.map((s) => s.v));
  const W = 560, H = 190, pad = 26, bw = (W - pad * 2) / series.length;
  return (
    <div className="p-4 sm:p-5">
      {currencies.length > 1 && (
        <div className="mb-2 flex gap-1.5" role="tablist" aria-label="Currency">
          {currencies.map((c) => (
            <button key={c} role="tab" aria-selected={c === cur} onClick={() => setCur(c)} className={`btn btn-sm ${c === cur ? "btn-primary" : ""}`}>{c}</button>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Monthly collections in ${cur}`}>
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad} x2={W - pad} y1={H - 28 - t * (H - 60)} y2={H - 28 - t * (H - 60)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
        ))}
        {series.map((s, i) => {
          const h = (s.v / max) * (H - 60);
          const x = pad + i * bw + bw * 0.2;
          return (
            <g key={s.m}>
              <rect x={x} y={H - 28 - h} width={bw * 0.6} height={Math.max(h, s.v > 0 ? 2 : 0)} rx={3} fill="var(--accent)" opacity={s.v > 0 ? 1 : 0.2}>
                <title>{`${s.m}: ${formatMoney(s.v, cur)}`}</title>
              </rect>
              {s.v > 0 && <text x={x + bw * 0.3} y={H - 34 - h} textAnchor="middle" fontSize="10" fill="var(--muted)" className="num">{formatMoney(s.v, cur).replace(/\.00$/, "")}</text>}
              <text x={x + bw * 0.3} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">{s.m.slice(5)}/{s.m.slice(2, 4)}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[12px] text-muted">Net of reversals · {cur} only · by payment date</p>
    </div>
  );
}
