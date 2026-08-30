# Bilan de complétude V6 — Patrimoine / Maintenance / Infrastructures (Phases 16-19)

Troisième bilan de complétude du projet, même discipline que les deux
précédents (`BILAN_COMPLETUDE_V1_V5.md` avant la Phase 8,
`BILAN_COMPLETUDE_FRONTEND_V1_V5.md` avant la Phase 15) : demandé avant
d'enchaîner sur QR ou Prévisions/IA, maintenant que les trois premiers
modules V6 sont complets sur `main`, backend **et** frontend — Patrimoine
(Phases 16/19), Maintenance (Phases 17/19), Infrastructures eau/solaire/
Internet (Phases 18/19).

**Méthode** : 4 agents de recherche indépendants (un par module + un
transversal sur l'intégration frontend), chacun instruit de relire
intégralement les sections pertinentes du cahier V6
(`docs/cahiers-des-charges/DONDY_ELEVAGE_Cahier_des_charges_fonctionnel_V6.pdf`,
extrait via `pdftotext -layout`, §3 à §7 + §13.1 + §18 + §19) et de
vérifier chaque affirmation par lecture directe du code source actuel —
jamais par confiance en `DETTE_TECHNIQUE.md`, aux rapports de fin de
phase, ou à la mémoire du travail déjà fait. Chaque agent a reçu
instruction explicite de confirmer ou d'infirmer les hypothèses déjà
documentées (les "zones d'ombre" tranchées faute de détail suffisant du
cahier V6, notées C.1 à C.6 pour Patrimoine dans ce document) en relisant
le code, pas en les recopiant, et de chercher activement des manques non
documentés — dont deux consignes ciblées : vérifier si un 7ᵉ cas non
protégé du défaut de concurrence déjà corrigé 6 fois en Phase 8 existe
dans ces 3 modules, et vérifier si le bug "date de garantie inversée"
mentionné comme trouvé en vérification manuelle Phase 19 est repérable
dans le code actuellement committé. L'agent transversal a exécuté
réellement la suite `vitest` plutôt que de supposer qu'elle passe. Tous
les chemins de fichiers et références de ligne cités ci-dessous
proviennent de lectures directes.

**Grille de sévérité utilisée** (identique aux deux bilans précédents) :
- 🔴 **Élevée** — risque réel d'intégrité financière ou de donnée
  corrompue en usage normal (pas seulement théorique).
- 🟠 **Modérée** — gap fonctionnel ou de couverture qui peut se
  manifester en usage réel mais à faible probabilité ou à impact borné.
- 🟡 **Faible** — paramètre non sourcé, dette documentaire, cosmétique,
  ergonomique.
- 🟢 **Assumé** — décision consciente, documentée, non problématique, ou
  hypothèse désormais validée par le code réel.

---

## Constats transversaux (avant le détail module par module)

1. 🔴 **Une 7ᵉ occurrence non protégée du défaut de concurrence déjà
   corrigé 6 fois en Phase 8** (lecture d'un état, comparaison, écriture,
   sans transaction ni verrou sur une ressource partagée) — trouvée dans
   `MaintenanceTasksService.markRealizedInTransaction`
   (`apps/api/src/modules/maintenance/maintenance-tasks.service.ts:216-236`).
   Deux interventions concurrentes sur la même tâche de maintenance ne
   sont pas mutuellement exclusives : la ligne `MaintenanceTask` n'est
   jamais verrouillée (`FOR UPDATE`) avant la vérification de statut
   terminal, contrairement à `ensureNextTaskGenerated`
   (`maintenance-task-generation.service.ts:39-87`, verrouillage confirmé
   par lecture directe **et** par le test e2e de concurrence dédié,
   `apps/api/test/maintenance.e2e-spec.ts:636-673`) — les deux méthodes
   coexistent dans le même module, à quelques appels de distance, ce qui
   fait de cette absence une régression de discipline plutôt qu'un défaut
   de conception. Conséquence concrète : deux techniciens déclarant
   réparer la même pompe en même temps peuvent chacun créer une
   `MaintenanceIntervention` réelle, chacune avec sa propre sortie de
   stock et son propre coût imputé au TCO de l'actif — pour un seul
   événement métier qui aurait dû être rejeté une fois sur deux (409).
   Détail complet section Maintenance ci-dessous.
2. 🟠 **Concurrence non protégée, schéma répété 6 fois plutôt qu'absent
   par méconnaissance du pattern.** `AssetsService.reform()`
   (`assets.service.ts:367-400`), et les créations de
   `MaintenancePlan`/`MaintenanceTask`/`MaintenanceIntervention`/3 types
   de relevés d'infrastructure lisent toutes `asset.status === 'REFORME'`
   via un `findUnique` non verrouillé, hors transaction — le même garde
   `FOR UPDATE` déjà appliqué correctement à
   `ensureNextTaskGenerated` n'a jamais été étendu à ces 7 autres points
   d'entrée. Impact borné (pas de survente, incohérence de métadonnées au
   pire), mais la répétition systématique du même trou sur 7 endroits
   distincts — dans les 3 modules audités — en fait un vrai chantier
   transversal, pas un oubli isolé.
3. 🟠 **Permission RBAC distribuée mais sans aucune surface UI
   atteignable — "Responsable eau" ne peut jamais consulter l'onglet Eau
   en pratique.** Ce rôle a reçu `WATER_INFRASTRUCTURE_READINGS_*` en
   Phase 18 explicitement pour combler un gap RBAC ("ce rôle n'avait
   aucune permission `ASSETS_*`/`MAINTENANCE_*` avant cette phase") —
   mais n'a jamais reçu `ASSETS_READ`. Or l'UI Infrastructure Phase 19
   est construite exclusivement comme onglet conditionnel de la fiche
   Actif, et `GET /assets/:id` comme le nav item "Patrimoine" exigent
   `ASSETS_READ`. Un Responsable eau ne voit donc jamais l'entrée de
   navigation, et un accès direct par URL échouerait côté backend. Pas
   une faille de sécurité (le backend reste seul et correctement
   autoritaire), mais l'exact miroir ergonomique du constat n°7 du bilan
   frontend V1-V5 (permission distribuée, jamais consommable).
4. 🟠 **Couverture de tests de composants Phase 19 quasi nulle — même
   schéma structurel que le constat n°1 du bilan frontend V1-V5, non
   résolu par cette phase.** 3 fichiers de test ajoutés (10 tests) sur
   ~22-24 composants réels créés en Phase 19 (~9 % de couverture
   composant) — les 9 composants Infrastructure (formulaires + tables +
   dialogs eau/solaire/réseau) sont à 0 test, comme les tables
   Maintenance/Assets et `asset-detail-view.tsx` (le fichier le plus
   complexe du périmètre, orchestration de 3 domaines). Point positif :
   `day-number.ts`/`hen-count.ts`, signalés non testés par le bilan
   V1-V5, le sont désormais — la leçon "tester les fonctions pures à
   risque de divergence" a été retenue lors d'un durcissement antérieur,
   mais pas généralisée aux composants Phase 19 eux-mêmes.
5. 🟢 **`extractMessage` — le manque majeur du bilan frontend V1-V5
   (14/28 formulaires seulement) est entièrement corrigé, sans
   régression.** Les 13 formulaires/handlers Phase 19 vérifiés (Asset
   création/édition, réforme, plan, tâche, annulation, intervention, 3
   formulaires de relevé, Dépenses modifié, suppression d'actif)
   utilisent tous `extractMessage(err.body, fallback)` — zéro `catch {}`
   générique. C'est la première phase du projet à démarrer avec ce
   niveau de discipline dès l'origine plutôt qu'en rattrapage après coup.
6. 🟡 **Aucune trace du bug "date de garantie inversée" dans le code
   actuellement committé.** Recherche exhaustive du champ
   `warrantyExpiresAt` (schémas, formulaires, affichage) : tous les
   libellés/liaisons sont corrects, aucune inversion trouvée, un seul
   commit existe pour `asset-form.tsx`. Conclusion honnête : soit corrigé
   avant tout commit (non traçable en historique git), soit jamais
   réellement poussé. En creusant cette même famille de bug, l'audit a
   en revanche trouvé un **vrai** gap non documenté, plus général :
   aucune validation croisée de dates n'existe nulle part sur Asset
   (`warrantyExpiresAt`/`reformDate` vs `purchaseDate`/`serviceDate`),
   contrairement à `serviceDate >= purchaseDate` qui est le seul contrôle
   réellement en place. Détail section Patrimoine.
7. 🟡 **Dashboard : absence de KPI Infrastructures, non documentée mais
   plus justifiable que le précédent Ventes/Dépenses du bilan V1-V5.**
   Contrairement à Ventes/Dépenses (donnée déjà agrégée côté serveur,
   gratuite à afficher), aucun agrégat farm-wide n'existe pour les
   relevés d'infrastructure (endpoints imbriqués par actif uniquement) —
   un KPI dashboard exigerait soit une nouvelle route d'agrégation, soit
   un fetch N+1 par actif, contraire à la contrainte réseau Samba.
   L'omission est donc techniquement défendable, mais reste non arbitrée
   par écrit nulle part.

---

## 1. Patrimoine (Asset + DepreciationEntry) — Phases 16/19

### Livré et vérifié (backend + frontend)
Cycle de vie complet — création avec génération atomique du plan
d'amortissement (transaction unique, retry P2002 sur `PAT-AAAA-NNN`),
lecture avec champs dérivés (`totalAcquisitionCostFcfa`/
`accumulatedDepreciationFcfa`/`netBookValueFcfa`/`tcoFcfa`),
modification, suppression avec garde-fou, réforme. Scénario
d'acceptation §19 rejoué exactement en e2e avec assertions numériques
précises. 2 alertes patrimoine (garantie expirant, actif totalement
amorti), idempotentes, testées. Frontend : liste, création, édition,
fiche (4 KPI, plan d'amortissement en tableau, onglets Infrastructure
conditionnels + Maintenance intégré), dialog de réforme. Les 10
catégories du `<Select>` correspondent exactement aux 10 catégories du
cahier §3.

### Hypothèses C.x — statut
- **C.1 — Prorata temporis, calendrier fiscal jamais validé par un
  comptable local : 🔴 toujours ouvert, non atténué.** Implémentation et
  13 tests unitaires confirmés conformes à la documentation ; aucune
  trace nulle part d'une validation comptable réelle depuis la Phase 16.
  Ce calcul alimente directement VNC/TCO/dashboard — **le point le plus
  consequential de tout ce bilan**, aucun élément trouvé ne permet de le
  déclasser avant tout usage réel en production.
- **C.2 — `serviceDate` obligatoire à la création : 🟢 confirmé,
  inchangé.**
- **C.3 — `DepreciationEntry` cascade + garde-fou sur activité réelle :
  partiellement confirmé, avec un nouveau risque trouvé** (voir Bugs #4
  ci-dessous — le garde-fou de suppression omet `MaintenancePlan`).
- **C.4 — Pas d'endpoint Transfert dédié : 🟢 confirmé, backend ET
  frontend.**
- **C.5 — TCO partiel Phase 16 : 🟢 désormais résolu.** Chaque
  intervention de maintenance crée automatiquement une `Expense` pièces
  + une `Expense` main-d'œuvre rattachées à l'actif — le TCO les capte
  sans aucun changement de code sur `AssetsService`, exactement comme
  annoncé.
- **C.6 — Modèle simplifié (2 tables au lieu de 9 suggérées) : 🟡
  toujours cohérent pour le schéma, mais une des justifications ne
  tient plus en pratique.** La justification "`asset_documents` couvert
  par le module `Document` polymorphe" s'appuie sur un module qui n'a
  **jamais** été câblé côté frontend, nulle part dans l'application
  (recherche exhaustive : zéro résultat) — le §3.1 du cahier ("Photos,
  facture, manuel et documents techniques") reste donc réellement
  inaccessible en pratique, dette transversale préexistante non
  spécifique à Patrimoine mais dont la décision Phase 16 dépendait
  explicitement.

### Bugs réels trouvés (avec fichier:ligne)
- 🟠 **`reformDate` non borné, impact financier réel** — aucune
  validation contre `serviceDate`. Un `reformDate` antérieur à
  `serviceDate` produirait un actif réformé affichant
  `accumulatedDepreciationFcfa=0`/`netBookValueFcfa`=coût total, injecté
  silencieusement dans le patrimoine/TCO. Aucun test ne couvre ce cas.
- 🟠 **`AssetsService.remove()` omet `MaintenancePlan`** dans son
  garde-fou de suppression (`assets.service.ts:301-343` vérifie
  `Expense`/`MaintenanceTask`/`MaintenanceIntervention`/3 relevés, jamais
  `MaintenancePlan` directement). Scénario reproductible par lecture de
  code : un plan peut se retrouver sans tâche active liée (tâche
  supprimée manuellement) tout en restant en base avec une FK
  `Restrict` — `AssetsService.remove()` passerait alors tous ses
  contrôles puis lèverait une violation FK (P2003) non interceptée → 500
  brut au lieu du 409 propre attendu.
- 🟠 **`AssetsService.reform()` non protégé contre le double-appel
  concurrent** — aucun `SELECT ... FOR UPDATE`. Deux réformes
  simultanées liraient toutes deux `status !== 'REFORME'`, passeraient
  toutes deux la garde, dernier écrivain gagnant sur
  `reformDate`/`reformReason` (donnée qui détermine la VNC affichée) +
  double entrée d'audit.
- 🟡 **`warrantyExpiresAt` non borné** — aucune validation croisée avec
  `purchaseDate`, ni backend (`@IsDateString()` seul) ni frontend.
- 🟡 **`category` reste texte libre côté API** (`@IsString()
  @MaxLength(191)`, pas de `@IsIn`) malgré le `<Select>` strict côté UI —
  la protection Phase 19 D1 ("élimine complètement le risque de faute de
  frappe") n'est vraie que pour le trafic passant par le formulaire web ;
  un appel API direct peut toujours écrire une catégorie hors des 10
  valeurs. `AssetsService.update()` ne bloque pas non plus la migration
  d'un actif hors de `eau`/`solaire`/`internet` alors que des relevés
  existent déjà — ils restent en base mais disparaissent silencieusement
  de l'UI.
- 🟡 **Navigation directe vers `/patrimoine/:id/modifier` pour un actif
  REFORME non bloquée au niveau route** — le bouton Modifier est bien
  gardé par `isAssetOpen` sur la fiche, mais rien n'empêche une
  navigation directe par URL ; le `<Select>` afficherait alors une
  valeur hors énumération. **Caractéristique transversale préexistante
  du projet** ("garde le bouton, jamais la route", même schéma exact
  vérifié sur `broiler-batch-form.tsx`), pas une régression Phase 19.
- 🟡 **Bug "date de garantie inversée" mentionné par l'utilisateur : non
  reproduit dans le code actuel** — voir constat transversal n°6.

### Divergences cahier V6 vs réalité
- §3.1 "Photos, facture, manuel et documents techniques" : absent de
  l'usage (voir C.6).
- §13.1 (10 KPI patrimoniaux listés) : seul 1 exposé en agrégat ferme
  entière ("Valeur nette du patrimoine" au dashboard) — les 9 autres
  (valeur brute, amortissements cumulés, acquisitions de l'année,
  comptages garanties/actifs amortis, coût de maintenance agrégé...)
  n'existent que par actif individuel sur sa fiche. Cohérent avec le
  constat déjà documenté (dashboard = juxtaposition simple), pas un
  défaut isolé de Patrimoine.
- §15 "Rapport patrimoine" : absent, cohérent avec l'absence totale déjà
  documentée du module Rapports/Exports pour tout le projet.

### RBAC (backend vs frontend, cohérence)
Distribution vérifiée trait pour trait dans `roles.catalog.ts` contre
chaque `<Can>` frontend correspondant — aucune permission UI trouvée qui
autoriserait plus que le RBAC backend. Comptable : CREATE/READ/UPDATE/
REFORM mais pas DELETE (cohérent avec son profil `EXPENSES_*`), testé
e2e. Le bouton Supprimer n'est pas gardé par `isAssetOpen` côté
frontend — cohérent, le backend n'interdit pas non plus la suppression
d'un actif REFORME.

### Couverture de tests (nombre exact)
| Fichier | Tests |
|---|---|
| `apps/api/test/assets.e2e-spec.ts` | 13 |
| `apps/api/.../depreciation.calculations.spec.ts` | 13 |
| `apps/web/.../asset-form.test.tsx` | 1 |
| **Total** | **27** |

Aucun test de concurrence (`Promise.all`) sur Asset, contrairement à
Broiler/Layer/Incubation/Stock.

### Concurrence/garde-fous
Génération du plan d'amortissement : protégée (transaction atomique,
pas de ressource partagée entre créations). `reform()` et les 7 points
d'entrée Maintenance/Infrastructure lisant `asset.status`: non protégés
— voir constat transversal n°2.

---

## 2. Maintenance (Plan + Task + Intervention) — Phases 17/19

### Livré et vérifié (backend + frontend)
CRUD Plan/Task (création manuelle CORRECTIVE/CONDITIONNELLE),
Intervention append-only (confirmé : ni PATCH ni DELETE exposés).
Génération de tâche à la demande à la clôture, ancrée sur la dernière
intervention réelle. `computeNextDueDate` testé (année bissextile
incluse). Garde REFORME sur les 3 créations, statut terminal protégé
par le PATCH générique. Coût imputé au TCO en temps réel, vérifié en
e2e (`525 000 FCFA` après une intervention réelle). Frontend : page
globale lecture seule (décision assumée), onglet fiche Actif complet
(plans/tâches/interventions/annulation), `MaintenanceTaskTable`
réellement partagée entre les deux surfaces.

### Hypothèses — statut
- **Périodicité en jours entiers uniquement : 🟠 toujours un vrai gap,
  désormais plus concret.** `pumpHoursCumulative` existe bel et bien
  depuis Phase 18 mais n'est référencé nulle part dans Maintenance
  (0 occurrence croisée confirmée) — la matière première existe des
  deux côtés sans aucun câblage entre elles.
- **Génération à la demande + `FOR UPDATE` : 🟢 confirmé exact**, y
  compris le test e2e de concurrence dédié, lu intégralement.
- **`MaintenanceIntervention` append-only, y compris frontend : 🟢
  confirmé.**
- **Pas de ciblage individuel des alertes : 🟢 confirmé.**
- **Aucune permission `MAINTENANCE_*` pour Magasinier : 🟢 confirmé
  encore vrai, backend et frontend.**

### Bugs réels trouvés (avec fichier:ligne)
- 🔴 **7ᵉ occurrence de concurrence non protégée**
  (`maintenance-tasks.service.ts:216-236`, `markRealizedInTransaction`)
  — détail au constat transversal n°1. Correctif recommandé : verrouiller
  `MaintenanceTask` par `SELECT ... FOR UPDATE` en tout début de
  méthode, avant `TERMINAL_STATUSES`. Même défaut structurel dans
  `cancel()` (`maintenance-tasks.service.ts:175-209`) — un correctif
  unique (verrouiller la lecture de `MaintenanceTask` dans les deux
  méthodes) couvre les deux cas.
- 🟡 **Commentaire de code périmé** (`assets.service.ts:89-90`) : annonce
  encore le TCO comme "partiel, Maintenance n'existe pas encore" alors
  que c'est résolu depuis Phase 17 — aucun impact fonctionnel, mais
  induit en erreur tout lecteur futur.
- 🟡 **Hooks update/delete Plan/Task morts côté frontend** —
  `useUpdateMaintenancePlan`/`useDeleteMaintenancePlan`/
  `useUpdateMaintenanceTask`/`useDeleteMaintenanceTask` existent,
  fonctionnels, mais ne sont importés par aucun composant. Même patron
  exact que `useDeleteWaterPoint` déjà documenté dans le bilan frontend
  V1-V5. `MAINTENANCE_TASKS_UPDATE/DELETE`,
  `MAINTENANCE_PLANS_UPDATE/DELETE` : distribuées côté RBAC, zéro UI —
  confirmé exactement comme documenté dans `DETTE_TECHNIQUE.md`.
- 🟡 Aucun bug de date inversée trouvé dans ce module (aucune validation
  croisée existe, mais rien n'est non plus mal câblé).

### Divergences cahier V6 vs réalité
§7 confirmé effectivement laconique (tableau d'exemples + 6 puces
génériques, sans champ/formule/unité). Modèle §18 partiellement suivi (3
tables réelles, `maintenance_parts`/`asset_incidents` remplacées par des
mécanismes génériques déjà existants, décision cohérente). Les 2
scénarios §19 confirmés verbatim identiques à ceux déjà cités.

### RBAC (backend vs frontend, cohérence)
11 permissions `MAINTENANCE_*`, distribution cohérente (Comptable : tout
sauf DELETE, `CANCEL` accordé). Le bouton "Annuler" est gardé
précisément par `MAINTENANCE_TASKS_CANCEL`, pas par `_UPDATE` — vérifié
comme demandé. Aucune incohérence backend/frontend trouvée sur les ~8
usages de `Can` de ce module.

### Couverture de tests (nombre exact)
| Fichier | Tests |
|---|---|
| `apps/api/.../next-due-date.calculations.spec.ts` | 4 |
| `apps/api/test/maintenance.e2e-spec.ts` | 18 |
| `apps/web/.../maintenance-intervention-form.test.tsx` | 5 |
| `apps/web/.../intervention-cost-preview.test.ts` | 4 |
| **Total** | **31** |

Frontend : 9 tests sur 2 fichiers, parmi 13 fichiers du dossier
`components/` (~15 % de fichiers couverts) — aucun test sur
`maintenance-plan-form.tsx`, `maintenance-task-form.tsx`,
`cancel-task-dialog.tsx`, les 3 tables, les 3 dialogs de création.

### Concurrence/garde-fous — résultat de la recherche de 7ᵉ occurrence
**Trouvée et confirmée** (voir Bugs ci-dessus). 3 candidats explicitement
écartés après vérification : génération de tâche (protégée, testée) ;
deux plans concurrents sur le même Asset (pas un défaut de concurrence,
simple absence de contrainte d'unicité, non documentée comme un choix) ;
`cancel()` retombe sur le même correctif recommandé que
`markRealizedInTransaction`.

---

## 3. Infrastructures (Water/Solar/Network) — Phases 18/19

### Livré et vérifié (backend + frontend)
3 tables séparées, confirmées cohérentes après Phase 19 (aucune fusion
implicite côté frontend — 3 tables, 3 formulaires, 3 dialogs, 3 jeux de
hooks distincts). Équation de contrôle eau conforme littéralement au
cahier, formule exacte confirmée par lecture directe (`gapM3 =
pumpedVolumeM3 - farmInternalConsumptionM3 - soldVolumeM3`, `null` si
`pumpedVolumeM3` absent), affichée côté frontend **sans aucun
recalcul** (`grep` exhaustif confirmé). `Asset.status` vs
`NetworkOperationalStatus` : séparation respectée côté UI. Alertes de
staleness bien remontées dans `EntityAlertsWidget`. Contrainte
d'unicité par date (`@@unique([assetId, date])`) robuste sur les 3
tables, conflit intercepté proprement (409, jamais 500), testé e2e.

### Hypothèses — statut
Les 7 hypothèses/décisions Phase 18 documentées sont toutes **🟢
validées** par lecture directe (3 tables séparées, équation de
contrôle, `pumpHoursCumulative` purement informatif, séparation des
statuts, alertes de staleness, RBAC 3 permissions jamais composées,
Comptable lecture seule) — aucune n'a régressé en Phase 19.

### Bugs réels trouvés (avec fichier:ligne)
- 🟠 **Catégorie d'actif jamais vérifiée côté serveur — risque réel,
  pas seulement théorique.** `assertAssetEligible()` (dupliquée à
  l'identique dans les 3 services) ne teste que
  farm/`status !== 'REFORME'`, jamais `category`. Un appel API direct
  sur un actif de catégorie "élevage" serait accepté sans erreur, alors
  qu'aucun onglet frontend n'y mènerait jamais normalement — le seul
  garde-fou de ce domaine reste purement côté UI, contournable. Aucun
  test e2e ne couvre ce cas.
- 🟡 **Boutons "Nouveau relevé" (Eau/Solaire/Réseau) non gardés par
  `isAssetOpen`**, contrairement aux boutons Maintenance sur la même
  fiche — un actif réformé garde son onglet visible avec un bouton
  cliquable (le backend bloque quand même, 409 propre via
  `extractMessage`, donc pas de corruption de donnée, seulement une
  incohérence de patron UX sur la même page).
- 🟡 **`pumpHoursCumulative` (eau) et `observations` (eau + solaire)
  saisis mais jamais réaffichés** dans les tables de relevés
  correspondantes (`observations` est bien affiché côté Réseau,
  incohérence entre les 3 domaines) — même famille que le manque déjà
  documenté "colonnes Montant théorique/Écart/Remarques absentes" pour
  Eau V4/Phase 9, qui se répète ici sur un nouveau module.

Aucun bug de sérialisation Decimal→string trouvé (tous les champs
concernés passent explicitement par `Number(...)` avant affichage) ;
`DataTable` n'ayant aucune fonctionnalité de tri, la classe de bug
"comparaison de chaînes au lieu de nombres" ne peut pas se produire ici.

### Divergences cahier V6 vs réalité
Aucune divergence fonctionnelle significative non déjà documentée.
Aucun seuil chiffré fourni par le cahier pour les alarmes (réservoir/
batterie bas) — choix produit non sourcés, déjà signalés comme tels
dans le code. §19 confirmé : aucun scénario d'acceptation dédié à ce
module, les 14 tests e2e sont par construction inventés (RBAC,
concurrence, cron), cohérent avec `DETTE_TECHNIQUE.md`.

### RBAC — séparation par domaine (backend + frontend)
**Solide aux deux niveaux, testé e2e explicitement.** "Responsable eau"
: uniquement `WATER_INFRASTRUCTURE_READINGS_*`, confirmé par grep
exhaustif (aucune occurrence `SOLAR_*`/`NETWORK_*`) + test e2e dédié.
"Comptable" : lecture seule sur les 3 domaines, confirmé de même. Côté
frontend, les 3 blocs `<Can>` de `asset-detail-view.tsx` sont bien
séparés par permission — un "Responsable eau" ouvrant un actif catégorie
"solaire" voit l'onglet Solaire **visible mais totalement vide de
contenu métier** (comportement encore plus strict que demandé, via
`fallback` du `<Can>` extérieur), aucune fuite de donnée. La seule
réserve réelle sur ce point est transversale, pas spécifique à ce
module : voir constat n°3 (permission "Responsable eau" elle-même
inatteignable faute d'`ASSETS_READ`).

### Couverture de tests (nombre exact)
| Fichier | Tests |
|---|---|
| `apps/api/test/infrastructure.e2e-spec.ts` | 14 |
| `apps/api/.../water-control-equation.calculations.spec.ts` | 4 |
| `apps/web/src/features/infrastructure/**` | **0** |
| **Total** | **18** |

0 fichier de test frontend, confirmé par recherche exhaustive — le
module s'ajoute à la liste déjà établie (Eau/Chair/Pondeuses en V1-V5)
plutôt que de la combler. Risque de divergence silencieuse jugé nul
cependant : `gapM3` n'est jamais recalculé côté client (contrairement à
`hen-count.ts`), seule la couverture générale manque.

### Contraintes d'intégrité
Unicité par date : robuste (voir ci-dessus). Catégorie d'actif : voir
Bugs 🟠 ci-dessus — seul garde-fou du domaine encore purement côté UI.

---

## 4. Intégration frontend transversale — Phase 19

*(agent dédié — cohérence système au-delà du détail par module, déjà
intégré au constat transversal en tête de document pour les points les
plus significatifs : concurrence RBAC orpheline, couverture de tests,
`extractMessage`)*

- 🟢 **Design system** : zéro dérive trouvée sur tout le périmètre
  Phase 19 (recherche exhaustive hex/style inline/rayons non
  standard) — tous les patrons partagés réutilisés
  (`DataTable`/`KpiCard`/`StatusBadge`/`Can`/`PageHeader`/
  `ConfirmDialog`/`EntityAlertsWidget`), aucun composant réinventé.
- 🟢 **`extractMessage`** : 13/13, voir constat transversal n°5.
- 🟠 **RBAC UI** : cohérent sur tous les boutons vérifiés (aucune
  confusion entre permissions voisines) — seule réserve, la permission
  orpheline "Responsable eau" (constat n°3).
- 🟢 **Navigation** : les 2 nouvelles entrées `nav-items.ts` correctement
  gardées par `_READ`.
- 🟡 **Dashboard** : absence de KPI Infrastructures, techniquement
  défendable mais non arbitrée par écrit (constat n°7).
- 🟢 **Mobile First** : aucune régression (grids `sm:`, `overflow-x-auto`
  systématique via `DataTable`).
- 🟠 **Tests** : ~9 % de couverture composant Phase 19 (constat n°4).
- 🟢 **Pattern Dialog vs page** : cohérent — seul écart (`sm:max-w-xl`
  pour l'intervention) documenté et justifié, aucun autre Dialog n'a
  suivi cet écart sans même justification.
- 🟢 **`DETTE_TECHNIQUE.md` Phase 19** : vérifiée exacte contre le code,
  y compris la correction `pool=forks`→`pool:'threads'` (reconfirmée par
  exécution réelle : 16 fichiers, 68/68 tests).

---

## Recommandation

**Durcissement ciblé avant QR/Prévisions-IA — pas un passage direct, pas
non plus une phase complète.**

### Pourquoi pas QR/Prévisions-IA directement
Contrairement au bilan frontend V1-V5 (zéro 🔴, recommandation de
passer directement à la V6 après un durcissement léger), ce bilan-ci
trouve **deux points de sévérité 🔴** :
1. **La 7ᵉ occurrence de concurrence non protégée**
   (`markRealizedInTransaction`) est un bug de correction réel et
   reproductible, pas théorique — deux interventions concurrentes sur
   la même tâche dupliquent réellement coût et sortie de stock. Le
   correctif est trivial et déjà standardisé sur ce projet (même
   `SELECT ... FOR UPDATE` que `ensureNextTaskGenerated`, quelques lignes
   de distance dans le même fichier) — le laisser filer coûterait plus
   cher à découvrir en production qu'à corriger maintenant.
2. **C.1 (prorata temporis jamais validé par un comptable local)** reste
   ouvert depuis la Phase 16, sans qu'aucune des Phases 17-19 n'ait agi
   dessus. Ce calcul alimente directement les états financiers
   (VNC/TCO/dashboard) — plus le projet avance sans validation, plus le
   coût d'une correction rétroactive (si le modèle s'avérait faux)
   grandirait sur des données déjà en usage réel.

### Pourquoi pas un chantier plus large non plus
Le reste de l'audit est solide : design system irréprochable,
`extractMessage` totalement corrigé (contrairement à V1-V5), RBAC fiable
partout sauf une permission orpheline sans impact sécurité, aucune
divergence fonctionnelle majeure avec le cahier V6, l'équation de
contrôle eau et la séparation RBAC "Responsable eau" — les deux points
explicitement demandés en vérification — sont solides aux deux niveaux
backend et frontend. Les autres 🟠/🟡 (dates non bornées, garde de
suppression incomplète, catégorie non vérifiée côté serveur, couverture
de tests, dashboard) sont réels mais à impact borné ou déjà de la même
famille qu'une dette déjà connue et acceptée ailleurs dans le projet —
un chantier trop large retarderait inutilement QR/Prévisions-IA sur des
points qui peuvent attendre.

### Ordre recommandé pour le durcissement ciblé
1. **Verrouiller `MaintenanceTask` par `SELECT ... FOR UPDATE`** dans
   `markRealizedInTransaction` ET `cancel()` — correctif unique, même
   patron déjà en place ailleurs dans le même fichier, aucune régression
   attendue (additif, ne change le comportement d'aucun cas déjà valide,
   même raisonnement que le correctif `PaymentsService` de Phase 7).
2. **Décision produit à trancher hors code, pas différable indéfiniment** :
   faire valider le modèle de prorata temporis (`depreciation.calculations.ts`)
   par un comptable local familier des pratiques OHADA avant tout usage
   des chiffres d'amortissement en production réelle. Si le modèle
   s'avère correct, C.1 se reclasse 🟢 sans aucun changement de code ; si
   un ajustement est nécessaire, il est infiniment moins coûteux à faire
   maintenant que sur un historique d'amortissement déjà utilisé pour
   de vraies décisions financières.
3. **`AssetsService.remove()`** : ajouter `maintenancePlan.count()` à la
   liste des gardes — même gabarit que les autres, corrige un 500 brut
   en 409 propre.
4. **`AssetsService.reform()`** : verrouiller par `FOR UPDATE`, même
   correctif que le point 1.
5. **Validation croisée de dates sur Asset** :
   `reformDate >= serviceDate`, `warrantyExpiresAt` optionnellement
   averti (pas forcément bloquant) si antérieur à `purchaseDate`.
6. **Verrouillage des 7 points d'entrée restants** (constat transversal
   n°2) lisant `asset.status === 'REFORME'` sans verrou — même correctif
   mécanique, à appliquer en lot puisque le pattern est désormais
   standardisé sur ce projet.

### Explicitement hors du durcissement ciblé, à documenter comme
backlog plutôt qu'à traiter maintenant
- Couverture de tests de composants complète sur les 3 modules V6 —
  trop large pour un chantier ciblé, à traiter progressivement (comme
  déjà fait pour `day-number.ts`/`hen-count.ts`).
- Vérification serveur de `category` sur les 3 endpoints Infrastructure
  (defense in depth, le garde-fou UI suffit tant qu'aucun client API
  tiers n'existe).
- Correction de la permission RBAC orpheline "Responsable eau" (ajouter
  `ASSETS_READ` scopé, ou documenter explicitement le choix) — gap
  ergonomique, pas de sécurité, peut attendre un vrai besoin exprimé.
- KPI Infrastructures au dashboard, colonnes manquantes
  (`pumpHoursCumulative`/`observations`), UI Modifier/Supprimer
  Plan/Tâche, module Document jamais câblé nulle part dans l'app
  (transversal, bien au-delà de Patrimoine seul) — fonctionnel mais pas
  bloquant.

### Critères ayant motivé ce choix
- **Risque** : 2× 🔴 réels (un bug de correction reproductible, une
  hypothèse financière structurante jamais validée) — assez pour ne pas
  enchaîner directement, pas assez pour justifier une phase complète.
- **Coût de report** : les deux 🔴 grandissent avec le temps (plus
  d'interventions concurrentes possibles à mesure que l'usage grandit ;
  plus de données financières produites sur un modèle non validé).
- **Coût du correctif** : les 6 points du durcissement sont tous des
  correctifs bornés sur du code déjà écrit, utilisant des patrons déjà
  établis sur ce projet — aucun nouveau mécanisme à inventer.
- **Aucune dépendance technique** entre ce durcissement et QR/
  Prévisions-IA — l'ordre est une question de priorité produit et de
  gestion de risque, pas une contrainte technique.
