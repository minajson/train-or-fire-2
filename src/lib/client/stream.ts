"use client";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "closed";

export interface StreamOptions {
  participantId?: string | null;
  facilitatorToken?: string | null;
  onEvent: (event: string, data: unknown) => void;
  onConnection: (state: ConnectionState) => void;
  signal: AbortSignal;
}

/**
 * SSE client built on fetch rather than EventSource.
 *
 * EventSource cannot set request headers, which would force participant and
 * facilitator credentials into the query string. Reading the stream by hand
 * costs about forty lines and keeps credentials in headers.
 *
 * Reconnects with capped backoff, and immediately when a phone comes back from
 * sleep — the common case, since participants lock their screens during
 * discussion and unlock them for the next decision.
 */
export async function openSessionStream(code: string, options: StreamOptions): Promise<void> {
  const { signal, onEvent, onConnection } = options;
  let attempt = 0;

  const wake = () => {
    if (document.visibilityState === "visible") attempt = 0;
  };
  document.addEventListener("visibilitychange", wake);
  signal.addEventListener("abort", () => document.removeEventListener("visibilitychange", wake));

  while (!signal.aborted) {
    onConnection(attempt === 0 ? "connecting" : "reconnecting");

    try {
      const headers: Record<string, string> = { accept: "text/event-stream" };
      if (options.participantId) headers["x-participant-id"] = options.participantId;
      if (options.facilitatorToken) headers["x-facilitator-token"] = options.facilitatorToken;

      const res = await fetch(`/api/sessions/${encodeURIComponent(code)}/stream`, {
        headers,
        signal,
        cache: "no-store",
      });

      if (!res.ok || !res.body) {
        // 404/410 mean the session is gone — retrying forever helps nobody.
        if (res.status === 404 || res.status === 410) {
          onConnection("closed");
          return;
        }
        throw new Error(`stream ${res.status}`);
      }

      attempt = 0;
      onConnection("live");

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";

      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          dispatch(frame, onEvent);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch {
      if (signal.aborted) break;
    }

    if (signal.aborted) break;
    onConnection("reconnecting");
    attempt += 1;
    const backoff = Math.min(8000, 700 * 2 ** (attempt - 1)) + Math.random() * 300;
    await sleep(backoff, signal);
  }

  onConnection("closed");
}

function dispatch(frame: string, onEvent: (event: string, data: unknown) => void) {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue; // keepalive
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  if (dataLines.length === 0) return;
  try {
    onEvent(event, JSON.parse(dataLines.join("\n")));
  } catch {
    // Malformed frame — skip it; the next full state resyncs us.
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
