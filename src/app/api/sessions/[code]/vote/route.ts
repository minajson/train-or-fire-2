import { handleError, json, participantAuth, readJson } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { SessionError, submitVote } from "@/lib/session/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VoteBody {
  questionId?: string;
  optionId?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { participantId, secret } = participantAuth(req);
    if (!participantId || !secret) throw new SessionError("Rejoin to vote.", 401);

    // Per-participant, so one noisy device cannot spend the room's budget.
    const limit = rateLimit(`vote:${participantId}`, 60, 60_000);
    if (!limit.ok) {
      return json({ error: "You're going a bit fast — try again in a moment." }, { status: 429 });
    }
    const ipLimit = rateLimit(clientKey(req, "vote-ip"), 900, 60_000);
    if (!ipLimit.ok) return json({ error: "Too many requests." }, { status: 429 });

    const { code } = await ctx.params;
    const body = await readJson<VoteBody>(req);
    if (!body.questionId) throw new SessionError("Missing decision.", 400);
    if (!body.optionId) throw new SessionError("Missing choice.", 400);

    const state = await submitVote(code, participantId, secret, body.questionId, body.optionId);
    return json({ state });
  } catch (error) {
    return handleError(error);
  }
}
