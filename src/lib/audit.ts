import { db } from "@/db";
import { auditLogs, notifications } from "@/db/schema";
import { sql } from "@/lib/sql";

type Json = Record<string, unknown>;

export async function audit(
  workspaceId: string | null,
  actorId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  meta?: Json,
) {
  try {
    await db.insert(auditLogs).values({ workspaceId, actorId, action, entityType, entityId, meta });
  } catch (e) {
    console.error("audit failed", e);
  }
}

/** In-app notification. `dedupeKey` makes it idempotent per workspace. */
export async function notify(
  workspaceId: string,
  type: string,
  title: string,
  opts: { body?: string; link?: string; dedupeKey?: string } = {},
) {
  try {
    await db
      .insert(notifications)
      .values({ workspaceId, type, title, body: opts.body, link: opts.link, dedupeKey: opts.dedupeKey })
      .onConflictDoNothing();
  } catch (e) {
    console.error("notify failed", e);
  }
}

export { sql };
