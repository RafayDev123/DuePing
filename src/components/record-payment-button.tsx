"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { PaymentDialog, type PayInvoice } from "@/components/payment-dialog";

export function RecordPaymentButton({ invoices, today, customMethods }: { invoices: PayInvoice[]; today: string; customMethods: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)} disabled={invoices.length === 0} title={invoices.length === 0 ? "No open invoices with a balance" : undefined}><Wallet size={14} /> Record payment</button>
      <PaymentDialog open={open} onClose={() => setOpen(false)} invoices={invoices} today={today} customMethods={customMethods} />
    </>
  );
}
