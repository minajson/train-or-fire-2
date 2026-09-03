import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SessionRecord } from "@/lib/types";
import type { Mutator, SessionStore, UpdateResult } from "./types";

/**
 * Authoritative copy in process memory, snapshotted to a JSON file so a server
 * restart mid-session does not lose the room.
 *
 * Correct for the deployment this product actually has: one facilitator, one
 * node, one room. The snapshot is what makes "restart the server between the
 * verdict and the AAR" survivable — votes, revealed phases, stage and beat all
 * come back exactly where they were.
 */
export class MemoryStore implements SessionStore {
  readonly driver = "memory" as const;

  private sessions = new Map<string, SessionRecord>();
  private locks = new Map<string, Promise<unknown>>();
  private subscribers = new Set<(code: string) => void>();
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> | null = null;
  private ready: Promise<void> | null = null;
  private readonly file: string;

  constructor(dataDir?: string) {
    const dir =
      dataDir ?? process.env.TRAIN_FIRE_DATA_DIR ?? path.join(process.cwd(), ".data");
    this.file = path.join(dir, "sessions.json");
  }

  init(): Promise<void> {
    this.ready ??= this.load();
    return this.ready;
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as SessionRecord[];
      if (Array.isArray(parsed)) {
        for (const record of parsed) {
          if (record?.code) this.sessions.set(record.code, record);
        }
      }
    } catch {
      // No snapshot yet, or it is unreadable — start clean rather than crash.
    }
  }

  /** Serialise writes per session so concurrent votes cannot interleave. */
  private withLock<T>(code: string, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.locks.get(code) ?? Promise.resolve();
    // Run whether or not the previous holder settled cleanly.
    const run = previous.then(fn, fn);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.locks.set(code, tail);
    void tail.then(() => {
      if (this.locks.get(code) === tail) this.locks.delete(code);
    });
    return run;
  }

  async create(record: SessionRecord): Promise<SessionRecord> {
    await this.init();
    this.sessions.set(record.code, record);
    this.scheduleFlush();
    return record;
  }

  async getByCode(code: string): Promise<SessionRecord | null> {
    await this.init();
    return this.sessions.get(code) ?? null;
  }

  async update<T>(code: string, mutator: Mutator<T>): Promise<UpdateResult<T> | null> {
    await this.init();
    return this.withLock(code, () => {
      const current = this.sessions.get(code);
      if (!current) return null;
      // Work on a clone, so a mutator that throws or aborts cannot leave a
      // half-applied session behind.
      const draft: SessionRecord = structuredClone(current);
      const value = mutator(draft);
      if (value === false) return null;
      draft.updatedAt = Date.now();
      draft.revision = (draft.revision ?? 0) + 1;
      this.sessions.set(code, draft);
      this.scheduleFlush();
      this.fanout(code);
      return { session: draft, value: value as T };
    });
  }

  async remove(code: string): Promise<void> {
    await this.init();
    this.sessions.delete(code);
    this.scheduleFlush();
    this.fanout(code);
  }

  async listCodes(): Promise<string[]> {
    await this.init();
    return [...this.sessions.keys()];
  }

  async subscribe(handler: (code: string) => void): Promise<() => void> {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  async publish(code: string): Promise<void> {
    this.fanout(code);
  }

  private fanout(code: string) {
    for (const handler of this.subscribers) {
      try {
        handler(code);
      } catch {
        // A broken subscriber must not stop the others.
      }
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 400);
    // Never hold the process open just to write a snapshot.
    this.flushTimer.unref?.();
  }

  private async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      try {
        const payload = JSON.stringify([...this.sessions.values()]);
        await mkdir(path.dirname(this.file), { recursive: true });
        // Write-then-rename: a crash mid-write cannot truncate the snapshot.
        const tmp = `${this.file}.${process.pid}.tmp`;
        await writeFile(tmp, payload, "utf8");
        await rename(tmp, this.file);
      } catch {
        // Persistence is best-effort; the in-memory copy stays authoritative.
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }
}
