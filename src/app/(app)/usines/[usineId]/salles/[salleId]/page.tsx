import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-server";
import { getSalle, getUsine } from "@/lib/data";
import { RoomStatusBadge } from "@/components/RoomStatusBadge";
import { SalleTabs } from "@/components/SalleTabs";
import { ArrowLeft, QrCode, Maximize2, Users } from "lucide-react";
import Link from "next/link";

export default async function SalleDetailPage({
  params,
}: {
  params: Promise<{ usineId: string; salleId: string }>;
}) {
  await requireSession();
  const { usineId, salleId } = await params;
  const salle = getSalle(usineId, salleId);
  const usine = getUsine(usineId);

  if (!salle || !usine) notFound();

  return (
    <main>
      {/* Back link */}
      <Link
        href={`/usines/${usineId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-chanv-terre transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {usine.nom}
      </Link>

      {/* Header */}
      <div className="section-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-chanv-terre">{salle.nom}</h1>
              <RoomStatusBadge status={salle.statut} />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="badge-neutral">{salle.type}</span>
              <span className="flex items-center gap-1">
                <Maximize2 className="w-3.5 h-3.5" />
                {salle.superficie} m²
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Capacité {salle.capacite}
              </span>
            </div>
          </div>

          <Link
            href={`/usines/${usineId}/salles/${salleId}/qr`}
            target="_blank"
            className="btn-secondary flex items-center gap-2 shrink-0"
          >
            <QrCode className="w-4 h-4" />
            QR Code
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <SalleTabs usineId={usineId} salleId={salleId} />
    </main>
  );
}
