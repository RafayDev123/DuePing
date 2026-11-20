import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getContext, getUser, type Ctx } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";
import { hit } from "@/lib/ratelimit";
import { isUuid, rows, sql } from "@/lib/sql";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);
export const badRequest = (msg: string, details?: unknown) => new ApiError(400, "bad_request", msg, details);

export function respond(data: unknown, status = 200, requestId?: string, headers?: Record<string, string>) {
  return NextResponse.json({ ok: true, data, requestId }, { status, headers: { "x-request-id": requestId ?? "", ...headers } });
}

export function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

interface Opts<B extends z.ZodType, Q extends z.ZodType> {
  perm?: Permission;
  body?: B;
  query?: Q;
  limit?: { max: number; windowSec: number; key?: string };
}

type Params = Record<string, string>;

interface Args<Body, Query, P> {
  req: NextRequest;
  body: Body;
  query: Query;
  params: P;
  requestId: string;
}

function originOk(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients (no ambient cookies are attached cross-site without Origin)
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function execute<B extends z.ZodType, Q extends z.ZodType, P>(
  req: NextRequest,
  rawParams: Promise<P> | undefined,
  opts: Opts<B, Q>,
  auth: boolean,
  handler: (a: Args<z.infer<B>, z.infer<Q>, P> & { ctx: Ctx }) => Promise<unknown>,
): Promise<Response> {
  const requestId = randomUUID();
  try {
    if (!originOk(req)) throw new ApiError(403, "bad_origin", "Cross-origin request blocked");

    let ctx = null as Ctx | null;
    if (auth) {
      ctx = await getContext();
      if (!ctx) {
        const user = await getUser();
        throw new ApiError(user ? 403 : 401, user ? "no_workspace" : "unauthenticated", user ? "No workspace" : "Authentication required");
      }
      if (!can(ctx.role, opts.perm ?? "read")) throw new ApiError(403, "forbidden", "Your role does not allow this action");
    }

    const rl = opts.limit ?? { max: auth ? 300 : 60, windowSec: 60 };
    const subject = ctx ? ctx.user.id : clientIp(req);
    const key = `api:${rl.key ?? new URL(req.url).pathname.replace(/[0-9a-f-]{36}/g, ":id")}:${req.method}:${subject}`;
    const limited = await hit(key, rl.max, rl.windowSec);
    if (!limited.allowed) {
      return NextResponse.json(
        { ok: false, error: { code: "rate_limited", message: "Too many requests. Please slow down." }, requestId },
        { status: 429, headers: { "retry-after": String(limited.retryAfter), "x-request-id": requestId } },
      );
    }

    let body: unknown = undefined;
    if (opts.body) {
      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        throw new ApiError(400, "invalid_json", "Request body must be valid JSON");
      }
      const parsed = opts.body.safeParse(raw);
      if (!parsed.success) {
        throw new ApiError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid input", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      }
      body = parsed.data;
    }
    let query: unknown = undefined;
    if (opts.query) {
      const parsed = opts.query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
      if (!parsed.success) {
        throw new ApiError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid query", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      }
      query = parsed.data;
    }

    const params = (rawParams ? await rawParams : {}) as P;
    for (const [k, v] of Object.entries(params as Record<string, string>)) {
      if ((k === "id" || k.endsWith("Id")) && !isUuid(v)) throw new ApiError(404, "not_found", "Resource not found");
    }
    const result = await handler({ req, ctx: ctx as Ctx, body: body as z.infer<B>, query: query as z.infer<Q>, params, requestId });
    if (result instanceof Response) {
      result.headers.set("x-request-id", requestId);
      return result;
    }
    return respond(result ?? { done: true }, 200, requestId);
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json(
        { ok: false, error: { code: e.code, message: e.message, details: e.details }, requestId },
        { status: e.status, headers: { "x-request-id": requestId } },
      );
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(`[${requestId}]`, e);
    try {
      await rows(sql`insert into system_errors (source, request_id, message) values (${new URL(req.url).pathname}, ${requestId}, ${message.slice(0, 500)})`);
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { ok: false, error: { code: "internal_error", message: "Something went wrong on our side." }, requestId },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
}

type Ctx2<P> = { params: Promise<P> };

/** Authenticated + authorised + validated route. */
export function route<B extends z.ZodType = z.ZodUndefined, Q extends z.ZodType = z.ZodUndefined, P = Params>(
  opts: Opts<B, Q>,
  handler: (a: Args<z.infer<B>, z.infer<Q>, P> & { ctx: Ctx }) => Promise<unknown>,
) {
  return (req: NextRequest, c: Ctx2<P>) => execute(req, c?.params, opts, true, handler);
}

/** Public route (no session). Used for portal, auth, contact and webhooks. */
export function publicRoute<B extends z.ZodType = z.ZodUndefined, Q extends z.ZodType = z.ZodUndefined, P = Params>(
  opts: Opts<B, Q>,
  handler: (a: Args<z.infer<B>, z.infer<Q>, P>) => Promise<unknown>,
) {
  return (req: NextRequest, c: Ctx2<P>) => execute(req, c?.params, opts, false, handler as never);
}
