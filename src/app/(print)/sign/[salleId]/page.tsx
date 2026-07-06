import { notFound } from "next/navigation";
import { getLocal, getLocaux } from "@/lib/repo/locaux";
import { SignPageClient } from "./SignClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ salleId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { salleId } = await params;
  const local = await getLocal(decodeURIComponent(salleId));
  if (!local) return { title: "Local introuvable" };
  return {
    title: `Panneau — ${local.nomSalle || local.id}`,
    description: `Panneau imprimable pour ${local.id}`,
  };
}

export default async function SignPage({ params }: Props) {
  const { salleId } = await params;
  const local = await getLocal(decodeURIComponent(salleId));
  if (!local) notFound();

  // Full list for the second-panel picker.
  const allLocaux = await getLocaux();

  return <SignPageClient local={local} allLocaux={allLocaux} />;
}
