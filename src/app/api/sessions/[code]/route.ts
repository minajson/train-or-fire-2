import { handleError, json } from "@/lib/http";
import { getPublicState } from "@/lib/session/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Snapshot fallback: used on first paint and whenever the SSE stream drops. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const participantId = new URL(req.url).searchParams.get("participantId") ?? undefined;
    return json(await getPublicState(code, participantId));
  } catch (error) {
    return handleError(error);
  }
}
