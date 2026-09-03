import "server-only";
import { Client, Pool } from "pg";
import type { SessionRecord } from "@/lib/types";
import { SCHEMA_SQL } from "./schema";
import type { Mutator, SessionStore, UpdateResult } from "./types";

const CHANNEL = "tof_sessions";

/** Thrown when a code is already taken, so the service can pick another. */
export class CodeTakenError extends Error {
  constructor(code: string) {
    super(`Session code ${code} is already in use.`);
    this.name = "CodeTakenError";
  }
}

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

/**
 * Production driver — used when TRAIN_FIRE_DATABASE_URL is set.
 *
 * Two things make this different from a single-node store, and both come from
 * the same fact: on Vercel there is no "the server". There are several, they
 * come and go, and the participant who votes is very often not being served by
 * the instance holding the projector's SSE connection.
 *
 *  1. WRITES SERIALISE ON THE ROW. `SELECT … FOR UPDATE` inside a transaction,
 *     so two people voting in the same millisecond queue behind each other
 *     instead of one silently overwriting the other's vote.
 *
 *  2. READS FIND OUT ABOUT OTHER INSTANCES. LISTEN/NOTIFY is the fast path,
 *     but it needs a session-mode connection and a transaction-mode pooler
 *     drops it without an error. So there is also a revision poll, scoped to
 *     the handful of codes this instance actually has screens open for.
 *     Correctness comes from the poll; NOTIFY only makes it instant.
 */
export class PostgresStore implements SessionStore {
  readonly driver = "postgres" as const;

  private pool: Pool;
  private listener: Client | null = null;
  private listenerHealthy = false;
  private subscribers = new Set<(code: string) => void>();
  private ready: Promise<void> | null = null;

  /** Codes this instance is serving, and the last revision it broadcast. */
  private active = new Map<string, number>();
  private pollTimer: NodeJS.Timeout | null = null;
  private polling = false;

  private readonly pollMs: number;

  constructor(private readonly connectionString: string) {
    this.pool = new Pool({
      connectionString,
      // Deliberately small. Every warm instance holds its own pool, and a
      // managed Postgres runs out of connections long before this app runs out
      // of instances.
      max: Number(process.env.TRAIN_FIRE_PG_POOL ?? 4),
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 10_000,
      // Managed Postgres requires TLS but presents certificates this process
      // has no root store for.
      ssl: isLocal(connectionString) ? undefined : { rejectUnauthorized: false },
    });
    // A pool that emits an unhandled 'error' takes the process with it.
    this.pool.on("error", () => {});
    this.pollMs = Math.max(250, Number(process.env.TRAIN_FIRE_PG_POLL_MS ?? 700));
  }

  init(): Promise<void> {
    this.ready ??= this.bootstrap();
    return this.ready;
  }

  private async bootstrap(): Promise<void> {
    try {
      await this.pool.query(SCHEMA_SQL);
    } catch (error) {
      // The schema may already be applied by a role with rights this one does
      // not have. Only give up if the table is genuinely unreachable.
      await this.pool.query("SELECT 1 FROM tof_sessions LIMIT 1").catch(() => {
        throw error;
      });
    }
    // Best effort: if LISTEN is unavailable the poll covers us, so a failure
    // here must not stop the store from booting.
    await this.startListener().catch(() => {});
  }

  /* ---------------------------------------------------------------- */
  /* Cross-instance notification                                       */
  /* ---------------------------------------------------------------- */

  private async startListener(): Promise<void> {
    if (this.listener) return;
    const client = new Client({
      connectionString: this.connectionString,
      ssl: isLocal(this.connectionString) ? undefined : { rejectUnauthorized: false },
    });

    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      this.fanout(msg.payload);
    });

    client.on("error", () => {
      this.listener = null;
      this.listenerHealthy = false;
      const retry = setTimeout(() => void this.startListener().catch(() => {}), 3000);
      retry.unref?.();
    });

    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    this.listener = client;
    this.listenerHealthy = true;
  }

  /** True when LISTEN is actually connected. Surfaced for diagnostics. */
  get notifyReady(): boolean {
    return this.listenerHealthy;
  }

  private fanout(code: string) {
    for (const handler of this.subscribers) {
      try {
        handler(code);
      } catch {
        // One broken subscriber must not stop the others.
      }
    }
  }

  /**
   * The hub tells us which codes have open screens on this instance. We poll
   * only those, by primary key, selecting only the revision — so the safety
   * net costs one index lookup per open session per tick, whether or not
   * NOTIFY is working.
   */
  setActiveCodes(codes: string[]): void {
    const next = new Map<string, number>();
    for (const code of codes) next.set(code, this.active.get(code) ?? -1);
    this.active = next;

    if (next.size === 0) {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      return;
    }
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => void this.poll(), this.pollMs);
    this.pollTimer.unref?.();
  }

  private async poll(): Promise<void> {
    if (this.polling || this.active.size === 0) return;
    this.polling = true;
    try {
      const codes = [...this.active.keys()];
      const { rows } = await this.pool.query<{ code: string; revision: string | null }>(
        "SELECT code, revision FROM tof_sessions WHERE code = ANY($1::text[])",
        [codes],
      );
      for (const row of rows) {
        const revision = Number(row.revision ?? 0);
        const seen = this.active.get(row.code);
        if (seen === undefined) continue;
        if (revision > seen) {
          this.active.set(row.code, revision);
          // -1 is "we have never broadcast this code", which happens on the
          // first tick after a screen opens. The hub has already sent that
          // client the current state, so re-sending is wasted but harmless;
          // suppressing it keeps the frame count honest.
          if (seen !== -1) this.fanout(row.code);
        }
      }
    } catch {
      // A failed poll is a missed tick, not a broken session. The next one
      // catches up, and every client re-syncs in full on reconnect anyway.
    } finally {
      this.polling = false;
    }
  }

  /** Records a revision we have just written, so the poll does not re-fire it. */
  private markSeen(code: string, revision: number) {
    if (this.active.has(code)) {
      const seen = this.active.get(code) ?? -1;
      if (revision > seen) this.active.set(code, revision);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Store                                                             */
  /* ---------------------------------------------------------------- */

  async create(record: SessionRecord): Promise<SessionRecord> {
    await this.init();
    const { rowCount } = await this.pool.query(
      `INSERT INTO tof_sessions (code, id, facilitator_token, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING`,
      [record.code, record.id, record.facilitatorToken, record],
    );
    // Two instances can pick the same free code in the same instant. Say so
    // rather than handing back a session that belongs to someone else.
    if (rowCount === 0) throw new CodeTakenError(record.code);
    return record;
  }

  async getByCode(code: string): Promise<SessionRecord | null> {
    await this.init();
    const { rows } = await this.pool.query<{ data: SessionRecord }>(
      "SELECT data FROM tof_sessions WHERE code = $1",
      [code],
    );
    return rows[0]?.data ?? null;
  }

  async update<T>(code: string, mutator: Mutator<T>): Promise<UpdateResult<T> | null> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // The row lock is the whole concurrency story: a second voter's
      // transaction blocks here until the first has committed, so it reads the
      // first vote and adds to it instead of clobbering it.
      const { rows } = await client.query<{ data: SessionRecord }>(
        "SELECT data FROM tof_sessions WHERE code = $1 FOR UPDATE",
        [code],
      );
      const draft = rows[0]?.data;
      if (!draft) {
        await client.query("ROLLBACK");
        return null;
      }

      const value = mutator(draft);
      if (value === false) {
        await client.query("ROLLBACK");
        return null;
      }

      draft.updatedAt = Date.now();
      draft.revision = (draft.revision ?? 0) + 1;
      await client.query(
        "UPDATE tof_sessions SET data = $2, updated_at = now() WHERE code = $1",
        [code, draft],
      );
      await client.query("COMMIT");
      this.markSeen(code, draft.revision);
      return { session: draft, value: value as T };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async remove(code: string): Promise<void> {
    await this.init();
    await this.pool.query("DELETE FROM tof_sessions WHERE code = $1", [code]);
  }

  async listCodes(): Promise<string[]> {
    await this.init();
    const { rows } = await this.pool.query<{ code: string }>(
      "SELECT code FROM tof_sessions ORDER BY updated_at DESC LIMIT 500",
    );
    return rows.map((r) => r.code);
  }

  async subscribe(handler: (code: string) => void): Promise<() => void> {
    await this.init();
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  async publish(code: string): Promise<void> {
    await this.init();
    await this.pool.query("SELECT pg_notify($1, $2)", [CHANNEL, code]);
  }
}
