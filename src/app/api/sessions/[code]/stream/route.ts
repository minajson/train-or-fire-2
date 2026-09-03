import { buildFacilitatorState, buildPublicState } from "@/lib/engine/state";
import { facilitatorAuth, handleError } from "@/lib/http";
import { getHub } from "@/lib/realtime/hub";
import { safeEqual } from "@/lib/security/ids";
import { getSession, normalizeCode } from "@/lib/session/service";
import type { SessionRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEEPALIVE_MS = 25_000;

/**
 * The live spine: one long-lived SSE connection per open screen. Participants,
 * facilitator and projector all read from here, so the three surfaces cannot
 * drift apart.
 *
 * Consumed with fetch + ReadableStream rather than EventSource, so credentials
 * travel in headers instead of the URL — nothing sensitive ends up in browser
 * history, proxy logs, or a photo of the projector's address bar.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code: raw } = await ctx.params;
    const code = normalizeCode(raw);
    const session = await getSession(code);

    const participantId = req.headers.get("x-participant-id") ?? undefined;
    const token = facilitatorAuth(req);
    const isFacilitator = Boolean(token) && safeEqual(session.facilitatorToken, token);

    const serialize = (record: SessionRecord) =>
      isFacilitator ? buildFacilitatorState(record) : buildPublicState(record, { participantId });

    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;
    let keepalive: NodeJS.Timeout | null = null;
    let closed = false;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const cleanup = () => {
          if (closed) return;
          closed = true;
          unsubscribe?.();
          if (keepalive) clearInterval(keepalive);
          try {
            controller.close();
          } catch {
            // Already closed by the platform.
          }
        };

        const send = (event: string, data: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            cleanup();
          }
        };

        // Tell the client how long to wait before retrying if we drop.
        controller.enqueue(encoder.encode("retry: 2000\n\n"));
        send("state", serialize(session));

        unsubscribe = await getHub().subscribe(code, (record) => send("state", serialize(record)));

        keepalive = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            cleanup();
          }
        }, KEEPALIVE_MS);
        keepalive.unref?.();

        req.signal.addEventListener("abort", cleanup);
        if (req.signal.aborted) cleanup();
      },
      cancel() {
        closed = true;
        unsubscribe?.();
        if (keepalive) clearInterval(keepalive);
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-transform",
        connection: "keep-alive",
        // Stops nginx and friends buffering the stream into uselessness.
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
