import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { hashPassword, randomToken, sha256, verifyPassword } from "@/lib/crypto";
import { authEmailVerificationRequired, platformMailerConfigured } from "@/lib/env";
import { sendPlatformEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/reminder-templates";
import { one, rows, sql } from "@/lib/sql";
import { createWorkspace } from "@/services/workspace";

const devLinks = () => process.env.AUTH_DEV_LINKS === "true";

async function issueToken(userId: string, type: "verify_email" | "reset_password", ttlHours: number) {
  const token = randomToken(32);
  await rows(sql`insert into auth_tokens (user_id, type, token_hash, expires_at) values (${userId}, ${type}, ${sha256(token)}, now() + make_interval(hours => ${ttlHours}))`);
  return token;
}

async function mail(to: string, subject: string, text: string) {
  return sendPlatformEmail({ to, subject, text, html: `<p style="font-family:Arial">${escapeHtml(text).replace(/\n/g, "<br>")}</p>` });
}

export async function signup(input: { name: string; email: string; password: string; businessName: string; timezone?: string }, baseUrl: string) {
  const exists = await one(sql`select 1 from users where email = ${input.email}`);
  if (exists) throw new ApiError(409, "email_taken", "An account with this email already exists. Try signing in.");
  const hash = await hashPassword(input.password);
  const needsVerification = authEmailVerificationRequired();
  const first = (await one<{ n: number }>(sql`select count(*)::int as n from users where is_platform_admin`))!.n === 0;
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const isAdmin = first || adminEmails.includes(input.email);
  const u = await one<{ id: string }>(sql`insert into users (email, name, password_hash, email_verified_at, is_platform_admin)
    values (${input.email}, ${input.name}, ${hash}, ${needsVerification ? sql`null` : sql`now()`}, ${isAdmin}) returning id`);
  const wsId = await createWorkspace(u!.id, input.businessName, input.timezone);
  let verifyUrl: string | undefined;
  if (needsVerification) {
    const token = await issueToken(u!.id, "verify_email", 48);
    verifyUrl = `${baseUrl}/verify-email?token=${token}`;
    const res = await mail(input.email, "Verify your DuePing email", `Hi ${input.name},\n\nConfirm your email to activate your DuePing account:\n${verifyUrl}\n\nThis link expires in 48 hours.`);
    if (!res.ok) console.error("verification email failed", res.error);
    verifyUrl = devLinks() ? verifyUrl : undefined;
  }
  await audit(wsId, u!.id, "user.signup", "user", u!.id);
  return { userId: u!.id, needsVerification, verifyUrl };
}

export async function login(email: string, password: string) {
  const u = await one<{ id: string; password_hash: string; email_verified_at: Date | null }>(sql`select id, password_hash, email_verified_at from users where email = ${email}`);
  // Always run a hash comparison to keep timing similar for unknown accounts.
  const ok = await verifyPassword(password, u?.password_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
  if (!u || !ok) throw new ApiError(401, "invalid_credentials", "Incorrect email or password");
  if (!u.email_verified_at && authEmailVerificationRequired()) {
    throw new ApiError(403, "email_unverified", "Please verify your email address first. Check your inbox for the verification link.");
  }
  return u.id;
}

export async function verifyEmail(token: string) {
  const t = await one<{ id: string; user_id: string }>(sql`select id, user_id from auth_tokens where token_hash = ${sha256(token)} and type = 'verify_email' and used_at is null and expires_at > now()`);
  if (!t) throw new ApiError(400, "invalid_token", "This verification link is invalid or has expired.");
  await rows(sql`update auth_tokens set used_at = now() where id = ${t.id}`);
  await rows(sql`update users set email_verified_at = coalesce(email_verified_at, now()) where id = ${t.user_id}`);
  return t.user_id;
}

export async function forgotPassword(email: string, baseUrl: string) {
  const u = await one<{ id: string; name: string }>(sql`select id, name from users where email = ${email}`);
  let devUrl: string | undefined;
  if (u) {
    const token = await issueToken(u.id, "reset_password", 1);
    const url = `${baseUrl}/reset-password?token=${token}`;
    if (platformMailerConfigured()) {
      const res = await mail(email, "Reset your DuePing password", `Hi ${u.name},\n\nUse this link to choose a new password (valid for 1 hour):\n${url}\n\nIf you didn't request this, ignore this email.`);
      if (!res.ok) console.error("reset email failed", res.error);
    }
    if (devLinks() && !platformMailerConfigured()) devUrl = url;
  }
  // Same response whether or not the account exists (prevents account enumeration).
  return { devUrl };
}

export async function resetPassword(token: string, password: string) {
  const t = await one<{ id: string; user_id: string }>(sql`select id, user_id from auth_tokens where token_hash = ${sha256(token)} and type = 'reset_password' and used_at is null and expires_at > now()`);
  if (!t) throw new ApiError(400, "invalid_token", "This reset link is invalid or has expired.");
  await rows(sql`update auth_tokens set used_at = now() where id = ${t.id}`);
  await rows(sql`update users set password_hash = ${await hashPassword(password)} where id = ${t.user_id}`);
  await rows(sql`delete from sessions where user_id = ${t.user_id}`); // sign out everywhere
  await audit(null, t.user_id, "user.password_reset", "user", t.user_id);
}
