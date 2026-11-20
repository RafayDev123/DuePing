import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";

export { sql };
export type Exec = Pick<typeof db, "execute">;

export async function rows<T = Record<string, unknown>>(q: SQL, exec: Exec = db): Promise<T[]> {
  const res = await exec.execute(q);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(q: SQL, exec: Exec = db): Promise<T | null> {
  const r = await rows<T>(q, exec);
  return r[0] ?? null;
}

/** Join SQL fragments with a separator. */
export function join(parts: SQL[], sep: SQL = sql`, `): SQL {
  return sql.join(parts, sep);
}

export function inList(values: string[]): SQL {
  return values.length ? sql.join(values.map((v) => sql`${v}`), sql`, `) : sql`null`;
}

export function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
