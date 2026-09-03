/**
 * Small in-process sliding-window limiter.
 *
 * Sized for the real threat: a room full of phones behind one NAT, plus the
 * occasional participant hammering a button. A session is a closed, time-boxed
 * event behind a four-digit code, so this does not need to be a WAF.
 */

interface Window {
  hits: number[];
}

declare global {
  var __trainOrFireRateLimit: Map<string, Window> | undefined;
}

const buckets = (globalThis.__trainOrFireRateLimit ??= new Map<string, Window>());

let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, win] of buckets) {
    if (win.hits.length === 0 || now - win.hits[win.hits.length - 1] > 300_000) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const win = buckets.get(key) ?? { hits: [] };
  const cutoff = now - windowMs;
  win.hits = win.hits.filter((t) => t > cutoff);

  if (win.hits.length >= limit) {
    buckets.set(key, win);
    return { ok: false, remaining: 0, retryAfterMs: Math.max(0, win.hits[0] + windowMs - now) };
  }

  win.hits.push(now);
  buckets.set(key, win);
  return { ok: true, remaining: limit - win.hits.length, retryAfterMs: 0 };
}

/** Best-effort client identity for limiting. Never stored, never displayed. */
export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
