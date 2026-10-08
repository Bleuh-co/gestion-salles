import { ActifPage } from "@/components/entretien/ActifPage";

// La page d'un équipement (maquette V2).

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ actifId: string }>;
}

export default async function Page({ params }: Props) {
  const { actifId } = await params;
  return <ActifPage actifId={decodeURIComponent(actifId)} />;
}
