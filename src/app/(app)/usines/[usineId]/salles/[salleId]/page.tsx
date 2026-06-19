import { requireSession } from "@/lib/auth-server";

export default async function SalleDetailPage({
  params,
}: {
  params: Promise<{ usineId: string; salleId: string }>;
}) {
  await requireSession();
  const { usineId, salleId } = await params;
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold mb-6">
        Fiche salle — {salleId} <span className="text-sm text-gray-400">({usineId})</span>
      </h1>
      <div className="card p-8 text-center text-gray-400">
        <p>🚧 Page en construction</p>
        <p className="text-sm mt-2">
          Header + onglets (SalleTabs : Capteurs, Employés, Appareils, Équipements, Historique,
          Statistiques) — voir Antigravity.md
        </p>
      </div>
    </main>
  );
}
