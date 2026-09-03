import { facilitatorAuth, handleError, json, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { applyControl, getFacilitatorState, SessionError } from "@/lib/session/service";
import type { ControlCommand } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Facilitator-only view: adds per-stage progress and the unrevealed preview. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const token = facilitatorAuth(req);
    if (!token) throw new SessionError("Not authorised for this session.", 403);
    return json(await getFacilitatorState(code, token));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const token = facilitatorAuth(req);
    if (!token) throw new SessionError("Not authorised for this session.", 403);

    const limit = rateLimit(`control:${token.slice(0, 8)}`, 400, 60_000);
    if (!limit.ok) return json({ error: "Too many commands." }, { status: 429 });

    const { code } = await ctx.params;
    const body = await readJson<{ command?: ControlCommand }>(req);
    if (!body.command?.type) throw new SessionError("Missing command.", 400);

    const state = await applyControl(code, token, body.command);
    return json({ state });
  } catch (error) {
    return handleError(error);
  }
}
