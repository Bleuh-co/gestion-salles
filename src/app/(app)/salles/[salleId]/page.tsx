import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocal, getActifsBySalle, getLocaux } from "@/lib/data";
import { FAMILLE_COLORS, FAMILLE_SHORT } from "@/lib/types";
import { LocalStatusBadge } from "@/components/LocalStatusBadge";
import { SalleTabs } from "@/components/SalleTabs";
import { listTempStickSensors, isTempStickConfigured } from "@/lib/tempstick";
import { matchAllSensors, getSensorsForRoom, loadOverrides } from "@/lib/sensor-match";
import { loadLocalOverride } from "@/lib/locaux-overrides";
import type { SensorReading } from "@/lib/types";
import { ArrowLeft, QrCode, Building, Layers, DoorOpen, Thermometer, Shield, Tag, Factory } from "lucide-react";

// Force dynamic rendering — Firestore overrides + TempStick API
export const dynamic = "force-dynamic";

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

async function fetchRoomSensors(localId: string): Promise<SensorReading[]> {
  if (!isTempStickConfigured()) return [];
  try {
    const allLocaux = getLocaux({ includeArchived: true });
    const localIds = allLocaux.map((l) => l.id);
    const [sensors, overrides] = await Promise.all([
      listTempStickSensors(),
      loadOverrides(),
    ]);
    const matched = matchAllSensors(sensors, localIds, overrides);
    return getSensorsForRoom(matched, localId).map((s) => ({
      sensor_id: s.sensor_id,
      sensor_name: s.sensor_name,
      last_temp_c: s.last_temp_c,
      last_humidity: s.last_humidity,
      last_checkin_utc: s.last_checkin_utc,
      offline: s.offline,
      battery: s.battery,
      match_source: s.match_source as "auto" | "override",
    }));
  } catch (e) {
    console.warn("[sensors] Failed to fetch for room", localId, e);
    return [];
  }
}

export default async function SalleDetailPage({ params }: Props) {
  const { salleId } = await params;
  const baseLocal = getLocal(decodeURIComponent(salleId));
  if (!baseLocal) notFound();

  // Merge Firestore overrides on top of static data
  const override = await loadLocalOverride(baseLocal.id);
  const local = override ? { ...baseLocal, ...override } : baseLocal;

  const actifs = getActifsBySalle(local.id);
  const sensors = await fetchRoomSensors(local.id);
  const familleColor = FAMILLE_COLORS[local.famille] || "#94a3b8";
  const familleShort = FAMILLE_SHORT[local.famille] || local.idLicence;

  // Best sensor reading for header badge (prefer online sensors)
  const liveSensor = sensors.find((s) => !s.offline) || sensors[0] || null;

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
            <h1 className="text-xl font-bold text-chanv-terre">{local.nomSalle || local.id}</h1>
            <LocalStatusBadge status={local.statut} />
            {/* Live sensor badge */}
            {liveSensor && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                style={{
                  background: liveSensor.offline ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
                  borderColor: liveSensor.offline ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)",
                  color: liveSensor.offline ? "#dc2626" : "#16a34a",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: liveSensor.offline ? "#ef4444" : "#22c55e",
                  }}
                />
                {liveSensor.last_temp_c != null && (
                  <span>{liveSensor.last_temp_c.toFixed(1)}°</span>
                )}
                {liveSensor.last_humidity != null && (
                  <span className="text-blue-500">{Math.round(liveSensor.last_humidity)}%</span>
                )}
                {liveSensor.offline && <span>Hors ligne</span>}
              </div>
            )}
          </div>
          {local.nomSalle && <p className="text-sm text-slate-500">{local.id}</p>}
          <p className="text-sm text-slate-600">{local.vocation}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/sign/${encodeURIComponent(local.id)}`}
            className="btn-ghost flex items-center gap-2 border border-chanv-fibre"
            target="_blank"
          >
            <QrCode className="w-4 h-4" />
            QR
          </Link>
        </div>
      </div>

      {/* Tabs (Infos + Actifs + Capteurs) */}
      <SalleTabs actifs={actifs} sensors={sensors}>
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
