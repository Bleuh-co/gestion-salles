import { redirect, notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-server";
import { getUsine } from "@/lib/data";
import { RoomStatusBadge } from "@/components/RoomStatusBadge";
import { UsinePlanClient } from "@/components/UsinePlanClient";
import { MapPin, DoorOpen, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function UsineDetailPage({
  params,
}: {
  params: Promise<{ usineId: string }>;
}) {
  await requireSession();
  const { usineId } = await params;
  const usine = getUsine(usineId);

  if (!usine) notFound();

  return (
    <main>
      {/* Back link */}
      <Link
        href="/usines"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-chanv-terre transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Toutes les usines
      </Link>

      {/* Header */}
      <div className="section-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-chanv-terre">{usine.nom}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {usine.localisation}
              </span>
              <span className="flex items-center gap-1">
                <DoorOpen className="w-4 h-4" />
                {usine.nbSalles} salle{usine.nbSalles > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <RoomStatusBadge status={usine.statutGlobal} />
        </div>
      </div>

      {/* Floor plan */}
      {usine.salles.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <p className="text-lg">🏗️</p>
          <p className="mt-2">Cette usine n&apos;a pas encore de salles configurées</p>
        </div>
      ) : (
        <UsinePlanClient usine={usine} />
      )}
    </main>
  );
}
