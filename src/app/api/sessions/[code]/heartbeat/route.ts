import { handleError, json, participantAuth } from "@/lib/http";
import { heartbeat } from "@/lib/session/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { participantId, secret } = participantAuth(req);
    if (!participantId || !secret) return json({ ok: false }, { status: 401 });
    const { code } = await ctx.params;
    await heartbeat(code, participantId, secret);
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
