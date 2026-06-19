"use client";

import type { Actif } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { Wrench, AlertTriangle, CheckCircle } from "lucide-react";

interface ActifsTableProps {
  actifs: Actif[];
}

const CRITICITE_STYLES: Record<string, { badge: string; icon: typeof CheckCircle }> = {
  Critique: { badge: "bg-red-100 text-red-700", icon: AlertTriangle },
  Majeur: { badge: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  Mineur: { badge: "bg-blue-100 text-blue-700", icon: Wrench },
};

export function ActifsTable({ actifs }: ActifsTableProps) {
  if (actifs.length === 0) {
    return (
      <EmptyState
        icon="🔧"
        title="Aucun actif"
        description="Aucun équipement enregistré dans ce local."
      />
    );
  }

  return (
    <div className="section-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chanv-fibre text-left">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Actif</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Catégorie</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Marque / Modèle</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Criticité</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Statut</th>
            </tr>
          </thead>
          <tbody>
            {actifs.map((actif) => {
              const crit = CRITICITE_STYLES[actif.criticite];
              return (
                <tr
                  key={actif.id}
                  className="border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-chanv-terre">{actif.nom}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{actif.matricule}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{actif.categorie || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {actif.marque || actif.modele
                      ? `${actif.marque}${actif.modele ? ` ${actif.modele}` : ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {actif.criticite ? (
                      <span className={`badge text-xs ${crit?.badge || "bg-slate-100 text-slate-600"}`}>
                        {actif.criticite}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${
                      actif.statut === "En Construction" ? "bg-amber-100 text-amber-700" :
                      actif.statut === "En Attente" ? "bg-slate-100 text-slate-600" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {actif.statut || "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
