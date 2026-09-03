import { ParticipantApp } from "@/components/participant/ParticipantApp";
import { normalizeCode } from "@/lib/session/service";

export const dynamic = "force-dynamic";

export default async function ParticipantPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ParticipantApp code={normalizeCode(code)} />;
}
