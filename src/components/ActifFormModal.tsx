"use client";

import { useEffect, useMemo, useState } from "react";
import type { Actif, Local } from "@/lib/types";
import { SelectWithCustom } from "@/components/LocalFormModal";
import { X, Loader2, Save, Plus, AlertTriangle } from "lucide-react";

// ============================================================
// Formulaire de création / édition d'un actif (équipement).
//
// - La salle desservie est un dropdown généré depuis les salles
//   existantes ; si l'actif pointe vers une salle inconnue
//   (donnée orpheline), un avertissement propose la réassignation.
// - Catégorie / statut sont des dropdowns dynamiques (valeurs en
//   usage) avec saisie libre.
// ============================================================

export interface ActifFormOptions {
  categories: string[];
  criticites: string[];
  statuts: string[];
}

interface ActifFormModalProps {
  /** null = création ; sinon édition de cet actif. */
  actif: Actif | null;
  salles: Local[];
  options: ActifFormOptions;
  onClose: () => void;
  onSaved: () => void;
}

export function ActifFormModal({
  actif,
  salles,
  options,
  onClose,
  onSaved,
}: ActifFormModalProps) {
  const isEdit = actif !== null;

  const [nom, setNom] = useState(actif?.nom ?? "");
  const [matricule, setMatricule] = useState(actif?.matricule ?? "");
  const [idMasterlist, setIdMasterlist] = useState(actif?.idMasterlist ?? "");
  const [marque, setMarque] = useState(actif?.marque ?? "");
  const [modele, setModele] = useState(actif?.modele ?? "");
  const [numSerie, setNumSerie] = useState(actif?.numSerie ?? "");
  const [idSalle, setIdSalle] = useState(actif?.idSalle ?? "");
  const [locauxDesservis, setLocauxDesservis] = useState(actif?.locauxDesservis ?? "");
  const [categorie, setCategorie] = useState(actif?.categorie ?? "");
  const [criticite, setCriticite] = useState(actif?.criticite ?? "");
  const [statut, setStatut] = useState(actif?.statut ?? "");
  const [dateInstall, setDateInstall] = useState(actif?.dateInstall ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sortedSalles = useMemo(
    () =>
      [...salles].sort((a, b) =>
        (a.nomSalle || a.id).localeCompare(b.nomSalle || b.id, "fr")
      ),
    [salles]
  );
  // Salle orpheline : l'actif pointe vers un code qui n'existe plus
  const salleInconnue = idSalle !== "" && !salles.some((s) => s.id === idSalle);

  const canSubmit = nom.trim() !== "" && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const fields = {
        nom: nom.trim(),
        matricule: matricule.trim(),
        idMasterlist: idMasterlist.trim(),
        marque: marque.trim(),
        modele: modele.trim(),
        numSerie: numSerie.trim(),
        idSalle: idSalle.trim(),
        locauxDesservis: locauxDesservis.trim(),
        categorie: categorie.trim(),
        criticite: criticite.trim(),
        statut: statut.trim(),
        dateInstall: dateInstall.trim(),
      };
      const res = isEdit
        ? await fetch(`/api/admin/actifs/${encodeURIComponent(actif!.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields }),
          })
        : await fetch("/api/admin/actifs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-chanv-fibre">
          <div>
            <h2 className="text-base font-bold text-chanv-terre">
              {isEdit ? `Modifier ${actif!.nom || actif!.id}` : "Nouvel actif"}
            </h2>
            {isEdit && (
              <p className="text-[11px] text-slate-400 font-mono">
                #{actif!.id} {actif!.matricule && `· ${actif!.matricule}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-chanv-terre rounded-lg hover:bg-chanv-fibre/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* ── Identification ── */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Identification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Nom <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="ex. BALANCE OHAUS VALOR 1000"
                  className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Matricule</label>
                <input
                  type="text"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                  placeholder="ex. CAN-PROD-141"
                  className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ID Masterlist</label>
                <input
                  type="text"
                  value={idMasterlist}
                  onChange={(e) => setIdMasterlist(e.target.value.toUpperCase())}
                  placeholder="ex. AGR-BAL001"
                  className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Marque</label>
                <input
                  type="text"
                  value={marque}
                  onChange={(e) => setMarque(e.target.value)}
                  className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Modèle</label>
                <input
                  type="text"
                  value={modele}
                  onChange={(e) => setModele(e.target.value)}
                  className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">N° de série</label>
                <input
                  type="text"
                  value={numSerie}
                  onChange={(e) => setNumSerie(e.target.value)}
                  className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
                />
              </div>
            </div>
          </div>

          {/* ── Localisation ── */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Localisation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Salle
                </label>
                <select
                  value={salleInconnue ? "" : idSalle}
                  onChange={(e) => setIdSalle(e.target.value)}
                  className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
                >
                  <option value="">— Aucune —</option>
                  {sortedSalles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nomSalle ? `${s.nomSalle} (${s.id})` : s.id}
                    </option>
                  ))}
                </select>
                {salleInconnue && (
                  <p className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    Salle actuelle « {idSalle} » introuvable — choisir une salle valide.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Autres locaux desservis
                </label>
                <input
                  type="text"
                  value={locauxDesservis}
                  onChange={(e) => setLocauxDesservis(e.target.value)}
                  placeholder="Codes séparés par des virgules"
                  className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
                />
              </div>
            </div>
          </div>

          {/* ── État ── */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Classification & état
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectWithCustom
                label="Catégorie"
                value={categorie}
                onChange={setCategorie}
                options={options.categories}
              />
              <SelectWithCustom
                label="Criticité"
                value={criticite}
                onChange={setCriticite}
                options={options.criticites}
              />
              <SelectWithCustom
                label="Statut"
                value={statut}
                onChange={setStatut}
                options={options.statuts}
              />
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Date d'installation
                </label>
                <input
                  type="date"
                  value={dateInstall}
                  onChange={(e) => setDateInstall(e.target.value)}
                  className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-chanv-fibre bg-chanv-fibre/20 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-chanv-terre rounded-xl hover:bg-chanv-fibre/50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-chanv-terre rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isEdit ? (
              <Save className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {isEdit ? "Enregistrer" : "Créer l'actif"}
          </button>
        </div>
      </div>
    </div>
  );
}
