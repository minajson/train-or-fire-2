"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ControlCommand,
  FacilitatorState,
  JoinMode,
  PublicSessionState,
} from "@/lib/types";
import { readStored, removeStored, useHydrated, useStoredValue, writeStored } from "./browser-state";
import { openSessionStream, type ConnectionState } from "./stream";

/* ------------------------------------------------------------------ */
/* Identity — opaque, per-session, stored only on the device           */
/* ------------------------------------------------------------------ */

export interface Identity {
  participantId: string;
  secret: string;
  mode: JoinMode;
}

const identityKey = (code: string) => `train-or-fire:participant:${code}`;
export const facilitatorKey = (code: string) => `train-or-fire:facilitator:${code}`;

function parseIdentity(raw: string | null): Identity | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Identity;
    return parsed.participantId && parsed.secret ? parsed : null;
  } catch {
    return null;
  }
}

export function readIdentity(code: string): Identity | null {
  if (typeof window === "undefined") return null;
  return parseIdentity(readStored(identityKey(code)));
}

export function clearIdentity(code: string) {
  removeStored(identityKey(code));
}

/* ------------------------------------------------------------------ */
/* Fetch helper                                                        */
/* ------------------------------------------------------------------ */

async function post<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || "Something went wrong. Try again.");
  return data;
}

/* ------------------------------------------------------------------ */
/* Live session subscription                                           */
/* ------------------------------------------------------------------ */

interface UseSessionStreamResult<T> {
  state: T | null;
  connection: ConnectionState;
  /** True once the very first frame has landed. */
  ready: boolean;
}

export function useSessionStream<T extends PublicSessionState = PublicSessionState>(
  code: string,
  opts: { participantId?: string | null; facilitatorToken?: string | null } = {},
): UseSessionStreamResult<T> {
  const [state, setState] = useState<T | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const { participantId, facilitatorToken } = opts;

  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();

    void openSessionStream(code, {
      participantId,
      facilitatorToken,
      signal: controller.signal,
      onConnection: setConnection,
      onEvent: (event, data) => {
        if (event !== "state") return;
        setState((previous) => {
          const next = data as T;
          // Frames can arrive out of order across a reconnect. Never move
          // backwards, or the projector would flicker to an older result.
          if (previous && next.revision < previous.revision) return previous;
          return next;
        });
      },
    });

    return () => controller.abort();
  }, [code, participantId, facilitatorToken]);

  return { state, connection, ready: state !== null };
}

/* ------------------------------------------------------------------ */
/* Participant                                                         */
/* ------------------------------------------------------------------ */

export interface ParticipantApi {
  identity: Identity | null;
  state: PublicSessionState | null;
  connection: ConnectionState;
  ready: boolean;
  joining: boolean;
  error: string | null;
  join: (mode: JoinMode) => Promise<void>;
  vote: (questionId: string, optionId: string) => Promise<void>;
  leave: () => void;
}

export function useParticipant(code: string): ParticipantApi {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Identity is read straight from storage rather than mirrored into state, so
  // a join in this tab and a rejoin in another both land without a stale copy.
  const hydrated = useHydrated();
  const stored = useStoredValue(identityKey(code));
  const identity = useMemo(() => parseIdentity(stored), [stored]);

  const { state, connection, ready } = useSessionStream(code, {
    participantId: hydrated ? (identity?.participantId ?? null) : null,
  });

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (identity) {
      headers["x-participant-id"] = identity.participantId;
      headers["x-participant-secret"] = identity.secret;
    }
    return headers;
  }, [identity]);

  const join = useCallback(
    async (mode: JoinMode) => {
      setJoining(true);
      setError(null);
      try {
        const existing = readIdentity(code);
        const result = await post<{ participantId: string; secret: string; mode: JoinMode }>(
          `/api/sessions/${encodeURIComponent(code)}/join`,
          {
            mode,
            participantId: existing?.participantId ?? null,
            secret: existing?.secret ?? null,
          },
        );
        writeStored(
          identityKey(code),
          JSON.stringify({
            participantId: result.participantId,
            secret: result.secret,
            mode: result.mode,
          } satisfies Identity),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not join.");
        throw e;
      } finally {
        setJoining(false);
      }
    },
    [code],
  );

  const vote = useCallback(
    async (questionId: string, optionId: string) => {
      setError(null);
      try {
        await post(
          `/api/sessions/${encodeURIComponent(code)}/vote`,
          { questionId, optionId },
          authHeaders,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send that.");
        throw e;
      }
    },
    [code, authHeaders],
  );

  const leave = useCallback(() => clearIdentity(code), [code]);

  // Presence ping. Quiet, and paused while the tab is hidden.
  useEffect(() => {
    if (!identity) return;
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      void fetch(`/api/sessions/${encodeURIComponent(code)}/heartbeat`, {
        method: "POST",
        headers: authHeaders,
        keepalive: true,
      }).catch(() => {});
    };
    ping();
    const timer = setInterval(ping, 45_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [code, identity, authHeaders]);

  return {
    identity: hydrated ? identity : null,
    state,
    connection,
    ready: ready && hydrated,
    joining,
    error,
    join,
    vote,
    leave,
  };
}

/* ------------------------------------------------------------------ */
/* Facilitator                                                         */
/* ------------------------------------------------------------------ */

export interface FacilitatorApi {
  state: FacilitatorState | null;
  connection: ConnectionState;
  ready: boolean;
  error: string | null;
  busy: boolean;
  send: (command: ControlCommand) => Promise<void>;
}

export function useFacilitator(code: string, token: string | null): FacilitatorApi {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(0);

  const { state, connection, ready } = useSessionStream<FacilitatorState>(code, {
    facilitatorToken: token,
  });

  const send = useCallback(
    async (command: ControlCommand) => {
      if (!token) return;
      pending.current += 1;
      setBusy(true);
      setError(null);
      try {
        await post(
          `/api/sessions/${encodeURIComponent(code)}/control`,
          { command },
          { "x-facilitator-token": token },
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Command failed.");
      } finally {
        pending.current -= 1;
        if (pending.current <= 0) setBusy(false);
      }
    },
    [code, token],
  );

  return { state, connection, ready, error, busy, send };
}
