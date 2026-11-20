import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomToken, sha256 } from "@/lib/crypto";
import { rows, one, sql } from "@/lib/sql";
import type { Role } from "@/lib/permissions";

export const SESSION_COOKIE = "dp_session";
export const WS_COOKIE = "dp_ws";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
}

export interface Ctx {
  user: SessionUser;
  ws: { id: string; name: string };
  role: Role;
  workspaces: { id: string; name: string; role: Role }[];
}

async function isSecureRequest(): Promise<boolean> {
  const h = await headers();
  return (h.get("x-forwarded-proto") || "").split(",")[0] === "https";
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  const h = await headers();
  await rows(sql`insert into sessions (user_id, token_hash, expires_at, user_agent)
    values (${userId}, ${sha256(token)}, ${expires.toISOString()}, ${(h.get("user-agent") || "").slice(0, 200)})`);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await rows(sql`delete from sessions where token_hash = ${sha256(token)}`);
  jar.delete(SESSION_COOKIE);
  jar.delete(WS_COOKIE);
}

export async function setWorkspaceCookie(id: string) {
  const jar = await cookies();
  jar.set(WS_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: await isSecureRequest(), path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const u = await one<{ id: string; email: string; name: string; is_platform_admin: boolean }>(sql`
    select u.id, u.email, u.name, u.is_platform_admin from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now() and u.email_verified_at is not null`);
  return u ? { id: u.id, email: u.email, name: u.name, isPlatformAdmin: u.is_platform_admin } : null;
});

/** Authenticated workspace context. The workspace is always re-verified against membership. */
export const getContext = cache(async (): Promise<Ctx | null> => {
  const user = await getUser();
  if (!user) return null;
  const ms = await rows<{ id: string; name: string; role: Role }>(sql`
    select w.id, w.name, m.role from workspace_members m join workspaces w on w.id = m.workspace_id
    where m.user_id = ${user.id} order by m.created_at asc`);
  if (!ms.length) return null;
  const jar = await cookies();
  const wanted = jar.get(WS_COOKIE)?.value;
  const active = ms.find((m) => m.id === wanted) ?? ms[0];
  return { user, ws: { id: active.id, name: active.name }, role: active.role, workspaces: ms };
});

/** For server components: redirects instead of returning null. */
export async function requireContext(): Promise<Ctx> {
  const user = await getUser();
  if (!user) redirect("/login");
  const ctx = await getContext();
  if (!ctx) redirect("/workspaces/new");
  return ctx;
}

export async function requirePlatformAdmin(): Promise<Ctx> {
  const ctx = await requireContext();
  if (!ctx.user.isPlatformAdmin) redirect("/app");
  return ctx;
}
