import { notFound } from "next/navigation";
import { getLocal } from "@/lib/data";
import { loadLocalOverride } from "@/lib/locaux-overrides";
import { SignPageClient } from "./SignClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ salleId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { salleId } = await params;
  const local = getLocal(decodeURIComponent(salleId));
  if (!local) return { title: "Local introuvable" };
  return {
    title: `Panneau — ${local.nomSalle || local.id}`,
    description: `Panneau imprimable pour ${local.id}`,
  };
}

export default async function SignPage({ params }: Props) {
  const { salleId } = await params;
  const baseLocal = getLocal(decodeURIComponent(salleId));
  if (!baseLocal) notFound();

  const override = await loadLocalOverride(baseLocal.id);
  const local = override ? { ...baseLocal, ...override } : baseLocal;

  return <SignPageClient local={local} />;
}
