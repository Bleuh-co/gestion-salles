"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { dateHeure, decrireLigne, type Formats, type T } from "@/lib/registre/libelles";
import { CATEGORIES_NOTE, MAX_TEXTE, type CategorieNote } from "@/lib/registre/notes";
import { heureDe, instantMontreal, jourDe } from "@/lib/registre/temps";
import type { LigneRegistre } from "@/lib/registre/types";
import { CLASSE_CHAMP, Champ, Fenetre } from "./Fenetre";

// ============================================================
// Gestes du lot 5, pour les gestionnaires et les administrateurs :
// ajouter une note (sur la fiche, ou au téléphone après le code QR)
// et justifier un écart. Rien ne s'efface : on corrige en ajoutant.
// ============================================================

async function poster(url: string, corps: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(d.error || `HTTP ${res.status}`), { code: d.code as string | undefined });
}

function messageErreur(e: unknown, t: T): string {
  const code = (e as { code?: string } | null)?.code;
  const k = `note.erreur.${code}`;
  if (code && t(k) !== k) return t(k);
  return e instanceof Error ? e.message : String(e);
}

/** Libellé d'un groupe de boutons (pas de <label> : il activerait le premier bouton). */
function Groupe({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={libelle}>
      <span className="block text-xs font-semibold text-slate-500 mb-1">{libelle}</span>
      {children}
    </div>
  );
}

const pastille = (actif: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
    actif ? "bg-chanv-terre text-white border-chanv-terre" : "bg-white text-slate-600 border-chanv-fibre hover:bg-chanv-fibre/50"
  }`;

function Pied({ erreur, envoi, pret, libelle, onClose, onValider }: {
  erreur: string | null;
  envoi: boolean;
  pret: boolean;
  libelle: string;
  onClose: () => void;
  onValider: () => void;
}) {
  const t = useT();
  return (
    <>
      {erreur && (
        <span className="mr-auto flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {erreur}
        </span>
      )}
      <button onClick={onClose} className="btn-ghost text-xs">{t("actifsSalle.annuler")}</button>
      <button onClick={onValider} disabled={!pret} className="btn-primary text-xs">
        {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
        {libelle}
      </button>
    </>
  );
}

export function NoteDialog({
  salleId,
  nomSalle,
  onClose,
  onFait,
}: {
  salleId: string;
  nomSalle: string;
  onClose: () => void;
  onFait: () => void;
}) {
  const t = useT();
  const [categorie, setCategorie] = useState<CategorieNote | null>(null);
  const [texte, setTexte] = useState("");
  const [plusTot, setPlusTot] = useState(false);
  const [jour, setJour] = useState(() => jourDe(Date.now()));
  const [heure, setHeure] = useState(() => heureDe(Date.now()));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const aujourdHui = jourDe(Date.now());
  const momentValide =
    !plusTot || (!!jour && /^\d{2}:\d{2}$/.test(heure) && instantMontreal(jour, heure) <= Date.now() + 60_000);
  const pret = !envoi && !!categorie && texte.trim().length > 0 && momentValide;

  const inscrire = async () => {
    if (!pret) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await poster(`/api/salles/${encodeURIComponent(salleId)}/notes`, {
        categorie,
        texte,
        ...(plusTot ? { jour, heure } : {}),
      });
      onFait();
    } catch (e) {
      setErreur(messageErreur(e, t));
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      titre={t("note.titre")}
      sousTitre={nomSalle}
      onClose={onClose}
      pied={<Pied erreur={erreur} envoi={envoi} pret={pret} libelle={t("note.inscrire")} onClose={onClose} onValider={inscrire} />}
    >
      <Groupe libelle={t("note.categorie")}>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES_NOTE.map((c) => (
            <button key={c} type="button" aria-pressed={categorie === c} onClick={() => setCategorie(c)} className={pastille(categorie === c)}>
              {t(`note.cat.${c}`)}
            </button>
          ))}
        </div>
      </Groupe>
      <Champ libelle={t("note.texte")}>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={3}
          maxLength={MAX_TEXTE}
          placeholder={t("note.exemple")}
          className={CLASSE_CHAMP}
        />
      </Champ>
      <Groupe libelle={t("note.quand")}>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={!plusTot} onClick={() => setPlusTot(false)} className={pastille(!plusTot)}>
            {t("note.maintenant")}
          </button>
          <button type="button" aria-pressed={plusTot} onClick={() => setPlusTot(true)} className={pastille(plusTot)}>
            {t("note.plusTot")}
          </button>
          {plusTot && (
            <span className="flex items-center gap-1.5">
              <input
                type="date"
                value={jour}
                max={aujourdHui}
                onChange={(e) => setJour(e.target.value)}
                className="border border-chanv-fibre rounded-lg px-2 py-1 bg-white text-xs"
                aria-label={t("note.jour")}
              />
              <input
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                className="border border-chanv-fibre rounded-lg px-2 py-1 bg-white text-xs"
                aria-label={t("note.heure")}
              />
            </span>
          )}
        </div>
        {!momentValide && <p className="text-[11px] text-red-600 mt-1">{t("note.erreur.quand")}</p>}
      </Groupe>
      <p className="text-[11px] text-slate-500">{t("note.aide")}</p>
    </Fenetre>
  );
}

export function JustifierDialog({
  salleId,
  ligne,
  f,
  onClose,
  onFait,
}: {
  salleId: string;
  ligne: LigneRegistre;
  f: Formats;
  onClose: () => void;
  onFait: () => void;
}) {
  const { t, locale } = f;
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const d = (ligne.details ?? {}) as Record<string, unknown>;
  const desc = decrireLigne({ ...ligne, details: { ...d, justifications: [] } }, f);
  const deja = (d.justifications as { texte: string; parNom: string; inscritA: number }[] | undefined) ?? [];
  const pret = !envoi && texte.trim().length > 0;

  const justifier = async () => {
    if (!pret) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await poster(`/api/salles/${encodeURIComponent(salleId)}/ecarts`, {
        sensorId: ligne.cible?.id,
        grandeur: d.grandeur,
        debut: ligne.t,
        texte,
      });
      onFait();
    } catch (e) {
      setErreur(messageErreur(e, t));
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      titre={t("ecart.titre")}
      sousTitre={dateHeure(ligne.t, locale)}
      onClose={onClose}
      pied={<Pied erreur={erreur} envoi={envoi} pret={pret} libelle={t("ecart.inscrire")} onClose={onClose} onValider={justifier} />}
    >
      <div className="section-card p-3 border-l-4 border-l-amber-400">
        <div className="text-sm text-chanv-terre">{desc.titre}</div>
        {desc.detail && <div className="text-xs text-slate-500 mt-0.5">{desc.detail}</div>}
      </div>
      {deja.length > 0 && (
        <div className="space-y-1">
          {deja.map((j, i) => (
            <p key={i} className="text-xs text-slate-600">
              {t("ligne.justifie", { nom: j.parNom, date: dateHeure(j.inscritA, locale), texte: j.texte })}
            </p>
          ))}
        </div>
      )}
      <Champ libelle={t("ecart.texte")}>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={3}
          maxLength={MAX_TEXTE}
          placeholder={t("ecart.exemple")}
          className={CLASSE_CHAMP}
        />
      </Champ>
      <p className="text-[11px] text-slate-500">{t("ecart.aide")}</p>
    </Fenetre>
  );
}
