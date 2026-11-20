import { ApiError, notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { ROLES, type Role } from "@/lib/permissions";
import { one, rows, sql } from "@/lib/sql";

export async function listTeam(wsId: string) {
  const members = await rows<{ id: string; user_id: string; name: string; email: string; role: Role; created_at: Date }>(sql`
    select m.id, m.user_id, u.name, u.email, m.role, m.created_at from workspace_members m join users u on u.id = m.user_id where m.workspace_id = ${wsId} order by m.created_at`);
  const invites = await rows<{ id: string; email: string; role: Role; expires_at: Date; created_at: Date }>(sql`
    select id, email, role, expires_at, created_at from workspace_invites where workspace_id = ${wsId} and accepted_at is null and expires_at > now() order by created_at desc`);
  return { members, invites };
}

export async function invite(wsId: string, actorId: string, actorRole: Role, email: string, role: Role, baseUrl: string) {
  if (role === "owner") throw new ApiError(422, "validation_failed", "Ownership cannot be granted by invitation");
  if (role === "admin" && actorRole !== "owner") throw new ApiError(403, "forbidden", "Only the owner can invite admins");
  const already = await one(sql`select 1 from workspace_members m join users u on u.id = m.user_id where m.workspace_id = ${wsId} and u.email = ${email}`);
  if (already) throw new ApiError(409, "already_member", "This person is already a member");
  const token = randomToken(32);
  await rows(sql`delete from workspace_invites where workspace_id = ${wsId} and email = ${email} and accepted_at is null`);
  await rows(sql`insert into workspace_invites (workspace_id, email, role, token_hash, expires_at, created_by) values (${wsId}, ${email}, ${role}, ${sha256(token)}, now() + interval '7 days', ${actorId})`);
  await audit(wsId, actorId, "team.invited", "invite", email, { role });
  return { url: `${baseUrl}/invite/${token}` };
}

export async function revokeInvite(wsId: string, actorId: string, id: string) {
  const r = await one(sql`delete from workspace_invites where id = ${id} and workspace_id = ${wsId} returning id`);
  if (!r) throw notFound("Invitation");
  await audit(wsId, actorId, "team.invite_revoked", "invite", id);
}

export async function previewInvite(token: string) {
  return one<{ id: string; email: string; role: Role; workspace_name: string }>(sql`
    select i.id, i.email, i.role, w.name as workspace_name from workspace_invites i join workspaces w on w.id = i.workspace_id
    where i.token_hash = ${sha256(token)} and i.accepted_at is null and i.expires_at > now()`);
}

export async function acceptInvite(token: string, userId: string, userEmail: string) {
  const inv = await one<{ id: string; workspace_id: string; email: string; role: Role }>(sql`select id, workspace_id, email, role from workspace_invites where token_hash = ${sha256(token)} and accepted_at is null and expires_at > now()`);
  if (!inv) throw new ApiError(400, "invalid_token", "This invitation is invalid or has expired.");
  if (inv.email.toLowerCase() !== userEmail.toLowerCase()) throw new ApiError(403, "wrong_account", `This invitation was sent to ${inv.email}. Sign in with that email address.`);
  await rows(sql`insert into workspace_members (workspace_id, user_id, role) values (${inv.workspace_id}, ${userId}, ${inv.role}) on conflict (workspace_id, user_id) do nothing`);
  await rows(sql`update workspace_invites set accepted_at = now() where id = ${inv.id}`);
  await audit(inv.workspace_id, userId, "team.joined", "user", userId, { role: inv.role });
  return inv.workspace_id;
}

export async function changeRole(wsId: string, actorId: string, actorRole: Role, memberId: string, role: Role) {
  if (!ROLES.includes(role) || role === "owner") throw new ApiError(422, "validation_failed", "Invalid role");
  const m = await one<{ user_id: string; role: Role }>(sql`select user_id, role from workspace_members where id = ${memberId} and workspace_id = ${wsId}`);
  if (!m) throw notFound("Member");
  if (m.role === "owner") throw new ApiError(403, "forbidden", "The owner's role cannot be changed");
  if ((m.role === "admin" || role === "admin") && actorRole !== "owner") throw new ApiError(403, "forbidden", "Only the owner can manage admins");
  await rows(sql`update workspace_members set role = ${role} where id = ${memberId}`);
  await audit(wsId, actorId, "team.role_changed", "user", m.user_id, { from: m.role, to: role });
}

export async function removeMember(wsId: string, actorId: string, actorRole: Role, memberId: string) {
  const m = await one<{ user_id: string; role: Role }>(sql`select user_id, role from workspace_members where id = ${memberId} and workspace_id = ${wsId}`);
  if (!m) throw notFound("Member");
  if (m.role === "owner") throw new ApiError(403, "forbidden", "The owner cannot be removed");
  if (m.role === "admin" && actorRole !== "owner" && m.user_id !== actorId) throw new ApiError(403, "forbidden", "Only the owner can remove admins");
  await rows(sql`delete from workspace_members where id = ${memberId}`);
  await audit(wsId, actorId, "team.removed", "user", m.user_id);
}
