# Plan Architectural — 🚀 Gestion Salles

## 1. Résumé

Application interne de gestion des salles dans les usines du Groupe Chanv. Elle permet aux responsables d'usine et techniciens de visualiser l'état de chaque salle (capteurs temps réel, employés assignés, appareils IoT, équipements, historique) via un plan d'étage interactif et des fiches détaillées par onglets. Elle inclut la génération de QR codes imprimables pour accès rapide sur le terrain. Les données sont mockées (pas de Firestore dans cette version).

---

## 2. Pages (détaillé)

### `/usines` — Liste des usines
**Rôle** : point d'entrée, affiche toutes les usines en grille de cards.

**Composants** : `UsineCard` (× N), grille responsive.

**Interactions** :
- Hover sur une card : élévation visuelle.
- Clic sur une card → navigation `/usines/[usineId]`.

**États** :
- Loading : skeletons de cards (3-6 placeholders avec `.card` + animation pulse).
- Erreur : message centré + bouton "Réessayer".
- Vide : `EmptyState` "Aucune usine disponible".

**Data** : `fetch('/api/usines')` (Server Component possible pour le fetch initial).

---

### `/usines/[usineId]` — Fiche usine
**Rôle** : visualisation du plan d'étage interactif avec les salles colorées par statut.

**Composants** :
- Header usine (nom, localisation, badge statut global).
- `UsinePlanClient` (wrapper client) qui contient :
  - `FactoryFloorPlan` (SVG)
  - `FloorPlanLegend`
  - `RoomDrawer` (latéral, ouvert au clic d'une salle)

**Interactions** :
- Clic sur un rectangle de salle dans le SVG → ouvre `RoomDrawer` avec le résumé (fetch summary).
- Bouton "Voir fiche complète" dans le drawer → `/usines/[usineId]/salles/[salleId]`.
- Clic en dehors du drawer ou bouton fermer → ferme le drawer.

**États** :
- Loading : placeholder du plan (rectangle gris).
- Erreur : message + retour à `/usines`.
- Vide : "Cette usine n'a pas encore de salles configurées".
- Drawer loading : spinner dans le drawer pendant fetch summary.

**Data** : fetch initial `/api/usines/[usineId]` (Server Component) passé en prop à `UsinePlanClient`. Le drawer fetch `/api/usines/[usineId]/salles/[salleId]/summary` à la demande.

---

### `/usines/[usineId]/salles/[salleId]` — Fiche salle détail
**Rôle** : vue complète d'une salle avec navigation par onglets.

**Composants** :
- Header : nom, `RoomStatusBadge`, infos clés (type, superficie, capacité), bouton "QR" → ouvre `/qr`.
- `SalleTabs` (client) gérant 6 onglets, chacun rendant un panel.

**Onglets** :
1. Capteurs → `SensorReadingsPanel`
2. Employés → `EmployeesPanel`
3. Appareils → `DevicesPanel`
4. Équipements → `EquipmentPanel`
5. Historique → `RoomHistoryTimeline`
6. Statistiques → `RoomStatsPanel`

**Interactions** :
- Clic sur un onglet → change le panel actif (state local, pas de navigation).
- Chaque panel fetch ses propres données au montage (lazy).
- Bouton QR → ouvre la page `/qr` dans un nouvel onglet.

**États** :
- Loading header : skeleton.
- Erreur (salle introuvable) : 404 / message + retour.
- Chaque panel gère son loading/erreur/vide indépendamment.

**Data** : fetch initial salle `/api/usines/[usineId]/salles/[salleId]` (Server) pour le header. Panels fetch leurs endpoints respectifs.

---

### `/usines/[usineId]/salles/[salleId]/qr` — Page QR imprimable
**Rôle** : génère un QR code imprimable pointant vers la fiche salle.

**Composants** : `PrintableQRCode`.

**Layout** : minimal — **doit override le layout `(app)`** pour ne PAS afficher la NavBar/Sidebar. Utiliser un layout route-group dédié OU une route hors `(app)`. Recommandation : placer la page dans un sous-segment avec son propre `layout.tsx` minimal qui rend juste `{children}`.

**Interactions** :
- Bouton "Imprimer" → `window.print()`.
- QR généré côté client avec `qrcode` (toDataURL) à partir de l'URL absolue de la fiche.

**États** :
- Loading : "Génération du QR…".
- Erreur : message.

---

### `/salles` — Redirection
**Rôle** : point d'entrée principal (ROUTE_PRINCIPALE).

**Comportement** : `redirect('/usines')` (Server Component avec `redirect` de `next/navigation`).

---

## 3. Composants métier

### `UsineCard.tsx`
```typescript
interface UsineCardProps {
  usine: Pick<Usine, "id" | "nom" | "localisation" | "statutGlobal" | "nbSalles">;
}
```
**Comportement** : card cliquable (Link englobant) montrant nom, localisation (avec emoji 📍), nombre de salles, et `RoomStatusBadge` pour le statut global.
**Classes** : `.card` + `flex flex-col gap-2`, badge via `RoomStatusBadge`.

---

### `FactoryFloorPlan.tsx`
```typescript
interface FactoryFloorPlanProps {
  salles: Salle[];
  selectedSalleId: string | null;
  onSelectSalle: (salleId: string) => void;
}
```
**Comportement** : SVG `viewBox="0 0 800 500"`. Pour chaque salle, dessine un `<rect>` aux coords `floorPlan`, couleur de remplissage selon statut (voir mapping ci-dessous), bordure plus épaisse si sélectionnée. Texte `<text>` centré avec le nom. `onClick` sur le rect → `onSelectSalle(id)`. `cursor-pointer`, hover opacity.
**Mapping couleurs statut** (fill SVG inline) :
- normal → vert (`#22c55e`)
- alerte → ambre (`#f59e0b`)
- maintenance → bleu (`#3b82f6`)
- hors_service → rouge (`#ef4444`)

---

### `FloorPlanLegend.tsx`
```typescript
// Pas de props (statuts statiques)
```
**Comportement** : rangée de pastilles colorées + label pour chaque statut.
**Classes** : `flex flex-wrap gap-3`, chaque item `.badge-neutral` ou span custom avec pastille.

---

### `RoomDrawer.tsx`
```typescript
interface RoomDrawerProps {
  usineId: string;
  salleId: string | null;   // null = fermé
  onClose: () => void;
}
```
**Comportement** : panneau latéral fixé à droite (`fixed right-0 top-0 h-full w-96`), backdrop semi-transparent. Quand `salleId` change et non-null, fetch `/summary`. Rend `RoomSynthesisCard`. Bouton fermer (✕) et bouton "Voir fiche complète" (Link). Transition slide-in. Loading spinner pendant fetch.
**Classes** : conteneur `bg-white shadow-xl`, boutons `.btn-primary` / `.btn-ghost`.

---

### `RoomStatusBadge.tsx`
```typescript
interface RoomStatusBadgeProps {
  status: RoomStatus;
}
```
**Comportement** : badge texte localisé (Normal / Alerte / Maintenance / Hors service).
**Classes** :
- normal → `.badge-accent`
- alerte → `.badge-warning`
- maintenance → `.badge-neutral`
- hors_service → `.badge-warning` (avec texte "Hors service")

---

### `RoomSynthesisCard.tsx`
```typescript
interface RoomSynthesisCardProps {
  summary: RoomSummary;
}
```
**Comportement** : affiche nom, `RoomStatusBadge`, type, compteurs (employés, devices online/total, alertes), et les capteurs clés (mini-liste valeur+unité).
**Classes** : `.section-card`, grille de stats.

---

### `SalleTabs.tsx` (client)
```typescript
interface SalleTabsProps {
  usineId: string;
  salleId: string;
}
```
**Comportement** : barre d'onglets (`role="tablist"`), state `activeTab`. Rend conditionnellement le panel correspondant en lui passant `{ usineId, salleId }`. Onglet actif souligné/coloré.
**Classes** : onglets `.btn-ghost` (actif → `.btn-secondary`), conteneur `flex gap-2 border-b`.

---

### `EmptyState.tsx`
```typescript
interface EmptyStateProps {
  icon?: string;       // emoji
  title: string;
  description?: string;
}
```
**Comportement** : bloc centré réutilisable pour les listes vides.
**Classes** : `.card text-center py-12`, emoji large.

---

### `PrintableQRCode.tsx` (client)
```typescript
interface PrintableQRCodeProps {
  salle: Pick<Salle, "id" | "nom" | "usineId" | "type">;
  targetUrl: string;   // URL absolue de la fiche
}
```
**Comportement** : au montage, `QRCode.toDataURL(targetUrl)` → state dataUrl. Affiche le QR, le nom de la salle, l'usine, le type, et un bouton "Imprimer" (`window.print()`). Le bouton a `className="print:hidden"`.
**Classes** : centré, `.btn-primary` pour imprimer.

---

### `UsinePlanClient.tsx` (client)
```typescript
interface UsinePlanClientProps {
  usine: Usine;
}
```
**Comportement** : orchestrateur client. Détient le state `selectedSalleId`. Rend `FactoryFloorPlan` + `FloorPlanLegend` + `RoomDrawer`. Gère sélection/fermeture.

---

### Panels (tous clients, props `{ usineId: string; salleId: string }`)

**`SensorReadingsPanel.tsx`** — fetch `/readings`, grille de cards capteurs. Chaque card : icône type, label, valeur+unité grande, badge status (ok/warning/critical → `.badge-accent`/`.badge-warning`), barre min/max. Loading skeletons, vide → `EmptyState`.

**`EmployeesPanel.tsx`** — fetch `/employees`, liste/table. Colonnes : nom complet, poste, shift, statut (badge présent/absent/pause). Avatar par défaut (initiales) si pas d'avatar.

**`DevicesPanel.tsx`** — fetch `/devices`, liste. Pastille status online/offline/erreur, nom, type, IP, firmware, lastSeen relatif.

**`EquipmentPanel.tsx`** — fetch `/equipment`, liste. Nom, catégorie, modèle, status, prochain entretien (highlight si proche/dépassé).

**`RoomHistoryTimeline.tsx`** — fetch `/history`, timeline verticale triée desc. Chaque event : pastille colorée selon type, titre, description, auteur, timestamp formaté. Vide → `EmptyState`.

**`RoomStatsPanel.tsx`** — fetch `/stats`. KPIs en cards (uptime %, alertes 30j, interventions 30j, occupation moyenne, temp/humidité moyennes) + 2 mini graphiques de tendances (temp, humidité). Pour les graphiques : SVG sparkline maison OU `recharts` (voir dépendances — préférer SVG natif pour rester léger).

---

## 4. Routes API (détaillé)

Toutes les routes lisent depuis `src/lib/data.ts` (mock). Toutes retournent `404` si l'usine/salle est introuvable. Toutes sont `GET`.

### `GET /api/usines`
- **Input** : aucun.
- **Output** : `Usine[]` allégé (sans `salles` détaillées, juste `id, nom, localisation, statutGlobal, nbSalles`).
- **Logique** : `getUsines().map(u => ({...sans salles}))`.

### `GET /api/usines/[usineId]`
- **Params** : `usineId`.
- **Output** : `Usine` complet (avec `salles`).
- **Erreur** : 404 si usine inconnue.

### `GET /api/usines/[usineId]/salles/[salleId]`
- **Params** : `usineId`, `salleId`.
- **Output** : `Salle` complète.
- **Erreur** : 404.

### `GET .../summary`
- **Output** : `RoomSummary` (dérivé : compte employés, devices online/total, alertes, capteurs clés température+co2).
- **Erreur** : 404.

### `GET .../readings`
- **Output** : `SensorReading[]`.

### `GET .../employees`
- **Output** : `Employee[]`.

### `GET .../devices`
- **Output** : `Device[]`.

### `GET .../equipment`
- **Output** : `Equipment[]`.

### `GET .../history`
- **Output** : `HistoryEvent[]` triés par timestamp desc.

### `GET .../stats`
- **Output** : `RoomStats`.

**Format d'erreur standard** :
```json
{ "error": "Salle introuvable" }
```
avec status HTTP approprié.

**Note** : créer un helper partagé `findSalle(usineId, salleId)` dans `data.ts` pour éviter la duplication dans chaque route.

---

## 5. Structure de données

**Pas de Firestore dans cette version.** Tout est dans `src/lib/data.ts` en mémoire.

### Hiérarchie
```
Usine (3)
 └── Salle (4-8 par usine)
      ├── SensorReading[] (4 : temperature, humidite, co2, pression)
      ├── Employee[] (2-5)
      ├── Device[] (2-4)
      ├── Equipment[] (2-4)
      ├── HistoryEvent[] (4-8)
      ├── RoomStats (1)
      └── floorPlan: FloorPlanRect (coords SVG)
```

### Relations
- Une `Usine` possède N `Salle` (composition, embeddées).
- `Salle.usineId` référence le parent (pour les liens).
- `RoomSummary` est **dérivé** de `Salle`, pas stocké.

### Coords floorPlan
Disposer les rectangles dans `viewBox 0 0 800 500` sans chevauchement. Exemple de grille pour 6 salles :
- Rangée 1 : (20,20,240,180), (280,20,240,180), (540,20,240,180)
- Rangée 2 : (20,220,240,180), (280,220,240,180), (540,220,240,180)

### Indexes
N/A (mock data).

### Migration future Firestore (note)
Collections envisagées : `usines/{usineId}`, sous-collections `salles/{salleId}`, puis `readings`, `employees`, `devices`, `equipment`, `history`. Les types sont déjà compatibles.

---

## 6. Dépendances npm

| Package | Raison |
|---------|--------|
| `qrcode` | Génération du QR code (toDataURL) côté client pour la page imprimable. |
| `@types/qrcode` (dev) | Typage TypeScript de qrcode. |

> **Graphiques** : ne PAS ajouter `recharts`. Implémenter les sparklines de `RoomStatsPanel` en SVG natif (polyline) pour rester léger. Si vraiment nécessaire plus tard, `recharts` pourra être ajouté.

---

## 7. Notes techniques

### Layout QR imprimable
La page `/qr` ne doit pas afficher NavBar/Sidebar. Solution : créer un `layout.tsx` dédié dans le segment `qr/` qui rend uniquement `<>{children}</>` (override du layout parent). Ajouter `@media print` via classes Tailwind `print:hidden` sur les boutons. L'URL cible du QR doit être absolue — la construire côté serveur via `headers()` (host) ou via `window.location.origin` côté client.

### Server vs Client Components
- Fetch initiaux (liste usines, détail usine, header salle) → **Server Components** (appel direct des helpers `data.ts` plutôt que fetch HTTP quand c'est dans le même process, pour la perf — mais les routes API restent disponibles pour les panels clients).
- `UsinePlanClient`, `SalleTabs`, tous les panels, `PrintableQRCode` → **Client Components** (`"use client"`), ils consomment les routes API.