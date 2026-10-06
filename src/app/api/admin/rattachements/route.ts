import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getLocaux } from "@/lib/repo/locaux";
import { confirmerPeriode, rattacher } from "@/lib/repo/rattachements";
import { loadOverridesDetail } from "@/lib/sensor-match";
import { matchSensorToRoom } from "@/lib/sensor-match-core";
import { etatCapteurs } from "@/lib/registre/service";
import { periodeEnCours, periodesDuCapteur } from "@/lib/registre/rattachement";
import { estJour, instantMontreal, lireHeureUtc } from "@/lib/registre/temps";
import { auteurDe, reponseErreur, texteCourt } from "@/lib/registre/routes";
import { nomsPersonnes } from "@/lib/repo/personnes";

// ============================================================
// Administration › Capteurs : rattachement daté (V9, lot 0).
//
// GET  → capteurs, salle actuelle, périodes datées, salle proposée.
// POST { op: "rattacher", sensorId, salleId, jour, heure?, note? }
//      { op: "retirer",   sensorId, jour, heure?, note? }
//      { op: "confirmer", periodeId }
// ============================================================

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const [{ capteurs, periodes }, locaux, manuels] = await Promise.all([
      etatCapteurs(),
      getLocaux({ includeArchived: true }),
      loadOverridesDetail(),
    ]);
    const ids = locaux.map((l) => l.id);
    const parManuel = new Map(manuels.map((m) => [m.sensor_id, m]));
    const noms = await nomsPersonnes(manuels.map((m) => m.updated_by || ""));
    return NextResponse.json({
      salles: locaux
        .filter((l) => !l.archived)
        .map((l) => ({ id: l.id, nomSalle: l.nomSalle }))
        .sort((a, b) => (a.nomSalle || a.id).localeCompare(b.nomSalle || b.id, "fr")),
      capteurs: capteurs.map((c) => {
        const m = parManuel.get(c.sensor_id);
        const enCours = periodeEnCours(periodes, c.sensor_id);
        return {
          sensorId: c.sensor_id,
          nom: c.sensor_name || c.sensor_id,
          provider: c.provider,
          cree: lireHeureUtc(c.created_utc ?? null),
          intervalleS: c.send_interval_s ?? null,
          enLigne: !c.offline,
          batterie: c.battery,
          derniereC: c.last_temp_c,
          derniereH: c.last_humidity,
          derniereA: c.last_checkin_utc,
          salleId: c.matched_local_id,
          source: c.match_source,
          retire: Boolean(m?.retire),
          manuel: m ? { par: m.updated_by ?? "", parNom: noms.get(m.updated_by ?? "") ?? "", at: m.updated_at ?? "" } : null,
          salleProposee: c.matched_local_id ? null : matchSensorToRoom(c.sensor_name || "", ids),
          enCours,
          periodes: periodesDuCapteur(periodes, c.sensor_id),
        };
      }),
    });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const par = await auteurDe(session);

    if (body.op === "confirmer") {
      if (typeof body.periodeId !== "string") return NextResponse.json({ error: "periodeId requis" }, { status: 400 });
      const p = await confirmerPeriode(body.periodeId, par);
      return NextResponse.json({ status: "success", periode: p });
    }

    if (body.op !== "rattacher" && body.op !== "retirer") {
      return NextResponse.json({ error: "op attendue : rattacher, retirer ou confirmer" }, { status: 400 });
    }
    const sensorId = typeof body.sensorId === "string" ? body.sensorId.trim() : "";
    if (!sensorId || sensorId.length > 200) return NextResponse.json({ error: "sensorId requis" }, { status: 400 });
    if (!estJour(body.jour)) return NextResponse.json({ error: "jour attendu (AAAA-MM-JJ)" }, { status: 400 });
    const heure = typeof body.heure === "string" && /^\d{2}:\d{2}$/.test(body.heure) ? body.heure : "00:00";
    const du = instantMontreal(body.jour, heure);
    if (du > Date.now() + 60_000) return NextResponse.json({ error: "La date ne peut pas être dans le futur" }, { status: 400 });

    let salleId: string | null = null;
    if (body.op === "rattacher") {
      salleId = typeof body.salleId === "string" ? body.salleId.trim() : "";
      const salles = await getLocaux({ includeArchived: true });
      if (!salleId || !salles.some((l) => l.id === salleId)) {
        return NextResponse.json({ error: `Salle « ${salleId} » introuvable` }, { status: 400 });
      }
    }
    const { capteurs } = await etatCapteurs();
    const c = capteurs.find((x) => x.sensor_id === sensorId);
    const res = await rattacher({
      sensorId,
      sensorName: c?.sensor_name || body.sensorName || sensorId,
      provider: c?.provider,
      salleId,
      du,
      par,
      note: texteCourt(body.note, 300) ?? "",
    });
    return NextResponse.json({ status: "success", periodes: res.apres });
  } catch (e) {
    return reponseErreur(e);
  }
}
