import "server-only";
import { MemoryStore } from "./memory";
import { PostgresStore } from "./postgres";
import type { SessionStore } from "./types";

export type { SessionStore } from "./types";

declare global {
  var __trainOrFireStore: SessionStore | undefined;
}

/**
 * Postgres in production, the local snapshot store in development.
 *
 * The switch is the presence of TRAIN_FIRE_DATABASE_URL and nothing else, so a
 * developer with no database configured gets exactly the zero-setup behaviour
 * the app has always had, and a deployment that has one never silently falls
 * back to per-instance memory — which on Vercel would mean every instance
 * running its own private, divergent copy of the room.
 */
function build(): SessionStore {
  const url = process.env.TRAIN_FIRE_DATABASE_URL?.trim();
  return url ? new PostgresStore(url) : new MemoryStore();
}

/**
 * One store instance per process, held on `globalThis` so Next's dev-mode
 * module reloading does not spawn a second store — and with it a second,
 * divergent copy of every live session, or a second connection pool — on each
 * edit.
 */
export function getStore(): SessionStore {
  globalThis.__trainOrFireStore ??= build();
  return globalThis.__trainOrFireStore;
}

/** Which driver is live. Used by the health route and the facilitator console. */
export function storeDriver(): "memory" | "postgres" {
  return getStore().driver;
}
