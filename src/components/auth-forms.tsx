"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError, errMsg } from "@/components/api-client";

function Err({ msg }: { msg: string }) {
  return msg ? <p role="alert" className="field-error m-0">{msg}</p> : null;
}

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-4" noValidate onSubmit={async (e) => { e.preventDefault(); setErr(""); setBusy(true); try { await api("/api/v1/auth/login", { body: f }); router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/app"); router.refresh(); } catch (e2) { setErr(errMsg(e2)); setBusy(false); } }}>
      <div><label className="label" htmlFor="l-e">Email</label><input id="l-e" type="email" autoComplete="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
      <div><label className="label" htmlFor="l-p">Password</label><input id="l-p" type="password" autoComplete="current-password" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></div>
      <Err msg={err} />
      <button className="btn btn-primary w-full" disabled={busy || !f.email || !f.password}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className="m-0 text-center text-[13px]"><Link className="link" href="/forgot-password">Forgot your password?</Link></p>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [f, setF] = useState(() => ({ name: "", email: "", password: "", businessName: "", timezone: typeof window === "undefined" ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }));
  const [err, setErr] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ verifyUrl?: string } | null>(null);
  if (done) {
    return (
      <div role="status" className="space-y-3"><h2 className="m-0 text-[18px] font-semibold">Check your inbox</h2>
        <p className="m-0 text-muted">We sent a verification link to <b>{f.email}</b>. Open it to activate your account.</p>
        {done.verifyUrl && <p className="m-0 rounded-md bg-[var(--warning-soft)] p-3 text-[13px]" style={{ color: "var(--warning-ink)" }}>Development mode: <a className="link" href={done.verifyUrl}>open verification link</a></p>}</div>
    );
  }
  return (
    <form className="space-y-4" noValidate onSubmit={async (e) => {
      e.preventDefault(); setErr(""); setFieldErr({}); setBusy(true);
      try {
        const r = await api<{ needsVerification: boolean; verifyUrl?: string }>("/api/v1/auth/signup", { body: f });
        if (r.needsVerification) setDone({ verifyUrl: r.verifyUrl }); else { router.push("/app"); router.refresh(); }
      } catch (e2) {
        if (e2 instanceof ApiClientError && e2.details) setFieldErr(Object.fromEntries(e2.details.map((d) => [d.path, d.message])));
        setErr(errMsg(e2));
      } finally { setBusy(false); }
    }}>
      <div><label className="label" htmlFor="s-n">Your name</label><input id="s-n" autoComplete="name" className="input" aria-invalid={!!fieldErr.name} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />{fieldErr.name && <p className="field-error">{fieldErr.name}</p>}</div>
      <div><label className="label" htmlFor="s-b">Business name</label><input id="s-b" autoComplete="organization" className="input" aria-invalid={!!fieldErr.businessName} value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} required />{fieldErr.businessName && <p className="field-error">{fieldErr.businessName}</p>}</div>
      <div><label className="label" htmlFor="s-e">Email</label><input id="s-e" type="email" autoComplete="email" className="input" aria-invalid={!!fieldErr.email} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />{fieldErr.email && <p className="field-error">{fieldErr.email}</p>}</div>
      <div><label className="label" htmlFor="s-p">Password</label><input id="s-p" type="password" autoComplete="new-password" className="input" aria-invalid={!!fieldErr.password} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /><p className="hint">At least 10 characters.</p>{fieldErr.password && <p className="field-error">{fieldErr.password}</p>}</div>
      {!Object.keys(fieldErr).length && <Err msg={err} />}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="m-0 text-center text-[12.5px] text-muted">By creating an account you agree to the <Link className="link" href="/terms">Terms</Link> and <Link className="link" href="/privacy">Privacy Policy</Link>.</p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ text: string; dev?: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-4" noValidate onSubmit={async (e) => { e.preventDefault(); setErr(""); setBusy(true); try { const r = await api<{ message: string; devUrl?: string }>("/api/v1/auth/forgot", { body: { email } }); setMsg({ text: r.message, dev: r.devUrl }); } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); } }}>
      <div><label className="label" htmlFor="f-e">Account email</label><input id="f-e" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <Err msg={err} />
      {msg && <p role="status" className="m-0 rounded-md bg-accentsoft p-3 text-[13.5px]" style={{ color: "var(--accent-text)" }}>{msg.text}{msg.dev && <> <br />Development mode: <a className="link" href={msg.dev}>open reset link</a></>}</p>}
      <button className="btn btn-primary w-full" disabled={busy || !email}>{busy ? "Sending…" : "Send reset link"}</button>
    </form>
  );
}

export function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (!token) return <p className="field-error">This reset link is missing its token. Request a new one.</p>;
  return (
    <form className="space-y-4" noValidate onSubmit={async (e) => { e.preventDefault(); setErr(""); setBusy(true); try { await api("/api/v1/auth/reset", { body: { token, password: pw } }); router.push("/login?reset=1"); } catch (e2) { setErr(errMsg(e2)); setBusy(false); } }}>
      <div><label className="label" htmlFor="r-p">New password</label><input id="r-p" type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} required /><p className="hint">At least 10 characters. You will be signed out everywhere.</p></div>
      <Err msg={err} />
      <button className="btn btn-primary w-full" disabled={busy || pw.length < 10}>{busy ? "Saving…" : "Set new password"}</button>
    </form>
  );
}

export function VerifyEmail() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!token) return;
    api("/api/v1/auth/verify", { body: { token } }).then(() => { router.push("/app"); router.refresh(); }).catch((e) => setErr(errMsg(e)));
  }, [token, router]);
  if (!token) return <Err msg="Missing verification token." />;
  return err ? <Err msg={err} /> : <p role="status">Verifying your email…</p>;
}

export function NewWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-4" noValidate onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); try { await api("/api/v1/workspaces", { body: { name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }); router.push("/app"); router.refresh(); } catch (e2) { setErr(errMsg(e2)); setBusy(false); } }}>
      <div><label className="label" htmlFor="w-n">Business name</label><input id="w-n" className="input" value={name} onChange={(e) => setName(e.target.value)} required /><p className="hint">Each business has its own clients, invoices, payments, reminders, branding and team.</p></div>
      <Err msg={err} />
      <button className="btn btn-primary w-full" disabled={busy || !name.trim()}>Create workspace</button>
    </form>
  );
}

export function AcceptInvite({ token, signedInAs }: { token: string; signedInAs: string | null }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (!signedInAs) return <div className="flex gap-2"><Link className="btn btn-primary" href={`/login?next=/invite/${token}`}>Sign in to accept</Link><Link className="btn" href={`/signup`}>Create account</Link></div>;
  return (
    <div className="space-y-3"><p className="m-0 text-[13px] text-muted">Signed in as {signedInAs}</p><Err msg={err} />
      <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await api("/api/v1/invites/accept", { body: { token } }); router.push("/app"); router.refresh(); } catch (e) { setErr(errMsg(e)); setBusy(false); } }}>Accept invitation</button></div>
  );
}
