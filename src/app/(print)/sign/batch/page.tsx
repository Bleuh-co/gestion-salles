import { getLocaux } from "@/lib/repo/locaux";
import { getFamilleColors } from "@/lib/repo/config";
import { BatchSignClient } from "./BatchSignClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Impression batch — Affiches de salles",
  description: "Sélectionnez plusieurs salles pour générer un PDF d'affiches imprimables.",
};

export default async function BatchSignPage() {
  const [allLocaux, familleColors] = await Promise.all([
    getLocaux(),
    getFamilleColors(),
  ]);

  return <BatchSignClient allLocaux={allLocaux} familleColors={familleColors} />;
}
