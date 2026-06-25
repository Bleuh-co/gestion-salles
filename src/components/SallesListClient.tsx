"use client";

import { useState, useMemo } from "react";
import type { Local } from "@/lib/types";
import type { SensorSummary } from "@/app/(app)/salles/page";
import { LocalCard } from "@/components/LocalCard";
import { FamilleFilter } from "@/components/FamilleFilter";
import { EmptyState } from "@/components/EmptyState";
import { Search, SlidersHorizontal } from "lucide-react";

interface SallesListClientProps {
  locaux: Local[];
  familles: string[];
  etages: string[];
  sensorMap?: Record<string, SensorSummary>;
}

export function SallesListClient({ locaux, familles, etages, sensorMap }: SallesListClientProps) {
  const [selectedFamille, setSelectedFamille] = useState<string | null>(null);
  const [selectedEtage, setSelectedEtage] = useState<string | null>(null);
  const [selectedStatut, setSelectedStatut] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = locaux;
    if (selectedFamille) result = result.filter((l) => l.famille === selectedFamille);
    if (selectedEtage) result = result.filter((l) => l.etage.toUpperCase() === selectedEtage.toUpperCase());
    if (selectedStatut) result = result.filter((l) => l.statut === selectedStatut);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.id.toLowerCase().includes(q) ||
          l.nomSalle.toLowerCase().includes(q) ||
          l.vocation.toLowerCase().includes(q)
      );
    }
    return result;
  }, [locaux, selectedFamille, selectedEtage, selectedStatut, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un local (ID, nom, vocation)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-chanv-fibre bg-white text-sm focus:outline-none focus:ring-2 focus:ring-chanv-beige/50 focus:border-chanv-beige transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-ghost p-2.5 rounded-xl border ${showFilters ? "border-chanv-beige bg-chanv-fibre" : "border-chanv-fibre"}`}
          title="Filtres avancés"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Famille filter */}
      <FamilleFilter familles={familles} selected={selectedFamille} onSelect={setSelectedFamille} />

      {/* Advanced filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-chanv-fibre/30 border border-chanv-fibre">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Étage</label>
            <select
              value={selectedEtage || ""}
              onChange={(e) => setSelectedEtage(e.target.value || null)}
              className="text-sm px-3 py-1.5 rounded-lg border border-chanv-fibre bg-white"
            >
              <option value="">Tous</option>
              {etages.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Statut</label>
            <select
              value={selectedStatut || ""}
              onChange={(e) => setSelectedStatut(e.target.value || null)}
              className="text-sm px-3 py-1.5 rounded-lg border border-chanv-fibre bg-white"
            >
              <option value="">Tous</option>
              <option value="en_service">En Service</option>
              <option value="en_construction">En Construction</option>
              <option value="hors_service">Hors Service</option>
              <option value="en_qualification">En Qualification</option>
            </select>
          </div>
        </div>
      )}

      {/* Count */}
      <div className="text-sm text-slate-500">
        <strong className="text-chanv-terre">{filtered.length}</strong> local{filtered.length !== 1 ? "aux" : ""}{" "}
        {filtered.length < locaux.length && `sur ${locaux.length}`}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="Aucun local trouvé"
          description="Essayez de modifier vos filtres de recherche."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((local) => (
            <LocalCard key={local.id} local={local} sensorData={sensorMap?.[local.id]} />
          ))}
        </div>
      )}
    </div>
  );
}
