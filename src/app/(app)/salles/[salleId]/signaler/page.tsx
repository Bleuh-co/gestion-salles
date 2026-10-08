import { notFound } from "next/navigation";
import { getLocal } from "@/lib/repo/locaux";
import { getSession } from "@/lib/auth-server";
import { peutNoter } from "@/lib/registre/notes";
import { SignalerTerrain } from "@/components/entretien/Terrain";
import { getConfigEntretien } from "@/lib/repo/entretien";

// Au téléphone, après le code QR : « Signaler un problème » (maquette V5).

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ salleId: string }>;
}

export default async function Page({ params }: Props) {
  const { salleId } = await params;
  const local = await getLocal(decodeURIComponent(salleId));
  if (!local) notFound();
  const [s, cfg] = await Promise.all([getSession(), getConfigEntretien()]);
  const ouvert = cfg.equipe.length > 0 || !!cfg.responsable;
  return <SignalerTerrain salleId={local.id} nomSalle={local.nomSalle || local.id} gestionnaire={peutNoter(s?.role)} ouvert={ouvert} />;
}
