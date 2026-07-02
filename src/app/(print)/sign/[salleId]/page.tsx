import { notFound } from "next/navigation";
import { getLocal, getLocaux } from "@/lib/data";
import { loadLocalOverride, loadLocauxOverrides, mergeOverrides } from "@/lib/locaux-overrides";
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

  // Full list (overrides merged) for the second-panel picker.
  const overrides = await loadLocauxOverrides();
  const allLocaux = mergeOverrides(getLocaux(), overrides);

  return <SignPageClient local={local} allLocaux={allLocaux} />;
}
