"use client";

import { useEffect, useState } from "react";
import type { Employee } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { Loader2 } from "lucide-react";

const SHIFT_LABELS: Record<string, string> = { jour: "Jour ☀️", soir: "Soir 🌆", nuit: "Nuit 🌙" };
const STATUS_BADGE: Record<string, string> = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  pause: "bg-amber-100 text-amber-700",
};
const STATUS_LABELS: Record<string, string> = { present: "Présent", absent: "Absent", pause: "Pause" };

interface EmployeesPanelProps {
  usineId: string;
  salleId: string;
}

export function EmployeesPanel({ usineId, salleId }: EmployeesPanelProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/usines/${usineId}/salles/${salleId}/employees`)
      .then((r) => r.json())
      .then(setEmployees)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [usineId, salleId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-chanv-beige" /></div>;
  }

  if (employees.length === 0) {
    return <EmptyState icon="👤" title="Aucun employé" description="Aucun employé assigné à cette salle." />;
  }

  return (
    <div className="section-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-chanv-fibre text-left">
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Employé</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Poste</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Shift</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Statut</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const initials = `${emp.prenom[0]}${emp.nom[0]}`;
            return (
              <tr key={emp.id} className="border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-chanv-beige/40 flex items-center justify-center text-xs font-bold text-chanv-terre">
                      {initials}
                    </div>
                    <span className="font-medium text-chanv-terre">{emp.prenom} {emp.nom}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{emp.poste}</td>
                <td className="px-4 py-3 text-slate-600">{SHIFT_LABELS[emp.shift] || emp.shift}</td>
                <td className="px-4 py-3">
                  <span className={`badge text-xs ${STATUS_BADGE[emp.statut]}`}>
                    {STATUS_LABELS[emp.statut]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
