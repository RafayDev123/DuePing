/**
 * Optional embedded worker for single-instance deployments (EMBEDDED_WORKER=true).
 * All state lives in PostgreSQL (rows are claimed with FOR UPDATE SKIP LOCKED and sends use idempotency keys),
 * so a restart or several instances cannot produce duplicate reminders. For production use the dedicated
 * worker (`npm run worker`) instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.EMBEDDED_WORKER !== "true") return;
  const g = globalThis as typeof globalThis & { __dpWorker?: boolean };
  if (g.__dpWorker) return;
  g.__dpWorker = true;
  const tick = async () => {
    try {
      const { runWorkerCycle } = await import("@/services/worker");
      await runWorkerCycle();
    } catch (e) {
      console.error("[worker] cycle failed", e instanceof Error ? e.message : e);
    }
  };
  setTimeout(tick, 20_000);
  setInterval(tick, 60_000);
}
