import { SessionError } from "@/lib/session/service";

const NO_STORE = {
  "cache-control": "no-store, no-cache, must-revalidate",
} as const;

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: { ...NO_STORE, ...(init?.headers ?? {}) },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, { status });
}

/**
 * Turns thrown errors into a response. A known SessionError carries a safe,
 * user-facing message; anything else is logged server-side and reported
 * generically, so internals never reach a participant's phone.
 */
export function handleError(error: unknown): Response {
  if (error instanceof SessionError) {
    return fail(error.message, error.status);
  }
  console.error("[train-or-fire]", error);
  return fail("Something went wrong. Try again.", 500);
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null) throw new Error("bad body");
    return body as T;
  } catch {
    throw new SessionError("Invalid request.", 400);
  }
}

/** Participant credentials travel in headers, never in the URL. */
export function participantAuth(req: Request) {
  return {
    participantId: req.headers.get("x-participant-id") ?? "",
    secret: req.headers.get("x-participant-secret") ?? "",
  };
}

export function facilitatorAuth(req: Request): string {
  return req.headers.get("x-facilitator-token") ?? "";
}
