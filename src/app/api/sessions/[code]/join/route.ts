import { handleError, json, readJson } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { joinSession } from "@/lib/session/service";
import type { JoinMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface JoinBody {
  mode?: string;
  participantId?: string | null;
  secret?: string | null;
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    // Generous: a whole room joins from one office IP inside the same minute.
    const limit = rateLimit(clientKey(req, "join"), 400, 60_000);
    if (!limit.ok) {
      return json({ error: "Too many join attempts. Try again shortly." }, { status: 429 });
    }

    const { code } = await ctx.params;
    const body = await readJson<JoinBody>(req);
    const mode: JoinMode = body.mode === "online" ? "online" : "room";

    const result = await joinSession(code, mode, {
      participantId: body.participantId,
      secret: body.secret,
    });

    return json(result, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
}
