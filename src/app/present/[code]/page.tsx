import { PresentationApp } from "@/components/present/PresentationApp";
import { normalizeCode } from "@/lib/session/service";

export const dynamic = "force-dynamic";

export default async function PresentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PresentationApp code={normalizeCode(code)} />;
}
