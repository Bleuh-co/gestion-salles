import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocal, getActifsBySalle } from "@/lib/data";
import { FAMILLE_COLORS, FAMILLE_SHORT } from "@/lib/types";
import { LocalStatusBadge } from "@/components/LocalStatusBadge";
import { SalleTabs } from "@/components/SalleTabs";
import { ArrowLeft, QrCode, Building, Layers, DoorOpen, Thermometer, Shield, Tag, Factory } from "lucide-react";

interface Props {
  params: Promise<{ salleId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { salleId } = await params;
  const local = getLocal(decodeURIComponent(salleId));
  if (!local) return { title: "Local introuvable" };
  return {
    title: `${local.id} — Gestion Salles`,
    description: `Fiche du local ${local.id} — ${local.vocation}`,
  };
}

export default async function SalleDetailPage({ params }: Props) {
  const { salleId } = await params;
  const local = getLocal(decodeURIComponent(salleId));
  if (!local) notFound();

  const actifs = getActifsBySalle(local.id);
  const familleColor = FAMILLE_COLORS[local.famille] || "#94a3b8";
  const familleShort = FAMILLE_SHORT[local.famille] || local.idLicence;

  return (
    <div className="space-y-6 pt-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/salles" className="flex items-center gap-1 hover:text-chanv-terre transition-colors">
          <ArrowLeft className="w-3 h-3" />
          Locaux
        </Link>
        <span>/</span>
        <span className="text-chanv-terre font-medium">{local.id}</span>
      </div>

      {/* Header */}
      <div className="card p-6 flex flex-col sm:flex-row items-start gap-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold shrink-0"
          style={{ backgroundColor: familleColor }}
        >
          {familleShort}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-chanv-terre">{local.id}</h1>
            <LocalStatusBadge status={local.statut} />
          </div>
          {local.nomSalle && <p className="text-sm text-slate-500">{local.nomSalle}</p>}
          <p className="text-sm text-slate-600">{local.vocation}</p>
        </div>
        <Link
          href={`/salles/${encodeURIComponent(local.id)}/qr`}
          className="btn-primary flex items-center gap-2 shrink-0"
          target="_blank"
        >
          <QrCode className="w-4 h-4" />
          QR Code
        </Link>
      </div>

      {/* Tabs (Infos + Actifs) */}
      <SalleTabs actifs={actifs}>
        {/* This is the infos panel content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoCard icon={<Building className="w-4 h-4" />} label="Bâtiment" value={local.batiment} />
          <InfoCard icon={<Layers className="w-4 h-4" />} label="Étage" value={local.etage} />
          <InfoCard icon={<Tag className="w-4 h-4" />} label="Famille" value={local.famille} />
          <InfoCard icon={<DoorOpen className="w-4 h-4" />} label="ID Licence" value={local.idLicence} />
          <InfoCard icon={<Thermometer className="w-4 h-4" />} label="Conditions" value={local.conditions || "—"} />
          <InfoCard icon={<Shield className="w-4 h-4" />} label="Niveau d'accès" value={local.niveauAcces || "—"} />
          <InfoCard icon={<Factory className="w-4 h-4" />} label="Production" value={local.prod ? "Oui" : "Non"} />
        </div>
      </SalleTabs>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="section-card p-4 flex items-center gap-3">
      <div className="text-chanv-terre">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
        <div className="text-sm font-medium text-chanv-terre">{value}</div>
      </div>
    </div>
  );
}
