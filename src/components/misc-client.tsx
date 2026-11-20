"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { api, errMsg } from "@/components/api-client";
import { useToast } from "@/components/toast";

export function PrintButton() {
  return <button className="btn btn-sm" onClick={() => window.print()}><Printer size={14} /> Print</button>;
}

export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  return <button className="btn btn-sm" disabled={disabled} onClick={async () => { try { await api("/api/v1/notifications", { body: {} }); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); } }}>Mark all as read</button>;
}

export function MarkRead({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => { setBusy(true); try { await api("/api/v1/notifications", { body: { id } }); router.refresh(); } finally { setBusy(false); } }}>Mark read</button>;
}
