# gestion-salles
Application de gestion des salles dans les usines du Groupe Chanv. ## Concept L'app organise les données par Usine → Salle. Chaque usine contient plusieurs salles. Chaque salle contient des capteurs, des employés, des appareils (devices), des équipements, et un historique d'événements. ## Pages ### /usines — Liste des usines - Affiche des cards pou

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

### Tests

`npm test` (node --test, sans dépendance) : rapprochement capteur → salle,
heures de Montréal, écarts, silences, résumés par jour, date de pose proposée
(relevés réels de la chambre froide), fichier Excel, notes et justifications,
reprise des actifs agricoles.
