# gestion-salles
Application de gestion des salles dans les usines du Groupe Chanv. ## Concept L'app organise les données par Usine → Salle. Chaque usine contient plusieurs salles. Chaque salle contient des capteurs, des employés, des appareils (devices), des équipements, et un historique d'événements. ## Pages ### /usines — Liste des usines - Affiche des cards pou

## Mise en ligne

Pousser `main` met en ligne : le déclencheur Cloud Build `gestion-salles-us-east1`
(région northamerica-northeast1) suit `cloudbuild.yaml` et déploie le service
Cloud Run `gestion-salles` de **us-east1**, celui de gestion-salles.chanv.com.
`dev` ne déploie plus rien (jusqu'au 6 octobre 2026, c'était lui).

L'ancienne adresse, le service `gestion-salles` de **northamerica-northeast1**,
ne sert plus l'app : elle renvoie vers gestion-salles.chanv.com en gardant le
chemin, parce que des affiches de salle imprimées depuis elle ont un code QR qui
y pointe. Elle se redéploie à la main, aucun déclencheur ne la suit :

```bash
gcloud run deploy gestion-salles --project=antigravity-20260107 \
  --region=northamerica-northeast1 --source=deploiement/ancienne-adresse \
  --port=8080 --clear-env-vars --clear-secrets --cpu-throttling \
  --memory=256Mi --max-instances=2
```

## Registre par salle

Chaque salle a un registre (onglet « Registre » de la fiche) : fiche modifiée,
actif entré, sorti ou déplacé, actif agricole ajouté ou déplacé (inscrit par
Demande d'achats), capteur posé ou retiré, écarts à la plage cible et leur
justification, capteur muet, notes faites sur place, exports. Il s'exporte en
Excel ou en version imprimable (PDF).

Qui fait quoi : toute personne qui voit la salle lit et exporte le registre ;
les gestionnaires (grade « Gestionnaire » du hub) et les administrateurs
ajoutent une note (fiche ou téléphone après le code QR) et justifient un
écart ; les administrateurs déplacent les actifs, changent les plages et
rattachent les capteurs. « Consulter » reste en lecture seule.

Données (Firestore) :

| Collection | Contenu |
|---|---|
| `registre_salles/{salle}/evenements` | lignes écrites (un déplacement s'inscrit dans les deux salles) ; ouverture le 1er accès (état de départ, reprise de `audit_logs`, puis des actifs agricoles déjà rattachés) ; notes et justifications d'écart ; lignes `item_*` écrites par Demande d'achats (formulaire-achat, `src/lib/registre-salles.ts`), même forme de ligne |
| `registre_meta/ouverture`, `registre_meta/items_agricoles` | étapes faites une seule fois (verrou, état) |
| `capteur_rattachements` | périodes datées « capteur, salle, du, au » ; changer de salle ferme la période précédente |
| `capteur_releves/{capteur}__{jour}` | relevés TempStick recopiés, un document par capteur et par jour de Montréal |
| `capteur_releves_etat/{capteur}` | dernier jour complet copié |
| `locaux.plageTempMin/Max`, `plageHumMin/Max`, `plageSeuil` | plage cible de la salle |

Les écarts, les silences et les résumés par jour se calculent à la lecture
(`src/lib/registre/mesures.ts`) : corriger une plage corrige le passé. Une
justification d'écart est une ligne écrite, datée du début de l'écart ; elle
s'affiche sur l'écart qu'elle recouvre (même capteur, même grandeur), et reste
lisible seule si l'écart disparaît (`src/lib/registre/notes.ts`).

### Copie de nuit des relevés

`POST /api/registre/copie` recopie les relevés de chaque capteur depuis sa
dernière copie complète (le premier passage remonte à la création du capteur).
Elle accepte un administrateur connecté ou un jeton OIDC de compte de service
(Cloud Scheduler). Sans tâche planifiée, les jours affichés sont recopiés au
passage ; la tâche de nuit garantit la copie même quand personne ne regarde.

```bash
gcloud scheduler jobs create http registre-salles-copie-nuit \
  --project=antigravity-20260107 --location=us-east1 \
  --schedule="0 2 * * *" --time-zone="America/Montreal" \
  --uri="https://gestion-salles-271227085398.us-east1.run.app/api/registre/copie" \
  --http-method=POST --headers=Content-Type=application/json --message-body='{}' \
  --oidc-service-account-email=271227085398-compute@developer.gserviceaccount.com \
  --oidc-token-audience="https://gestion-salles-271227085398.us-east1.run.app/api/registre/copie" \
  --attempt-deadline=300s
```

Comptes de service permis : variable `REGISTRE_COPIE_COMPTES` (liste séparée
par des virgules), sinon ceux du projet de production.

## Entretien des équipements

Plan plans-chanv du 7 octobre 2026 (« L'entretien des équipements dans
Gestion des Salles »). Le plan d'entretien vit ici ; chaque intervention
devient une tâche GANDALF qui porte une carte « Salle · Équipement ».

- **Règles** : un entretien qui revient, sur un ou plusieurs équipements (ou une
  salle), avec sa fréquence, sa prochaine échéance, qui fait, la preuve exigée
  et la liste de contrôle. Une seule occurrence ouverte par règle ; la tâche
  apparaît N jours avant l'échéance (30 pour une annuelle, 7 pour une mensuelle).
- **Interventions** : à assigner → à faire (tâche GANDALF) → en cours ⇄ en
  attente → à valider (avec la preuve) → validée, ou annulée. Fermer la tâche
  dans GANDALF la fait passer « à valider ». La validation inscrit la ligne au
  registre et planifie la suivante (depuis la date prévue, ou depuis la date
  faite, règle par règle).
- **Problèmes signalés** : depuis la fiche ou le téléphone après le code QR,
  avec une photo et une priorité de 0 à 5. L'équipe d'entretien est prévenue ;
  « C'est réglé » part à qui a signalé.
- **Avis** (tâche du matin, 7 h) : rappel à J−7 et le jour J, relance par le bot
  à J+1, escalade au responsable à J+7, résumé du lundi. Au plus un avis par
  tâche et par jour ; rien la fin de semaine, sauf une priorité 0 ou 1.
- **Écrans** : onglet « Entretien » de la salle, page d'un équipement
  (`/actifs/<id>`) et sa fiche de vie imprimable, section `/entretien`
  (calendrier, interventions, entretiens, équipe et listes, reprise de la GMAO),
  `/entretien/interventions/<id>`, et au téléphone `/salles/<code>/signaler`
  et `/salles/<code>/entretien`.

| Collection | Contenu |
|---|---|
| `entretien_regles` | règles d'entretien |
| `entretien_interventions` | miroir léger de chaque intervention et de sa tâche GANDALF (id d'une occurrence : `<règle>__<échéance>`) |
| `entretien_fiches/{actif}` | photos et documents d'un équipement |
| `entretien_reprise` | séance de reprise de la GMAO (lot 0) |
| `entretien_meta` | envois faits une seule fois (résumé du lundi) |
| `config/entretien` | responsable, équipe, personne par défaut de chaque métier, projet et listes GANDALF, listes de choix, interrupteurs |

Photos et preuves : seau privé `antigravity-20260107-gestion-salles`
(variable `ENTRETIEN_SEAU`), servi par `/api/fichiers/…` à toute personne connectée.

GANDALF (hub-chanv) : route machine `POST /api/tasks/service` avec
`integration: "salles"` (clé `GANDALF_NOTIF_KEY` = secret `NOTIF_API_KEY`), le
levier `system/migration_flags.overrides.salles = "gandalf"`, la carte
`app_card` sur la tâche, `POST /api/notifications` (avec `body_ai`) et
`POST /api/notifications/dm` pour le message du bot. Les gestes d'une personne
(terminer, rouvrir, commenter) passent par les routes du hub en son nom.

### Tâche du matin

```bash
gcloud scheduler jobs create http entretien-salles-matin \
  --project=antigravity-20260107 --location=us-east1 \
  --schedule="0 7 * * *" --time-zone="America/Montreal" \
  --uri="https://gestion-salles-271227085398.us-east1.run.app/api/entretien/quotidien" \
  --http-method=POST --headers=Content-Type=application/json --message-body='{}' \
  --oidc-service-account-email=271227085398-compute@developer.gserviceaccount.com \
  --oidc-token-audience="https://gestion-salles-271227085398.us-east1.run.app/api/entretien/quotidien" \
  --attempt-deadline=300s
```

Relancée le même jour, elle ne double rien. Un administrateur peut l'appeler à
la main, avec `{ "jour": "AAAA-MM-JJ" }` pour un essai.

### Tests

`npm test` (node --test, sans dépendance) : calendrier de l'entretien
(échéances, fenêtres, avis du jour), saisies d'une règle et d'un signalement,
reprise de la GMAO, retour après connexion ; rapprochement capteur → salle,
heures de Montréal, écarts, silences, résumés par jour, date de pose proposée
(relevés réels de la chambre froide), fichier Excel, notes et justifications,
reprise des actifs agricoles.
