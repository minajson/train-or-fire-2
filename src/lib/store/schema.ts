import "server-only";

/**
 * TRAIN OR FIRE — Postgres schema.
 *
 * Inlined as a string rather than read from `src/lib/store/schema.sql` at
 * runtime. On Vercel the source tree is not part of the serverless bundle, so
 * a driver that reads its own schema off disk boots fine locally and then
 * throws ENOENT the first time production touches the database. The schema is
 * small enough that shipping it as a constant costs nothing.
 *
 * A live session is one small, hot document that is always read and written in
 * full, so it is stored as a single jsonb row. Splitting it across normalised
 * tables would buy nothing and cost a join on every broadcast. The generated
 * columns keep the two things we actually query — revision and status —
 * indexed and cheap to read without parsing the document.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tof_sessions (
  code              text PRIMARY KEY,
  id                uuid NOT NULL,
  facilitator_token text NOT NULL,
  data              jsonb NOT NULL,
  revision          bigint GENERATED ALWAYS AS ((data ->> 'revision')::bigint) STORED,
  status            text   GENERATED ALWAYS AS (data ->> 'status') STORED,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tof_sessions_updated_at_idx ON tof_sessions (updated_at DESC);
CREATE INDEX IF NOT EXISTS tof_sessions_status_idx     ON tof_sessions (status);

-- Cross-instance realtime fan-out. Every write NOTIFYs the session code; app
-- instances LISTEN and push the new state down their open SSE connections.
--
-- This is the fast path only. It requires a session-mode (direct) connection,
-- and a transaction-mode pooler silently drops LISTEN, so the driver also runs
-- a revision poll for the codes it is actually serving. Correctness does not
-- depend on this trigger firing.
CREATE OR REPLACE FUNCTION tof_notify() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('tof_sessions', COALESCE(NEW.code, OLD.code));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tof_sessions_notify ON tof_sessions;
CREATE TRIGGER tof_sessions_notify
  AFTER INSERT OR UPDATE OR DELETE ON tof_sessions
  FOR EACH ROW EXECUTE FUNCTION tof_notify();
`;

/**
 * Sessions are ephemeral by design and nothing in a row identifies a person —
 * a vote carries an opaque per-session participant id and nothing else. Run
 * this periodically (pg_cron, or a scheduled function) to keep the table small:
 *
 *   DELETE FROM tof_sessions WHERE updated_at < now() - interval '30 days';
 */
export const RETENTION_SQL =
  "DELETE FROM tof_sessions WHERE updated_at < now() - interval '30 days'";
