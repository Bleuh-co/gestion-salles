import { notFound } from "next/navigation";
import { getLocal } from "@/lib/repo/locaux";
import { EntretienTerrain } from "@/components/entretien/Terrain";

// Au téléphone, après le code QR : « Faire l'entretien » — ce qui est à faire dans la salle (maquette V6).

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ salleId: string }>;
}

export default async function Page({ params }: Props) {
  const { salleId } = await params;
  const local = await getLocal(decodeURIComponent(salleId));
  if (!local) notFound();
  return <EntretienTerrain salleId={local.id} nomSalle={local.nomSalle || local.id} />;
}
