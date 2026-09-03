import { handleError, json, readJson } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { createSession } from "@/lib/session/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Strips angle brackets and control characters from a facilitator-supplied title. */
function sanitizeTitle(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 80);
}

export async function POST(req: Request) {
  try {
    const limit = rateLimit(clientKey(req, "create"), 10, 60_000);
    if (!limit.ok) return json({ error: "Slow down a moment." }, { status: 429 });

    const body = await readJson<{ title?: string }>(req).catch(() => ({ title: undefined }));
    const session = await createSession(sanitizeTitle(body.title) || "Train or Fire");

    return json(
      { code: session.code, facilitatorToken: session.facilitatorToken, title: session.title },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
