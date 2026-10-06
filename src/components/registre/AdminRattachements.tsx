"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, RefreshCw, Sparkles, Wifi, WifiOff } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { dateCourte, dateHeure, nombre } from "@/lib/registre/libelles";
import type { Periode } from "@/lib/registre/rattachement";
import { heureDe, jourDe, lireHeureUtc } from "@/lib/registre/temps";
import { EmptyState } from "@/components/EmptyState";
import { CourbeSvg, COULEUR_TEMP } from "./CourbeSvg";
import { useJson } from "./commun";

// ============================================================
// Administration › Capteurs : rattachement daté (V9, lot 0).
// Les capteurs à rattacher ou dont la date de pose est à confirmer
// passent en tête. Rattacher se fait à partir d'une date : le passé
// du capteur reste dans la salle où il était.
// ============================================================

interface CapteurAdmin {
  sensorId: string;
  nom: string;
  cree: number | null;
  intervalleS: number | null;
  enLigne: boolean;
  batterie: number | null;
  derniereC: number | null;
  derniereH: number | null;
  derniereA: string | null;
  salleId: string | null;
  source: "auto" | "override" | "none";
  retire: boolean;
  manuel: { par: string; parNom: string; at: string } | null;
  salleProposee: string | null;
  enCours: Periode | null;
  periodes: Periode[];
}

interface Reponse {
  salles: { id: string; nomSalle: string }[];
  capteurs: CapteurAdmin[];
}

interface Proposition {
  cree: number | null;
  propose: number | null;
  releves: number;
  jours: { jour: string; min: number; max: number }[];
}

export function AdminRattachements({ search }: { search: string }) {
  const t = useT();
  const locale = useLocale();
  const { data, chargement, erreur, recharger } = useJson<Reponse>("/api/admin/rattachements");
  const [copie, setCopie] = useState<{ etat: "en_cours" | "fait" | "erreur"; texte?: string } | null>(null);

  const filtres = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.capteurs ?? []).filter(
      (c) => !q || c.nom.toLowerCase().includes(q) || c.sensorId.toLowerCase().includes(q) || (c.salleId || "").toLowerCase().includes(q)
    );
  }, [data, search]);
  const aTraiter = filtres.filter((c) => !c.retire && (!c.salleId || !c.enCours?.confirme));
  const rattaches = filtres.filter((c) => !c.retire && c.salleId && c.enCours?.confirme);
  const retires = filtres.filter((c) => c.retire);
  const nbSalles = new Set(rattaches.map((c) => c.salleId)).size;

  const copier = async () => {
    setCopie({ etat: "en_cours" });
    try {
      const res = await fetch("/api/registre/copie", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok && !d.bilans) throw new Error(d.error || `HTTP ${res.status}`);
      const bilans = (d.bilans ?? []) as { jours: number; erreur?: string }[];
      setCopie({
        etat: bilans.some((b) => b.erreur) ? "erreur" : "fait",
        texte: t("adminRatt.copieBilan", {
          n: bilans.length,
          jours: bilans.reduce((s, b) => s + b.jours, 0),
          erreurs: bilans.filter((b) => b.erreur).length,
        }),
      });
    } catch (e) {
      setCopie({ etat: "erreur", texte: e instanceof Error ? e.message : String(e) });
    }
  };

  if (!data && chargement) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-chanv-terre" />
      </div>
    );
  }
  if (erreur && !data) {
    return (
      <div className="section-card p-6 text-center space-y-3">
        <p className="text-sm text-red-600">{erreur}</p>
        <button onClick={recharger} className="btn-ghost text-xs mx-auto">
          <RefreshCw className="w-3 h-3" /> {t("admin.retry")}
        </button>
      </div>
    );
  }
  if (!data) return null;
  if (!data.capteurs.length) return <EmptyState icon="🌡️" title={t("admin.emptySensorsTitle")} description={t("admin.emptySensorsDesc")} />;

  return (
    <div className={`space-y-6 ${chargement ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span>{t("adminRatt.resume", { n: data.capteurs.length, rattaches: rattaches.length, salles: nbSalles, aTraiter: aTraiter.length })}</span>
        <button onClick={copier} disabled={copie?.etat === "en_cours"} className="btn-ghost border border-chanv-fibre text-xs ml-auto">
          {copie?.etat === "en_cours" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {t("adminRatt.copier")}
        </button>
        <button onClick={recharger} className="text-xs text-slate-400 hover:text-chanv-terre flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> {t("admin.refresh")}
        </button>
      </div>
      {copie?.texte && <p className={`text-xs ${copie.etat === "erreur" ? "text-amber-700" : "text-green-700"}`}>{copie.texte}</p>}
      <p className="text-[11px] text-slate-500">{t("adminRatt.aide")}</p>

      <Section titre={t("adminRatt.aTraiter", { n: aTraiter.length })}>
        {aTraiter.map((c) => (
          <LigneCapteur key={c.sensorId} c={c} salles={data.salles} onFait={recharger} locale={locale} />
        ))}
        {!aTraiter.length && <p className="text-xs text-slate-400 p-3">{t("adminRatt.rienATraiter")}</p>}
      </Section>

      <Section titre={t("adminRatt.rattaches", { n: rattaches.length, salles: nbSalles })}>
        {rattaches.map((c) => (
          <LigneCapteur key={c.sensorId} c={c} salles={data.salles} onFait={recharger} locale={locale} />
        ))}
      </Section>

      {retires.length > 0 && (
        <Section titre={t("adminRatt.retires", { n: retires.length })}>
          {retires.map((c) => (
            <LigneCapteur key={c.sensorId} c={c} salles={data.salles} onFait={recharger} locale={locale} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{titre}</h3>
      <div className="section-card divide-y divide-chanv-fibre">{children}</div>
    </div>
  );
}

function LigneCapteur({ c, salles, onFait, locale }: { c: CapteurAdmin; salles: Reponse["salles"]; onFait: () => void; locale: string }) {
  const t = useT();
  const depart = c.enCours?.du ?? c.cree ?? Date.now();
  const [salle, setSalle] = useState(c.salleId ?? c.salleProposee ?? "");
  const [jour, setJour] = useState(jourDe(depart));
  const [heure, setHeure] = useState(heureDe(depart));
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [prop, setProp] = useState<Proposition | null>(null);
  const [propEnCours, setPropEnCours] = useState(false);
  const nom = (id: string | null) => {
    if (!id) return t("registre.salleInconnue");
    const s = salles.find((x) => x.id === id);
    return s?.nomSalle ? `${id} · ${s.nomSalle}` : id;
  };
  const inchange =
    !!c.enCours && c.enCours.salleId === salle && jourDe(c.enCours.du) === jour && heureDe(c.enCours.du) === heure;

  const envoyer = async (corps: Record<string, unknown>) => {
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch("/api/admin/rattachements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      onFait();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(false);
    }
  };

  const proposer = async () => {
    setPropEnCours(true);
    try {
      const res = await fetch(`/api/admin/rattachements/proposition?sensorId=${encodeURIComponent(c.sensorId)}`);
      const d = (await res.json()) as Proposition & { error?: string };
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setProp(d);
      setOuvert(true);
      const t0 = d.propose ?? d.cree;
      if (t0) {
        setJour(jourDe(t0));
        setHeure(heureDe(t0));
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setPropEnCours(false);
    }
  };

  // Périodes avec les trous « salle inconnue » depuis la création du capteur.
  const historique = useMemo(() => {
    const out: { du: number; au: number | null; salleId: string | null; p?: Periode }[] = [];
    let cur: number | null = c.cree ?? c.periodes[0]?.du ?? null;
    for (const p of c.periodes) {
      if (cur != null && p.du > cur + 60_000) out.push({ du: cur, au: p.du, salleId: null });
      out.push({ du: p.du, au: p.au, salleId: p.salleId, p });
      cur = p.au;
    }
    if (cur != null && c.periodes.length && c.periodes[c.periodes.length - 1].au != null) {
      out.push({ du: cur, au: null, salleId: null });
    }
    return out;
  }, [c]);

  const derniere = c.derniereA ? lireHeureUtc(c.derniereA) : null;

  return (
    <div className="p-3 space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        <button onClick={() => setOuvert(!ouvert)} className="mt-0.5 text-slate-400 hover:text-chanv-terre" aria-expanded={ouvert} aria-label={t("adminRatt.historique")}>
          {ouvert ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="min-w-[12rem] flex-1">
          <div className="flex items-center gap-2">
            {c.enLigne ? <Wifi className="w-3.5 h-3.5 text-green-600" /> : <WifiOff className="w-3.5 h-3.5 text-red-500" />}
            <span className="text-sm font-semibold text-chanv-terre">{c.nom}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {c.derniereC != null ? `${nombre(c.derniereC, locale)}°` : "—"}
            {c.derniereH != null && ` · ${nombre(c.derniereH, locale, 0)} %`}
            {derniere && ` · ${dateHeure(derniere, locale)}`}
            {!c.enLigne && ` · ${t("adminRatt.muet")}`}
          </div>
          <div className="text-[11px] text-slate-400">
            {c.salleId
              ? c.source === "override"
                ? t("adminRatt.aLaMain", { nom: c.manuel?.parNom || c.manuel?.par || "—", date: c.manuel?.at ? dateHeure(Date.parse(c.manuel.at), locale) : "—" })
                : t("adminRatt.parLeNom")
              : c.retire
                ? t("adminRatt.marqueRetire")
                : t("adminRatt.sansSalle")}
            {c.cree && ` · ${t("adminRatt.cree", { date: dateCourte(c.cree, locale) })}`}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] text-slate-400">
            {t("adminRatt.salle")}
            <select value={salle} onChange={(e) => setSalle(e.target.value)} className="block text-xs border border-chanv-fibre rounded-lg px-2 py-1.5 bg-white max-w-[15rem]">
              <option value="">{t("adminRatt.choisir")}</option>
              {salles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nomSalle ? `${s.nomSalle} (${s.id})` : s.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-slate-400">
            {t("adminRatt.depuis")}
            <span className="flex gap-1">
              <input type="date" value={jour} max={jourDe(Date.now())} onChange={(e) => setJour(e.target.value)} className="text-xs border border-chanv-fibre rounded-lg px-2 py-1 bg-white" />
              <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className="text-xs border border-chanv-fibre rounded-lg px-2 py-1 bg-white" />
            </span>
          </label>
          <button onClick={proposer} disabled={propEnCours} className="btn-ghost text-[11px] px-2 py-1.5" title={t("adminRatt.proposerAide")}>
            {propEnCours ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {t("adminRatt.proposer")}
          </button>
          {inchange && c.enCours && !c.enCours.confirme ? (
            <button onClick={() => envoyer({ op: "confirmer", periodeId: c.enCours!.id })} disabled={envoi} className="btn-primary text-[11px] px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t("adminRatt.confirmer")}
            </button>
          ) : (
            <button
              onClick={() => envoyer({ op: "rattacher", sensorId: c.sensorId, salleId: salle, jour, heure })}
              disabled={envoi || !salle || inchange}
              className="btn-primary text-[11px] px-3 py-1.5"
            >
              {t(c.salleId && c.salleId !== salle ? "adminRatt.changer" : "adminRatt.rattacher")}
            </button>
          )}
          {!c.retire && (
            <button
              onClick={() => {
                if (confirm(t("adminRatt.confirmerRetrait", { nom: c.nom }))) envoyer({ op: "retirer", sensorId: c.sensorId, jour, heure });
              }}
              disabled={envoi}
              className="btn-ghost text-[11px] px-2 py-1.5 text-slate-500"
            >
              {t("adminRatt.retirer")}
            </button>
          )}
        </div>
      </div>
      {erreur && <p className="text-xs text-red-600 pl-7">{erreur}</p>}
      {prop && (
        <p className="text-[11px] text-slate-600 pl-7">
          {prop.propose
            ? t("adminRatt.propositionMesures", { date: dateHeure(prop.propose, locale) })
            : t("adminRatt.propositionCreation", { date: prop.cree ? dateHeure(prop.cree, locale) : "—" })}
        </p>
      )}
      {ouvert && (
        <div className="pl-7 space-y-2">
          <div className="text-[11px] font-semibold text-slate-500">{t("adminRatt.historiqueDe", { nom: c.nom })}</div>
          {historique.length === 0 && <p className="text-[11px] text-slate-400">{t("adminRatt.aucunePeriode")}</p>}
          {historique.map((h, i) => (
            <div key={i} className="text-xs text-chanv-terre">
              <strong>
                {dateCourte(h.du, locale)} → {h.au ? dateCourte(h.au, locale) : t("adminRatt.aujourdhui")}
              </strong>{" "}
              : {nom(h.salleId)}
              {h.p && !h.p.confirme && <span className="text-amber-700"> · {t("adminRatt.aConfirmer")}</span>}
              {h.p && h.p.parNom && <span className="text-slate-400"> · {h.p.parNom}</span>}
              {!h.salleId && <span className="text-slate-400"> · {t("adminRatt.horsRegistre")}</span>}
            </div>
          ))}
          {prop && prop.jours.length > 1 && (
            <div className="max-w-xl">
              <div className="text-[10px] text-slate-400">{t("adminRatt.courbe")}</div>
              <CourbeSvg
                hauteur={120}
                du={Date.parse(`${prop.jours[0].jour}T12:00:00Z`)}
                au={Date.parse(`${prop.jours[prop.jours.length - 1].jour}T12:00:00Z`)}
                unite="°C"
                locale={locale}
                titre={t("adminRatt.courbe")}
                series={[
                  {
                    nom: c.nom,
                    couleur: COULEUR_TEMP,
                    points: [],
                    bande: prop.jours.map((j) => ({ t: Date.parse(`${j.jour}T16:00:00Z`), min: j.min, max: j.max })),
                    opaciteBande: 0.45,
                  },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
