"use client";

export class ApiClientError extends Error {
  constructor(message: string, public code: string, public status: number, public details?: { path: string; message: string }[]) {
    super(message);
  }
}

/** Calls the DuePing REST API (same-origin, cookie session). Throws ApiClientError with a human message. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.form ? undefined : opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    credentials: "same-origin",
  });
  let json: { ok?: boolean; data?: T; error?: { message?: string; code?: string; details?: { path: string; message: string }[] } } = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok || json.ok === false) {
    throw new ApiClientError(json.error?.message ?? `Request failed (${res.status})`, json.error?.code ?? "error", res.status, json.error?.details);
  }
  return (json.data ?? (json as unknown as T)) as T;
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}
