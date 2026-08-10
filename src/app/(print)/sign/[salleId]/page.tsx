import { notFound } from "next/navigation";
import { getLocal, getLocaux } from "@/lib/repo/locaux";
import { getServerT } from "@/lib/i18n-server";
import { SignPageClient } from "./SignClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ salleId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { salleId } = await params;
  const [local, t] = await Promise.all([
    getLocal(decodeURIComponent(salleId)),
    getServerT(),
  ]);
  if (!local) return { title: t("sign.metaNotFound") };
  return {
    title: t("sign.metaTitle", { name: local.nomSalle || local.id }),
    description: t("sign.metaDescription", { id: local.id }),
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
