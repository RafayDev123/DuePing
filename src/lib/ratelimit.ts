import { one, sql } from "@/lib/sql";

/** Postgres-backed fixed-window rate limiter (works across multiple app instances). */
export async function hit(key: string, max: number, windowSec: number): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const row = await one<{ count: number; window_start: Date }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
    returning count, window_start`);
  const count = row?.count ?? 1;
  const start = row ? new Date(row.window_start).getTime() : Date.now();
  const retryAfter = Math.max(1, Math.ceil((start + windowSec * 1000 - Date.now()) / 1000));
  return { allowed: count <= max, remaining: Math.max(0, max - count), retryAfter };
}
