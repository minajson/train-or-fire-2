import { handleError, json } from "@/lib/http";
import { getStore } from "@/lib/store";
import { PostgresStore } from "@/lib/store/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which driver this instance is actually running, and whether it can reach its
 * database. Used to prove in production that the app is on Postgres rather
 * than quietly falling back to a per-instance memory copy of the room.
 *
 * Deliberately says nothing about *which* database: no host, no user, no URL.
 * The only facts here are the ones an operator needs and an attacker cannot use.
 */
export async function GET() {
  try {
    const store = getStore();
    const started = Date.now();
    let reachable = false;
    let sessions: number | null = null;

    try {
      const codes = await store.listCodes();
      sessions = codes.length;
      reachable = true;
    } catch {
      reachable = false;
    }

    return json({
      ok: reachable,
      driver: store.driver,
      // Whether cross-instance LISTEN/NOTIFY is connected. False is not a
      // fault: the revision poll covers correctness either way.
      notify: store instanceof PostgresStore ? store.notifyReady : false,
      sessions,
      latencyMs: Date.now() - started,
      instance: process.env.VERCEL_DEPLOYMENT_ID ? "vercel" : "local",
    });
  } catch (error) {
    return handleError(error);
  }
}
