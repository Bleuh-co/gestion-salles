"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { useJson } from "@/components/registre/commun";
import { BadgeRetard, BadgeStatut, jourCourt, type VueSalle } from "./commun";
import { SignalerForm } from "./SignalerForm";

// ============================================================
// Au téléphone, après le code QR d'une salle (lot 5) :
//  - « Signaler un problème » (V5) en plein écran ;
//  - « Faire l'entretien » (V6) : ce qui est à faire dans la salle,
//    chaque ligne ouvre l'intervention (liste, photo, « Terminé »).
// ============================================================

function Entete({ salleId, nomSalle, titre }: { salleId: string; nomSalle: string; titre: string }) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-1">
      <Link href={`/salles/${encodeURIComponent(salleId)}`} className="p-2 -ml-2 text-slate-500" aria-label={nomSalle}>
        <ArrowLeft className="w-5 h-5" />
      </Link>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{nomSalle}</div>
        <h1 className="text-lg font-bold text-chanv-terre">{titre}</h1>
      </div>
    </div>
  );
}

export function SignalerTerrain({ salleId, nomSalle, gestionnaire, ouvert = true }: { salleId: string; nomSalle: string; gestionnaire: boolean; ouvert?: boolean }) {
  const t = useT();
  const router = useRouter();
  return (
    <div className="max-w-md mx-auto space-y-4 pb-10">
      <Entete salleId={salleId} nomSalle={nomSalle} titre={t("signaler.titre")} />
      {!ouvert ? (
        <div className="card p-5 text-sm text-chanv-terre space-y-2">
          <p className="font-semibold">{t("signaler.fermeTitre")}</p>
          <p className="text-slate-600">{t("signaler.fermeTexte")}</p>
        </div>
      ) : (
      <div className="card p-4">
        <SignalerForm
          salleId={salleId}
          gestionnaire={gestionnaire}
          pleinEcran
          onClose={() => router.push(`/salles/${encodeURIComponent(salleId)}`)}
          onFait={(id) => router.push(`/entretien/interventions/${encodeURIComponent(id)}`)}
        />
      </div>
      )}
    </div>
  );
}

export function EntretienTerrain({ salleId, nomSalle }: { salleId: string; nomSalle: string }) {
  const t = useT();
  const locale = useLocale();
  const { data, erreur } = useJson<VueSalle & { moi: string }>(`/api/entretien/salles/${encodeURIComponent(salleId)}`);
  const ouvertes = (data?.interventions ?? [])
    .filter((iv) => ["a_assigner", "a_faire", "en_cours", "en_attente"].includes(iv.statut))
    .sort((a, b) => (b.retard ?? -999) - (a.retard ?? -999));
  const miennes = ouvertes.filter((iv) => data && iv.assignes.includes(data.moi));
  const autres = ouvertes.filter((iv) => !miennes.includes(iv));
  const ligne = (iv: (typeof ouvertes)[number]) => (
    <Link key={iv.id} href={`/entretien/interventions/${encodeURIComponent(iv.id)}`} className="section-card p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-chanv-terre">{iv.genre === "probleme" ? `« ${iv.description.slice(0, 80)} »` : iv.titre}</div>
        <div className="text-[12px] text-slate-500">{[iv.equipements, iv.echeance ? t("entretienSalle.prevueLe", { date: jourCourt(iv.echeance, locale) }) : null].filter(Boolean).join(" · ")}</div>
        <div className="flex gap-1.5 mt-1.5"><BadgeStatut statut={iv.statut} />{(iv.retard ?? 0) > 0 && <BadgeRetard retard={iv.retard} />}</div>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-400" />
    </Link>
  );
  return (
    <div className="max-w-md mx-auto space-y-4 pb-10">
      <Entete salleId={salleId} nomSalle={nomSalle} titre={t("terrain.faireEntretien")} />
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {!data && !erreur && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-chanv-terre" /></div>}
      {data && (
        <>
          {miennes.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("terrain.pourToi")}</h2>
              {miennes.map(ligne)}
            </section>
          )}
          {autres.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("terrain.dansLaSalle")}</h2>
              {autres.map(ligne)}
            </section>
          )}
          {!ouvertes.length && <p className="text-sm text-slate-500 text-center py-6">{t("terrain.rienAFaire")}</p>}
          <Link href={`/salles/${encodeURIComponent(salleId)}/signaler`} className="btn-ghost w-full justify-center border border-red-200 bg-red-50 text-red-700 py-3">
            <AlertTriangle className="w-4 h-4" /> {t("signaler.titre")}
          </Link>
        </>
      )}
    </div>
  );
}
