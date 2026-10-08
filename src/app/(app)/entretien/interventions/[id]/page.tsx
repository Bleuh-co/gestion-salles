import { InterventionPage } from "@/components/entretien/InterventionPage";

// Une intervention d'entretien (maquette V6) — ouverte depuis la carte de la
// tâche GANDALF, une notification, l'onglet Entretien ou le code QR.

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const hubUrl = process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com";
  return <InterventionPage id={decodeURIComponent(id)} hubUrl={hubUrl} />;
}
