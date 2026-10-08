"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { CLASSE_CHAMP, Champ, Fenetre } from "@/components/registre/Fenetre";
import { ChoixPersonne, envoyer, reduirePhoto } from "./commun";
import { useOptionsEntretien } from "./RegleDialog";

// ============================================================
// « Signaler un problème » (maquette V5) : depuis la fiche de la salle
// ou au téléphone après le code QR. Une phrase, une priorité, une
// photo ; l'équipe d'entretien est prévenue. Un gestionnaire peut
// aussi mettre l'équipement hors service et assigner tout de suite.
// ============================================================

interface Props {
  salleId: string | null;
  /** Équipement déjà choisi (page d'un équipement). */
  actifId?: string;
  gestionnaire: boolean;
  /** Plein écran (téléphone) plutôt que fenêtre. */
  pleinEcran?: boolean;
  onClose: () => void;
  onFait: (id: string) => void;
}

export function SignalerForm({ salleId: salleInitiale, actifId, gestionnaire, pleinEcran = false, onClose, onFait }: Props) {
  const t = useT();
  const options = useOptionsEntretien();
  const [salleId, setSalleId] = useState(salleInitiale ?? "");
  const [actif, setActif] = useState(actifId ?? "");
  const [description, setDescription] = useState("");
  const [priorite, setPriorite] = useState(3);
  const [photos, setPhotos] = useState<File[]>([]);
  const [horsService, setHorsService] = useState(false);
  const [assigner, setAssigner] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const champPhoto = useRef<HTMLInputElement>(null);

  const actifsSalle = useMemo(
    () => (options?.actifs ?? []).filter((a) => a.idSalle === salleId).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [options, salleId]
  );

  const ajouterPhotos = async (liste: FileList | null) => {
    if (!liste) return;
    const reduites = await Promise.all([...liste].slice(0, 4 - photos.length).map((f) => reduirePhoto(f)));
    setPhotos([...photos, ...reduites].slice(0, 4));
  };

  const envoyerSignalement = async () => {
    setErreur(null);
    const form = new FormData();
    form.set("salleId", salleId);
    form.set("description", description);
    form.set("priorite", String(priorite));
    if (actif) form.set("actifIds", actif);
    if (horsService) form.set("horsService", "1");
    if (assigner) form.set("assigner", assigner);
    for (const p of photos) form.append("photos", p);
    setEnvoi(true);
    const r = await envoyer<{ intervention: { id: string } }>("/api/entretien/interventions", "POST", form);
    setEnvoi(false);
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setFait(r.data.intervention.id);
  };

  const corps = fait ? (
    <div className="text-center py-6 space-y-3">
      <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
      <p className="font-semibold text-chanv-terre">{t("signaler.merci")}</p>
      <p className="text-sm text-slate-600">{t("signaler.equipePrevenue")}</p>
      <button onClick={() => onFait(fait)} className="btn-primary text-sm">{t("signaler.voir")}</button>
    </div>
  ) : (
    <div className="space-y-4">
      {!salleInitiale && (
        <Champ libelle={t("regle.salle")}>
          <select value={salleId} onChange={(e) => { setSalleId(e.target.value); setActif(""); }} className={CLASSE_CHAMP}>
            <option value="">{t("regle.choisirSalle")}</option>
            {(options?.salles ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.nomSalle ? `${s.nomSalle} (${s.id})` : s.id}</option>
            ))}
          </select>
        </Champ>
      )}
      <Champ libelle={t("signaler.equipement")}>
        <select value={actif} onChange={(e) => setActif(e.target.value)} className={CLASSE_CHAMP} disabled={!!actifId}>
          <option value="">{t("signaler.equipementAucun")}</option>
          {actifsSalle.map((a) => (
            <option key={a.id} value={a.id}>{a.nom}{a.matricule ? ` (${a.matricule})` : ""}</option>
          ))}
          {actifId && !actifsSalle.some((a) => a.id === actifId) && <option value={actifId}>{actifId}</option>}
        </select>
      </Champ>
      <Champ libelle={t("signaler.quoi")}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={t("signaler.quoiExemple")}
          className={CLASSE_CHAMP}
          autoFocus={!pleinEcran}
        />
      </Champ>
      <Champ libelle={t("signaler.priorite")}>
        <div className="grid grid-cols-1 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((p) => (
            <label key={p} className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${priorite === p ? "border-chanv-terre bg-chanv-fibre/50" : "border-chanv-fibre"}`}>
              <input type="radio" checked={priorite === p} onChange={() => setPriorite(p)} />
              <span className={p <= 1 ? "text-red-700 font-semibold" : ""}>{t(`signaler.p${p}`)}</span>
            </label>
          ))}
        </div>
      </Champ>
      <div>
        <span className="block text-xs font-semibold text-slate-500 mb-1">{t("signaler.photos")}</span>
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-chanv-fibre">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(p)} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5" aria-label={t("regle.retirer")}>
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {photos.length < 4 && (
            <button type="button" onClick={() => champPhoto.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-chanv-fibre flex flex-col items-center justify-center text-slate-500 text-[11px] gap-1">
              <Camera className="w-5 h-5" />
              {t("signaler.photo")}
            </button>
          )}
          <input ref={champPhoto} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => ajouterPhotos(e.target.files)} />
        </div>
      </div>
      {gestionnaire && (
        <>
          {actif && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={horsService} onChange={(e) => setHorsService(e.target.checked)} />
              {t("signaler.horsService")}
            </label>
          )}
          <Champ libelle={t("signaler.assigner")} aide={t("signaler.assignerAide")}>
            <ChoixPersonne valeur={assigner} onChange={setAssigner} placeholder={t("regle.chercherPersonne")} id="assigner-signalement" />
          </Champ>
        </>
      )}
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      <button
        onClick={envoyerSignalement}
        disabled={envoi || !salleId || description.trim().length < 3}
        className="btn-primary w-full py-3 text-base bg-red-700 hover:bg-red-800"
      >
        {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {t("signaler.envoyer")}
      </button>
    </div>
  );

  if (pleinEcran) return corps;
  return (
    <Fenetre titre={t("signaler.titre")} sousTitre={t("signaler.sousTitre")} onClose={onClose}>
      {corps}
    </Fenetre>
  );
}
