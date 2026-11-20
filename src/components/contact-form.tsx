"use client";

import { useState } from "react";
import { api, errMsg } from "@/components/api-client";

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  if (state === "done") return <p role="status" className="rounded-md p-4" style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}>Thanks — your message was received.</p>;
  return (
    <form className="space-y-4" noValidate onSubmit={async (e) => { e.preventDefault(); setErr(""); setState("busy"); try { await api("/api/v1/contact", { body: f }); setState("done"); } catch (e2) { setErr(errMsg(e2)); setState("idle"); } }}>
      <div><label className="label" htmlFor="c-n">Name</label><input id="c-n" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
      <div><label className="label" htmlFor="c-e">Email</label><input id="c-e" type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
      <div><label className="label" htmlFor="c-m">Message</label><textarea id="c-m" className="textarea" style={{ minHeight: 140 }} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} required /></div>
      <div className="sr-only" aria-hidden><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></label></div>
      {err && <p role="alert" className="field-error">{err}</p>}
      <button className="btn btn-primary" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send message"}</button>
    </form>
  );
}
