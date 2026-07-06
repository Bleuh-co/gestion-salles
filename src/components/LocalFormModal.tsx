"use client";

import { useEffect, useMemo, useState } from "react";
import type { Local, LocalStatut, LocalFormOptions } from "@/lib/types";
import { LOCAL_STATUT_LABELS, FAMILLE_SHORT } from "@/lib/types";
import { X, Loader2, Save, Lock, Plus } from "lucide-react";

// ============================================================
// Formulaire de création / édition d'une salle.
//
// - Création : tous les champs, code de salle libre (unique).
// - Édition : le code est verrouillé (immuable — QR imprimés,
//   plans et capteurs pointent dessus).
// - Les dropdowns sont générés dynamiquement depuis les valeurs
//   en usage + les listes configurées, avec « Autre valeur… »
//   pour saisir une nouvelle valeur à la volée.
// ============================================================

interface LocalFormModalProps {
  /** null = création ; sinon édition de ce local. */
  local: Local | null;
  options: LocalFormOptions;
  familleColors: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

const CUSTOM = "__custom__";

// ── Dropdown dynamique avec saisie libre ──
function SelectWithCustom({
  label,
  value,
  onChange,
  options,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
  placeholder?: string;
}) {
  // Mode saisie libre si la valeur courante n'est pas dans la liste
  const [customMode, setCustomMode] = useState(() => value !== "" && !options.includes(value));

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {customMode ? (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Nouvelle valeur…"}
            className="flex-1 text-sm border border-chanv-fibre rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setCustomMode(false);
              if (!options.includes(value)) onChange("");
            }}
            className="p-2 text-slate-400 hover:text-chanv-terre rounded-lg hover:bg-chanv-fibre/50"
            title="Revenir à la liste"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <select
          value={options.includes(value) ? value : ""}
          onChange={(e) => {
            if (e.target.value === CUSTOM) {
              onChange("");
              setCustomMode(true);
            } else {
              onChange(e.target.value);
            }
          }}
          className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={CUSTOM}>➕ Autre valeur…</option>
        </select>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export function LocalFormModal({
  local,
  options,
  familleColors,
  onClose,
  onSaved,
}: LocalFormModalProps) {
  const isEdit = local !== null;

  const [id, setId] = useState(local?.id ?? "");
  const [nomSalle, setNomSalle] = useState(local?.nomSalle ?? "");
  const [batiment, setBatiment] = useState(local?.batiment ?? "");
  const [etage, setEtage] = useState(local?.etage ?? "");
  const [famille, setFamille] = useState(local?.famille ?? "");
  const [idLicence, setIdLicence] = useState(local?.idLicence ?? "");
  const [licenceTouched, setLicenceTouched] = useState(isEdit);
  const [prod, setProd] = useState(local?.prod ?? false);
  const [vocation, setVocation] = useState(local?.vocation ?? "");
  const [conditions, setConditions] = useState(local?.conditions ?? "");
  const [statut, setStatut] = useState<LocalStatut>(local?.statut ?? "en_service");
  const [niveauAcces, setNiveauAcces] = useState(local?.niveauAcces ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ID Licence auto-suggéré depuis la famille tant que non modifié à la main
  useEffect(() => {
    if (!licenceTouched && famille) {
      setIdLicence(FAMILLE_SHORT[famille] || "");
    }
  }, [famille, licenceTouched]);

  // Fermer avec Échap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const familleColor = familleColors[famille] || "#94a3b8";
  const canSubmit = useMemo(
    () => id.trim() && batiment.trim() && etage.trim() && famille.trim() && !saving,
    [id, batiment, etage, famille, saving]
  );

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const fields = {
        nomSalle: nomSalle.trim(),
        batiment: batiment.trim(),
        etage: etage.trim(),
        famille: famille.trim(),
        idLicence: idLicence.trim(),
        prod,
        vocation: vocation.trim(),
        conditions: conditions.trim(),
        statut,
        niveauAcces: niveauAcces.trim(),
      };
      const res = isEdit
        ? await fetch(`/api/admin/locaux/${encodeURIComponent(local!.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields }),
          })
        : await fetch("/api/admin/locaux", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id.trim(), ...fields }),
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
          <div className="flex items-center gap-3">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black"
              style={{ backgroundColor: familleColor }}
            >
              {(FAMILLE_SHORT[famille] || famille || "?").charAt(0)}
            </span>
            <div>
              <h2 className="text-base font-bold text-chanv-terre">
                {isEdit ? `Modifier ${local!.nomSalle || local!.id}` : "Nouvelle salle"}
              </h2>
              {isEdit && (
                <p className="text-[11px] text-slate-400 font-mono">{local!.id}</p>
              )}
            </div>
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
          {/* ── Identité ── */}
          <Section title="Identité">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Code de salle <span className="text-red-400">*</span>
                {isEdit && <Lock className="inline w-3 h-3 ml-1 text-slate-300" />}
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value.toUpperCase())}
                disabled={isEdit}
                placeholder="ex. ZONE MULTI 18"
                className={`w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-chanv-beige/50 ${
                  isEdit ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""
                }`}
              />
              {isEdit ? (
                <p className="text-[10px] text-slate-400 mt-1">
                  Immuable — les QR imprimés et les plans pointent sur ce code.
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">
                  Définitif après création (QR codes, plans, capteurs).
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Nom commun
              </label>
              <input
                type="text"
                value={nomSalle}
                onChange={(e) => setNomSalle(e.target.value)}
                placeholder="ex. KOMBUCHANV (optionnel)"
                className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
              />
            </div>
            <SelectWithCustom
              label="Bâtiment"
              required
              value={batiment}
              onChange={setBatiment}
              options={options.batiments}
              placeholder="ex. BAT2"
            />
            <SelectWithCustom
              label="Étage"
              required
              value={etage}
              onChange={setEtage}
              options={options.etages}
              placeholder="ex. RDC"
            />
          </Section>

          {/* ── Classification ── */}
          <Section title="Classification">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Famille <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: familleColor }}
                />
                <select
                  value={famille}
                  onChange={(e) => setFamille(e.target.value)}
                  className="flex-1 text-sm border border-chanv-fibre rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
                >
                  <option value="">—</option>
                  {options.familles.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                ID Licence
              </label>
              <input
                type="text"
                value={idLicence}
                onChange={(e) => {
                  setLicenceTouched(true);
                  setIdLicence(e.target.value.toUpperCase());
                }}
                placeholder="ex. CAN"
                className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
              />
            </div>
            <SelectWithCustom
              label="Vocation"
              value={vocation}
              onChange={setVocation}
              options={options.vocations}
            />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={prod}
                  onChange={(e) => setProd(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-chanv-terre font-medium">
                  Salle de production
                </span>
              </label>
            </div>
          </Section>

          {/* ── État ── */}
          <Section title="État">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Statut <span className="text-red-400">*</span>
              </label>
              <select
                value={statut}
                onChange={(e) => setStatut(e.target.value as LocalStatut)}
                className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
              >
                {Object.entries(LOCAL_STATUT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <SelectWithCustom
              label="Niveau d'accès"
              value={niveauAcces}
              onChange={setNiveauAcces}
              options={options.niveauxAcces}
            />
            <SelectWithCustom
              label="Conditions ambiantes"
              value={conditions}
              onChange={setConditions}
              options={options.conditions}
            />
          </Section>

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
            {isEdit ? "Enregistrer" : "Créer la salle"}
          </button>
        </div>
      </div>
    </div>
  );
}
