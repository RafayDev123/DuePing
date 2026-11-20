import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export interface PreviewData {
  business: { name: string; address?: string | null; email?: string | null; phone?: string | null; taxId?: string | null; logo?: string | null; color: string; footer?: string | null; paymentInstructions?: string | null };
  client: { name: string; businessName?: string | null; email?: string | null; address?: string | null } | null;
  number: string;
  title?: string | null;
  status?: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  items: { description: string; quantity: string; unitPrice: string; lineTotal: string }[];
  subtotal: string;
  discountTotal: string;
  discountLabel?: string;
  taxTotal: string;
  taxRate: string;
  total: string;
  paid?: string;
  balance?: string;
  paymentTerms?: string | null;
  notes?: string | null;
  payments?: { date: string; method: string; amount: string; kind: string }[];
}

/** HTML mirror of the PDF layout so the editor shows how the document will look. */
export function InvoicePreview({ d }: { d: PreviewData }) {
  const f = (v: string | number) => formatMoney(v, d.currency);
  const balance = d.balance ?? d.total;
  return (
    <article className="paper mx-auto w-full max-w-[720px] overflow-hidden" aria-label={`Invoice ${d.number}`}>
      <div style={{ height: 6, background: d.business.color }} />
      <div className="p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {d.business.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.business.logo} alt={`${d.business.name} logo`} style={{ maxHeight: 52, maxWidth: 160 }} />
            ) : (
              <p className="m-0 text-[17px] font-bold" style={{ fontFamily: "var(--font-display)" }}>{d.business.name}</p>
            )}
            <div className="mt-2 text-[11.5px] leading-relaxed" style={{ color: "#5f6b65" }}>
              {d.business.logo && <div className="font-semibold" style={{ color: "#17211f" }}>{d.business.name}</div>}
              {d.business.address && <div className="whitespace-pre-line">{d.business.address}</div>}
              {d.business.email && <div>{d.business.email}</div>}
              {d.business.phone && <div>{d.business.phone}</div>}
              {d.business.taxId && <div>Tax ID: {d.business.taxId}</div>}
            </div>
          </div>
          <div className="text-right">
            <p className="m-0 text-[22px] font-bold tracking-tight" style={{ color: d.business.color, fontFamily: "var(--font-display)" }}>INVOICE</p>
            <p className="mono m-0 text-[12.5px]">{d.number}</p>
            {d.status && <p className="m-0 mt-1 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "#5f6b65" }}>{d.status.replace("_", " ")}</p>}
          </div>
        </div>

        <hr className="my-5 border-0 border-t" style={{ borderColor: "#e5e7df" }} />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5f6b65" }}>Billed to</p>
            {d.client ? (
              <div className="text-[12px] leading-relaxed" style={{ color: "#5f6b65" }}>
                <div className="text-[13.5px] font-bold" style={{ color: "#17211f" }}>{d.client.name}</div>
                {d.client.businessName && <div>{d.client.businessName}</div>}
                {d.client.address && <div className="whitespace-pre-line">{d.client.address}</div>}
                {d.client.email && <div>{d.client.email}</div>}
              </div>
            ) : <p className="m-0 text-[12px] italic" style={{ color: "#8a948e" }}>Select a client</p>}
          </div>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[12px] sm:justify-self-end">
            <dt style={{ color: "#5f6b65" }}>Issue date</dt><dd className="m-0 text-right font-semibold">{formatDate(d.issueDate)}</dd>
            <dt style={{ color: "#5f6b65" }}>Due date</dt><dd className="m-0 text-right font-semibold">{formatDate(d.dueDate)}</dd>
            <dt style={{ color: "#5f6b65" }}>Currency</dt><dd className="m-0 text-right font-semibold">{d.currency}</dd>
          </dl>
        </div>

        {d.title && <p className="mb-0 mt-5 text-[14px] font-bold">{d.title}</p>}

        <div className="scroll-x mt-4">
          <table className="w-full min-w-[420px] border-collapse text-[12px]">
            <thead>
              <tr style={{ background: "#f5f4ef" }}>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider" style={{ color: "#5f6b65" }}>Description</th>
                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider" style={{ color: "#5f6b65" }}>Qty</th>
                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider" style={{ color: "#5f6b65" }}>Unit price</th>
                <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider" style={{ color: "#5f6b65" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {d.items.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center italic" style={{ color: "#8a948e" }}>Add line items to see them here</td></tr>}
              {d.items.map((it, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7df" }}>
                  <td className="px-2 py-2.5 align-top" style={{ overflowWrap: "anywhere" }}>{it.description || <span style={{ color: "#8a948e" }}>—</span>}</td>
                  <td className="num px-2 py-2.5 text-right align-top">{Number(it.quantity) || 0}</td>
                  <td className="num px-2 py-2.5 text-right align-top">{f(it.unitPrice || 0)}</td>
                  <td className="num px-2 py-2.5 text-right align-top">{f(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto w-full max-w-[280px] text-[12.5px]">
          <div className="flex justify-between py-1"><span style={{ color: "#5f6b65" }}>Subtotal</span><span className="num">{f(d.subtotal)}</span></div>
          {Number(d.discountTotal) > 0 && <div className="flex justify-between py-1"><span style={{ color: "#5f6b65" }}>{d.discountLabel ?? "Discount"}</span><span className="num">− {f(d.discountTotal)}</span></div>}
          {(Number(d.taxTotal) > 0 || Number(d.taxRate) > 0) && <div className="flex justify-between py-1"><span style={{ color: "#5f6b65" }}>Tax ({Number(d.taxRate)}%)</span><span className="num">{f(d.taxTotal)}</span></div>}
          <div className="mt-1 flex justify-between border-t py-1.5 font-bold" style={{ borderColor: "#e5e7df" }}><span>Total</span><span className="num">{f(d.total)}</span></div>
          {Number(d.paid ?? 0) > 0 && <div className="flex justify-between py-1"><span style={{ color: "#5f6b65" }}>Payments received</span><span className="num">− {f(d.paid!)}</span></div>}
          <div className="mt-1.5 flex justify-between rounded px-3 py-2 font-bold text-white" style={{ background: d.business.color }}><span>Balance due</span><span className="num">{f(balance)}</span></div>
        </div>

        {d.payments && d.payments.length > 0 && (
          <div className="mt-5">
            <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5f6b65" }}>Payment history</p>
            {d.payments.map((p, i) => (
              <div key={i} className="flex justify-between gap-3 py-0.5 text-[12px]"><span>{formatDate(p.date)} · <span style={{ color: "#5f6b65" }}>{p.kind === "reversal" ? "Reversal" : p.method.replace(/_/g, " ")}</span></span><span className="num">{f(p.amount)}</span></div>
            ))}
          </div>
        )}

        {[["Payment instructions", d.business.paymentInstructions], ["Payment terms", d.paymentTerms], ["Notes", d.notes]].map(([label, body]) => body ? (
          <div key={label} className="mt-4">
            <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5f6b65" }}>{label}</p>
            <p className="m-0 whitespace-pre-line text-[12px] leading-relaxed" style={{ overflowWrap: "anywhere" }}>{body}</p>
          </div>
        ) : null)}

        <p className="mb-0 mt-6 border-t pt-3 text-[10.5px]" style={{ borderColor: "#e5e7df", color: "#5f6b65" }}>{d.business.footer || d.business.name}</p>
      </div>
    </article>
  );
}
