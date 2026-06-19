"use client";

import { useEffect, useState } from "react";
import type { Equipment } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Wrench, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; badge: string; label: string }> = {
  operationnel: { icon: CheckCircle, badge: "bg-green-100 text-green-700", label: "Opérationnel" },
  maintenance: { icon: Wrench, badge: "bg-blue-100 text-blue-700", label: "Maintenance" },
  hors_service: { icon: XCircle, badge: "bg-red-100 text-red-700", label: "Hors service" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function isOverdue(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

function isSoon(iso: string): boolean {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000; // 7 days
}

interface EquipmentPanelProps {
  usineId: string;
  salleId: string;
}

export function EquipmentPanel({ usineId, salleId }: EquipmentPanelProps) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/usines/${usineId}/salles/${salleId}/equipment`)
      .then((r) => r.json())
      .then(setEquipment)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [usineId, salleId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-chanv-beige" /></div>;
  }

  if (equipment.length === 0) {
    return <EmptyState icon="🔧" title="Aucun équipement" description="Aucun équipement enregistré dans cette salle." />;
  }

  return (
    <div className="space-y-3">
      {equipment.map((eq) => {
        const cfg = STATUS_CONFIG[eq.status] || STATUS_CONFIG.operationnel;
        const Icon = cfg.icon;
        const overdue = isOverdue(eq.prochainEntretien);
        const soon = isSoon(eq.prochainEntretien);

        return (
          <div key={eq.id} className="section-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-chanv-terre" />
                <div>
                  <div className="font-semibold text-chanv-terre text-sm">{eq.nom}</div>
                  <div className="text-xs text-slate-500">{eq.categorie} · {eq.modele}</div>
                </div>
              </div>
              <span className={`badge text-xs ${cfg.badge}`}>{cfg.label}</span>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 pl-8">
              <span>Dernier entretien : {formatDate(eq.dernierEntretien)}</span>
              <span className={`font-semibold ${overdue ? "text-red-600" : soon ? "text-amber-600" : "text-slate-500"}`}>
                {overdue ? (
                  <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> En retard — {formatDate(eq.prochainEntretien)}</span>
                ) : (
                  `Prochain : ${formatDate(eq.prochainEntretien)}`
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
