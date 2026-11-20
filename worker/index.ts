/**
 * Dedicated DuePing worker. Polls PostgreSQL for due reminders, recurring invoices and notifications.
 *
 *   npm run worker
 *
 * Safe to run alongside other instances: reminder rows are claimed with FOR UPDATE SKIP LOCKED and
 * emails carry an idempotency key, so restarts and parallel workers cannot send duplicates.
 */
import "dotenv/config";
import { runWorkerCycle } from "@/services/worker";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS || 60_000);
let stopping = false;

async function loop() {
  console.log(`[worker] started, polling every ${INTERVAL_MS / 1000}s`);
  while (!stopping) {
    try {
      const r = await runWorkerCycle();
      console.log(`[worker] ${new Date().toISOString()}`, JSON.stringify(r));
    } catch (e) {
      console.error("[worker] cycle failed:", e instanceof Error ? e.message : e);
    }
    await new Promise((res) => setTimeout(res, INTERVAL_MS));
  }
  console.log("[worker] stopped");
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; });
void loop();
