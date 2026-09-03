import type { SessionRecord } from "@/lib/types";

/**
 * Mutator contract: mutate the draft in place. Return `false` to abort the
 * write — nothing is persisted and nothing is broadcast.
 */
export type Mutator<T> = (draft: SessionRecord) => T | false;

export interface UpdateResult<T> {
  session: SessionRecord;
  value: T;
}

export interface SessionStore {
  readonly driver: "memory" | "postgres";
  init(): Promise<void>;
  create(record: SessionRecord): Promise<SessionRecord>;
  getByCode(code: string): Promise<SessionRecord | null>;
  /**
   * Read-modify-write under a per-session lock. Returns `null` when the
   * session does not exist or the mutator aborted.
   */
  update<T>(code: string, mutator: Mutator<T>): Promise<UpdateResult<T> | null>;
  remove(code: string): Promise<void>;
  listCodes(): Promise<string[]>;
  /** Fan-out of "this session changed", consumed by the realtime hub. */
  subscribe(handler: (code: string) => void): Promise<() => void>;
  publish(code: string): Promise<void>;
  /**
   * The codes this instance currently has open screens for.
   *
   * The hub calls this whenever its listener set changes. A driver that can
   * only learn about another instance's writes by asking — which is any driver
   * behind a transaction-mode pooler, where LISTEN is silently dropped — uses
   * it to poll exactly those codes and nothing else. Drivers that do not need
   * it (the local one, where every write is already in-process) ignore it.
   */
  setActiveCodes?(codes: string[]): void;
}
