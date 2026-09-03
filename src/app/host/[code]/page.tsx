import { notFound } from "next/navigation";
import { FacilitatorApp } from "@/components/host/FacilitatorApp";
import { normalizeCode } from "@/lib/session/service";

export const metadata = { title: "Train or Fire — Facilitator" };
export const dynamic = "force-dynamic";

export default async function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = normalizeCode(code);
  if (clean.length !== 4) notFound();
  return <FacilitatorApp code={clean} />;
}
