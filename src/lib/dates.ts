const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date (YYYY-MM-DD) in a given IANA timezone. */
export function todayInTz(tz: string, now: Date = new Date()): string {
  const safe = isValidTimezone(tz) ? tz : "UTC";
  return new Intl.DateTimeFormat("en-CA", { timeZone: safe, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function parseYmd(s: string): [number, number, number] {
  const [y, m, d] = s.split("-").map(Number);
  return [y, m, d];
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = parseYmd(a);
  const [by, bm, bd] = parseYmd(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function addMonths(ymd: string, n: number): string {
  const [y, m, d] = parseYmd(ymd);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export function isYmd(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = parseYmd(s);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function formatDate(ymd: string | Date | null | undefined): string {
  if (!ymd) return "—";
  const s = typeof ymd === "string" ? ymd.slice(0, 10) : ymd.toISOString().slice(0, 10);
  if (!isYmd(s)) return "—";
  const [y, m, d] = parseYmd(s);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateTime(d: Date | string | null | undefined, tz = "UTC"): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const safe = isValidTimezone(tz) ? tz : "UTC";
  return new Intl.DateTimeFormat("en-GB", { timeZone: safe, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function tzOffsetMs(ts: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Convert a wall-clock time in `tz` to a UTC instant. */
export function zonedToUtc(ymd: string, hour: number, minute: number, tz: string): Date {
  const safe = isValidTimezone(tz) ? tz : "UTC";
  const [y, m, d] = parseYmd(ymd);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  let ts = guess - tzOffsetMs(guess, safe);
  ts = guess - tzOffsetMs(ts, safe);
  return new Date(ts);
}

export function localHour(date: Date, tz: string): number {
  const safe = isValidTimezone(tz) ? tz : "UTC";
  const h = new Intl.DateTimeFormat("en-US", { timeZone: safe, hourCycle: "h23", hour: "2-digit" }).format(date);
  return Number(h);
}

export function inQuietHours(date: Date, tz: string, start: number, end: number): boolean {
  if (start === end) return false;
  const h = localHour(date, tz);
  return start > end ? h >= start || h < end : h >= start && h < end;
}

/** If `date` falls in quiet hours, move it to the next quiet-hours end (local time). */
export function applyQuietHours(date: Date, tz: string, start: number, end: number): Date {
  if (!inQuietHours(date, tz, start, end)) return date;
  const h = localHour(date, tz);
  const localYmd = todayInTz(tz, date);
  const day = start > end && h >= start ? addDays(localYmd, 1) : localYmd;
  return zonedToUtc(day, end, 0, tz);
}

export const COMMON_TIMEZONES = [
  "UTC", "Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "Asia/Dhaka", "Asia/Riyadh", "Asia/Singapore", "Asia/Tokyo",
  "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Istanbul", "Africa/Lagos", "Africa/Nairobi", "Africa/Cairo", "Australia/Sydney",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo",
];
