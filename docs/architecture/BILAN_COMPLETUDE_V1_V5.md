# Bilan de complétude V1 → V5 (Phases 0 à 7)

Bilan consolidé demandé avant de trancher entre la V6 (Patrimoine,
Autonomie, IoT, QR, Prévisions IA) et le frontend. Contrairement aux
rapports de fin de phase, ce document ne part pas des prompts de phase
mais des **cahiers des charges eux-mêmes** (`DONDY_ELEVAGE_Cahier_des_
charges_fonctionnel_V1.pdf` pour Poulets de chair, `..._V5.pdf` pour tout
le reste), relus intégralement (texte extrait via `pdftotext -layout`) et
confrontés au code réel — pas à la mémoire du travail déjà fait.

**Méthode** : 5 agents de recherche indépendants (un par module/groupe de
modules), chacun chargé de relire les sections pertinentes du cahier
ligne à ligne et de vérifier chaque affirmation contre le code source et
les tests e2e réels, sans se fier à un résumé préexistant. Le module
Stocks/Achats/Finances (Phase 7, le plus récent) a été audité directement
par moi selon la même discipline. Tous les chemins de fichiers et
références de ligne cités ci-dessous sont vérifiables.

**Grille de sévérité utilisée pour la dette technique** :
- 🔴 **Élevée** — risque réel d'intégrité financière ou de donnée
  corrompue en usage normal (pas seulement théorique).
- 🟠 **Modérée** — gap fonctionnel ou de couverture qui peut se manifester
  en usage réel mais à faible probabilité ou à impact borné.
- 🟡 **Faible** — paramètre non sourcé, dette documentaire, cosmétique.
- 🟢 **Assumé** — décision consciente, documentée, non problématique.

---

## Constats transversaux (avant le détail module par module)

Plusieurs manques identifiés ci-dessous ne sont **pas spécifiques à une
phase** — ils ont été trouvés indépendamment par plusieurs agents dans
des modules différents, ce qui en fait des chantiers transversaux plutôt
que des oublis isolés :

1. **Aucun module Rapports/Exports (§14/§18 des deux cahiers) nulle part
   dans le backend** — confirmé absent pour Chair, Pondeuses, Couvoir,
   Eau, et Stocks/Finances. Aucune trace de `reports`/`exports`, aucune
   dépendance `pdfkit`/`exceljs` dans `package.json`. Cohérent avec un
   backend développé sans consommateur frontend à ce jour, mais c'est un
   vrai bloc fonctionnel du cahier, jamais entamé.
2. **Les crons d'alerte ne sont testés qu'en "s'exécute sans erreur"**,
   jamais sur le contenu réel des alertes déclenchées (sévérité, seuil
   franchi) — confirmé sur Broiler, Layer, Breeder/Incubation, Water. Un
   bug de seuil ou de condition de déclenchement ne serait pas détecté
   par la suite de tests actuelle.
3. **`GET /broiler-batches` n'accepte aucun filtre/tri/recherche/
   pagination** (`broiler-batches.controller.ts`, pas de `@Query()`) —
   contredit à la fois le §4.2 du cahier V1 et la règle API de
   `CLAUDE.md` lui-même ("pagination/filtres/tri/recherche"). Point
   confirmé sur ce module précis ; sa généralisation aux autres modules
   n'a pas été vérifiée systématiquement par les agents et mériterait un
   audit dédié avant la V6.
4. **Dashboard global (§9)** : les KPI bruts existent module par module
   (endpoints déjà construits), mais aucune agrégation cross-module n'a
   été construite — décision explicite et documentée (Phase 7,
   `DETTE_TECHNIQUE.md`), cohérente avec le fait que `TABLEAU_DE_BORD.md`
   est confirmé frontend-only.
5. **Une entrée de `DETTE_TECHNIQUE.md` est aujourd'hui fausse** (section
   Phase 1, lignes 95-97) : *"`test:e2e` non intégré à la CI"* — or
   `.github/workflows/ci.yml` provisionne bien un service MySQL et
   exécute `npm run test:e2e --workspace=apps/api` (confirmé, commit
   `c4846fa` du 2026-08-18, antérieur à la rédaction du registre le
   2026-08-20). Dette **documentaire**, pas réelle — à corriger dans le
   registre à l'occasion d'une prochaine phase.
6. **Canal email des notifications (`Notification.channel`) jamais câblé
   sur les alertes** — le cahier V1 §21 prévoit explicitement
   "notifications dans l'application **et email**". `MailService`
   fonctionne réellement (SMTP/nodemailer) mais n'est utilisé que pour
   l'auth (invitation, reset mot de passe), jamais pour les alertes
   métier. Contrairement à la plupart des écarts du projet, celui-ci
   **n'est documenté nulle part** dans `DETTE_TECHNIQUE.md`.

---

## 1. Auth / RBAC / Farms / Buildings (Phase 1)

### Livré et testé
JWT + refresh avec **rotation et détection de réutilisation** (famille de
tokens révoquée si un refresh déjà consommé est rejoué,
`token.service.ts:68-99`, testé `auth-rbac.e2e-spec.ts:261-304`). OAuth
Google/Microsoft **réellement implémenté** (pas un stub) via Passport,
liaison de compte par email sans création à la volée
(`auth.service.ts:226-278`). 2FA TOTP complet avec QR code, testé avec un
vrai code TOTP (`auth-rbac.e2e-spec.ts:306-358`). RBAC piloté par
données : **11 rôles** réels (`roles.catalog.ts`), permissions vérifiées
côté `PermissionsGuard`, jamais par nom de rôle en dur. Isolation
multi-tenant stricte (`assertSameFarm()`, 404 générique jamais 403),
testée. Audit log présent dans 33 services métier.

### Hors périmètre justifié
Redirection OAuth vers `/oauth/callback` (frontend, hors périmètre
backend) ; handoff par paramètres d'URL sans session serveur — choix
assumé.

### Dette connue, reclassée
- 🟡 OAuth jamais testé avec de vraies credentials d'app (aucune
  enregistrée à ce jour) — documenté honnêtement, pas caché.
- 🟡 Rate limiting IP uniquement, pas d'axe email dédié.
- 🟢 Permissions embarquées dans le JWT — latence de 15 min max sur un
  changement de rôle, limitation connue et acceptable.
- 🟡 Entrée CI périmée (voir constat transversal n°5).

### Manques réels identifiés
- **11 rôles, pas 9** : `Super Admin` (plateforme, cross-tenant) et
  `Employé` (accès minimal) sont des extensions volontaires au-delà des
  9 rôles du cahier — documenté comme choix, pas un défaut.
- **Aucune API pour créer/modifier un rôle personnalisé par ferme** — le
  modèle est data-driven (tables, pas enum TypeScript) mais
  fonctionnellement, le catalogue de rôles reste aujourd'hui figé côté
  produit : un Administrateur ne peut pas composer un rôle sur mesure
  sans intervention développeur/seed. L'ambition "RBAC piloté par
  données" n'est donc vraie qu'au niveau du schéma, pas encore de
  l'usage.
- Le contenu (`oldValues`/`newValues`) des logs d'audit n'est jamais
  asserté en e2e (seule l'existence d'une ligne est vérifiée) — le
  mécanisme fonctionne, mais le scénario d'acceptation H ("vérifier que
  l'historique indique qui, quand, ancienne et nouvelle valeur") n'est
  testé que partiellement.

---

## 2. Suppliers / Customers / Documents / Alertes / Notifications (Phase 2)

### Livré et testé
CRUD Suppliers/Customers avec catégorie/type en texte libre,
suppression tracée par audit. Documents : validation par **signature
binaire réelle** (magic bytes), pas par extension déclarée
(`document-validation.service.ts:14-33`), stockage par UUID. Alertes :
machine à états à 3 transitions, 4 niveaux de sévérité (extension du
triptyque du cahier, cohérente). Notifications ciblées par permission,
pas par rôle en dur.

### Hors périmètre / dette connue
`DETTE_TECHNIQUE.md` ne détaille pas cette phase spécifiquement (renvoie
à la PR #1) et indique "aucun point de dette actif identifié dans les
phases suivantes" — cohérent avec l'état actuel du code.
Le garde-fou manquant sur `Supplier.remove()` (pas de `count()` avant
suppression, risque de 500 au lieu de 409) est bien documenté, mais
rattaché administrativement à la section Phase 6 (qui l'a découvert),
pas à Phase 2.

### Manques réels identifiés
- **Canal email des notifications** — voir constat transversal n°6, gap
  réel non documenté.
- Le modèle `Alert` n'a qu'un champ `type` en texte libre — le cahier V5
  §10 attend 7 **catégories** d'alertes (biologiques, sanitaires, stock,
  commerciales, eau, saisie, financières) comme axe de classification à
  part entière ; sans champ dédié, un futur filtrage/reporting par
  catégorie dépendra d'une convention de nommage informelle sur `type`.

---

## 3. Poulets de chair (Phase 3, cahier V1 intégral)

### Livré et testé
Cycle complet J1-J45 testé de bout en bout (`broiler-batches.e2e-spec.ts`)
contre le §25 du cahier : création de bande (code auto, 45 journées
générées atomiquement), effectif vivant, alimentation (+ hook stock
Phase 7), pesée, alertes calendaires J1-J46+ (cron quotidien 6h
Africa/Bangui, idempotent), clôture bloquée tant que des animaux restent
(409) avec résumé production/performance/finances/cohérence, vente avec
sortie automatique d'effectif, paiement plafonné (§15, corrigé
Phase 7), RBAC/isolation testés, intégrité (négatifs interdits, doublons
bloqués par contrainte DB, audit systématique).

### Hors périmètre justifié
Le §28 du cahier exclut nommément pondeuses/reproduction/eau/IA/IoT — non
codés en Phase 3, couverts par les phases suivantes. Mode hors-ligne/PWA
différé "après la première itération technique", conforme au texte même
du cahier.

### Dette connue, reclassée
- 🔴 `SalesService.create()`/`.update()` (branche POULET_CHAIR) : lecture
  de `currentHeadcount` puis comparaison **sans transaction ni verrou** →
  survente concurrente possible. Groupée avec Phase 5 dans la dette
  transversale, correction recommandée via `SELECT ... FOR UPDATE`
  (pattern déjà validé en Phase 4).
- 🟠 Aucun verrouillage de champ sur `BROILER_BATCHES_UPDATE` —
  `receivedQuantity` reste modifiable après des ventes déjà enregistrées.
- 🟢 `remove()` bloque le hard-delete au-delà du périmètre initial
  (inclut mortalité/santé) — extension délibérée plus sûre.
- 🟡 IC de clôture approximatif (poids d'arrivée des poussins négligé),
  assumé et documenté.
- 🟡 Alerte "poids inférieur à l'objectif" (§9.1) non implémentée, faute
  de courbe de poids-cible dans le périmètre donné — seul manque de
  Phase 3 explicitement reconnu dans le registre.

### Manques réels identifiés
- **GMQ jamais exposé** : `computeGmqGramsPerDay` et
  `computeAverageConsumptionPerSubject` existent, sont unitairement
  testés, mais **ne sont appelés par aucun service ni exposés par aucune
  route** — le §6.4 du cahier ("tracer l'évolution du poids moyen, du GMQ
  et de l'IC") n'est donc pas honoré en pratique pour le GMQ malgré le
  calcul écrit.
- **Pas de filtres/recherche/pagination sur `GET /broiler-batches`** —
  voir constat transversal n°3.
- **Aucun contrôle "journée saisie incohérente avec l'âge réel de la
  bande"** (§17) — pas de comparaison `dayNumber` vs âge calculé trouvée
  dans le code.
- **Alertes métier partiellement couvertes** : implémentées — mortalité
  élevée, absence de saisie, cohérence. **Non implémentées et non
  documentées comme dette** — déviation consommation aliment/eau,
  traitement/vaccination planifié en retard (statut `PREVU` dépassé),
  rupture de stock aliment, vente en retard, anomalie financière.
- `broiler_weight_records` (table dédiée au modèle §16.5) fusionnée dans
  `BroilerDailyRecord` — fonctionnellement équivalent, dévie du modèle
  documenté sans que ce soit noté.
- Retry P2002 absent sur les ventes POULET_CHAIR (présent côté œufs) —
  corollaire mineur non mentionné explicitement.

---

## 4. Pondeuses (Phase 4, cahier V5 §5)

### Livré et testé
Scénario B rejoué intégralement (`layer-batches.e2e-spec.ts`) : lot
(code auto), formules §5.3 exactes (`computeEggsSellable`,
`computeLayingRatePercent`, `computeCostPerEggFcfa`, chacune avec son
`.spec.ts`), `henCount` calcul+ajustement contrôlé, stock d'œufs **FIFO**
avec consommation testée sur plusieurs lots. **Concurrence FIFO testée
explicitement** (`layer-batches.e2e-spec.ts:561-630`, `Promise.all` sur
deux ventes simultanées, `SELECT ... FOR UPDATE`, tentative
`Serializable` documentée comme écartée pour bug amont confirmé
`@prisma/adapter-mariadb#28964`). Annulation = mouvement compensatoire,
jamais de suppression. **Les 6 alertes du §5.5 sont toutes
implémentées** (`layer-alerts.cron.ts`). Clôture avec résumé de cohérence
au FCFA près. RBAC/isolation testés.

### Hors périmètre justifié
Fractionnement d'un lot d'œufs en plusieurs calibres après production —
aucun workflow de tri décrit au cahier à ce stade. Réforme/vente des
poules elles-mêmes en fin de lot — confirmé en commentaire de code, la
clôture n'est jamais bloquée par l'effectif restant (documenté).

### Dette connue, reclassée
- 🟡 Seuils mortalité/déviation aliment recoupés mais pas directement
  sourcés — `Setting` reconfigurable sans déploiement.
- 🟢 Le contournement `FOR UPDATE` vs `Serializable` est un choix
  technique déjà résolu, pas une dette active.
- Aucune dette Phase 4 classée critique dans le registre.

### Manques réels identifiés
- **Calibres (§5.4) non exposés du tout** : le champ `EggStockLot.
  caliber` existe en base mais **aucun DTO ne permet jamais de le
  fixer** — figé à `"non_calibre"` pour tous les lots créés. Semble être
  un oubli plutôt qu'une décision (contrairement au fractionnement
  post-production, bien documenté comme hors périmètre).
- **§5.4 "Plateaux — conversion unités ↔ plateaux" totalement absente** —
  aucune trace `plateau`/`tray` dans le code, ni documentée comme
  écartée.
- **Rapports/exports Pondeuses** — voir constat transversal n°1.
- Agrégation des mouvements de stock par lot de pondeuses absente
  (filtrable seulement par `lotId`, pas par `batchId`) — mineur.

---

## 5. Reproduction / Couvoir (Phase 5, cahier V5 §6)

### Livré et testé
Lot reproducteur (code auto), production journalière avec disponibilité
cumulée dérivée à la lecture, lot d'incubation avec garde-fou
`eggCount ≤ availableFertileEggs` (409, égalité acceptée), orientation à
4 branches (CHAIR/VENTE/RENOUVELLEMENT/REFORME_PERTE) en transaction
unique (correctif déjà journalisé), filiation tracée de bout en bout
jusqu'au lot reproducteur d'origine. RBAC "Responsable couvoir" conforme
au mandat du cahier.

**Point de vérification explicitement demandé — confirmé** : le fichier
`incubation-batches.e2e-spec.ts` s'intitule "scénario §16-D" en tête,
mais son contenu réel couvre **le scénario C (Couvoir) ET D (Filiation)
combinés** — les tests 1-7 (1050 œufs, 850 poussins, taux
d'infertilité/infection/mortalité embryonnaire) sont le scénario C ; les
tests 8-15 (orientation + traçabilité) sont le scénario D. C'est une
imprécision d'étiquetage du commentaire d'en-tête, pas un manque
fonctionnel — les deux scénarios sont réellement couverts, juste sous une
seule étiquette incomplète.

### Hors périmètre justifié
Suivi d'effectif journalier des reproducteurs (mortalité/réforme) — le
§6.2 ne prévoit que la production d'œufs pour les reproducteurs.
Température/humidité de couveuse — pas de capteurs IoT en V5 (cohérent
V6). `candling_records`/`hatch_records` séparées collapsées en champs
scalaires sur `IncubationBatch` — documenté dans le schéma.

### Dette connue, reclassée
- 🟠 Vérification de disponibilité sans verrou (`IncubationBatchesService.
  create()`, `OrientationService.orient()`) — dette transversale
  documentée, partagée avec Phase 3.
- 🟡 `IncubatorsService.remove()` sans garde-fou — angle mort
  pré-existant documenté en Phase 6.
- 🟡 Seuils taux d'éclosion/mortalité embryonnaire recoupés, pas une
  étude ciblée.

### Manques réels identifiés
- **2 des 5 KPI du §6.4 sont "codés mais inatteignables"** :
  `computeFertilityRatePercent` et `computeInfectedRatePercent` existent
  et sont unitairement testés, mais **ne sont appelés par aucun endpoint
  ni exposés sur aucun champ calculé** — le client devrait les
  recalculer lui-même à partir des champs bruts.
- **`IncubationBatchesService.close()` et `BreederBatchesService.
  close()` n'ont aucun contrôle de cohérence**, contrairement à
  `BroilerBatchesService.close()` qui bloque explicitement si des sujets
  restent disponibles. Rien n'empêche de clôturer un lot d'incubation
  dont tous les poussins n'ont pas été orientés — violation potentielle
  non documentée de la règle §15 ("une clôture de lot doit vérifier les
  incohérences d'effectif").
- Rapports/exports Couvoir — voir constat transversal n°1.
- Alertes couvoir non testées sur leur contenu — voir constat
  transversal n°2.

---

## 6. Vente et distribution d'eau (Phase 6, cahier V5 §7)

### Livré et testé
Cycle complet du scénario E rejoué (`water-points.e2e-spec.ts`) : point
d'eau (code auto, verrou d'index initial), les 3 contrôles du §7.3
testés séparément (index soir < matin sans motif → 400 ; index matin
incohérent sans motif → 409 ; écart non justifié → 400), vente comptoir
et client identifié, rapprochement informatif `salesCashGapFcfa`, les
6 KPI du §7.5 vérifiés numériquement, alertes écart de caisse/absence de
relevé, RBAC "Responsable eau" conforme, isolation testée.

### Hors périmètre justifié
Abonnement/compte (§7.4) — le cahier le classe lui-même "prévu pour
évolution future". "Vente au récipient" — couverte génériquement par
`Sale.saleMode=UNITE` sans lien à un relevé, décision documentée.

### Dette connue, reclassée
- 🟡 Seuils d'écart de caisse (5 %/2000 FCFA) non sourcés, reconfigurables
  via `Setting`.
- 🟢 Absence de mécanisme de concurrence **confirmée toujours valide** —
  vérifié directement dans `sales.service.ts:174-184` (branche EAU) : pas
  de comparaison quantité/stock, donc pas de fenêtre de course
  comparable aux autres productTypes.

### Manques réels identifiés
- **`water_cash_reconciliations`** (table dédiée prévue au modèle §12)
  n'existe pas — le rapprochement est calculé à la lecture. Divergence
  réelle, pas nécessairement un défaut (plus simple, cohérent avec "pas
  de recalcul manuel"), mais aucun historique d'audit d'un
  "rapprochement" en tant qu'acte métier distinct.
- **Nuance sur la conclusion "pas de concurrence" du registre** :
  `WaterReadingsService.create()` fait bien une lecture-puis-comparaison
  (dernier index vs index soumis) **sans verrou** — pas une vérification
  de disponibilité au sens du registre transversal, mais structurellement
  une fenêtre de course qui pourrait, en théorie, laisser passer deux
  relevés concurrents avec une continuité d'index incohérente (§15). Le
  risque est très faible en usage réel (saisie quotidienne séquentielle
  par un seul responsable) — à nuancer dans le registre plutôt qu'à
  corriger dans l'immédiat.
- Pas de modèle `water_meters` distinct (juste un champ texte
  `meterReference`) — écart mineur non signalé.
- Rapports/exports Eau — voir constat transversal n°1.

---

## 7. Stocks, achats, finances et rentabilité (Phase 7, cahier V5 §8)

*(Audité directement, phase la plus récente.)*

### Livré et testé
Scénario F rejoué exactement (`items-stock.e2e-spec.ts`) : réception
500 kg (300 puis 200, écart tracé -200→0, statut dérivé
PARTIELLEMENT_RECU→RECU), distribution 50 kg → 450 kg restants + charge
valorisée. Cycle achat complet (commande → réception → paiement partiel →
plafond §15 testé, 409). CUMP correct. **Test de concurrence dédié**
(`Promise.all` sur deux sorties simultanées, `FOR UPDATE`, même gabarit
que la Phase 4). Rentabilité en cours d'activité sur Broiler/Layer/
Incubation/Eau. RBAC Magasinier vs Comptable testé.

### Hors périmètre justifié
Dashboard global (§9) — décision documentée, `TABLEAU_DE_BORD.md`
confirmé frontend-only.

### Dette connue, reclassée
- 🟢 `Item.currentStock` persisté (divergence de convention assumée,
  compensée par point d'écriture unique) — documenté.
- 🟡 CUMP non réversible rétroactivement — documenté, limitation connue
  de toute comptabilité CUMP.
- 🟢 Correctif `PaymentsService` (plafond §15) appliqué immédiatement en
  cours de phase — documenté avec raisonnement complet.

### Manques réels identifiés (non documentés avant ce bilan)
- **Aucune alerte stock (§10 : "seuil minimum, rupture") ni alerte
  financière (§10 : "facture impayée, dépense inhabituelle")** —
  contrairement à **toutes** les autres phases métier (Broiler, Layer,
  Breeder/Incubation, Water ont chacune leur `*-alerts.cron.ts`), aucun
  cron n'existe pour `items`/`stock-movements`/`treasury`/`payments`/
  `expenses`. Le statut VERT/ORANGE/ROUGE et le filtre
  `?belowThreshold=true` existent en lecture passive, mais rien ne
  pousse une alerte active. C'est le gap le plus net de cette phase.
- **`TreasuryService` a une couverture de test nulle** : ni test e2e, ni
  test unitaire. Le scénario G du cahier ("consolider ventes, dépenses,
  paiements et calculer la marge par activité puis globale") n'est donc
  jamais vérifié de bout en bout, alors que la fonctionnalité existe.
- **Les endpoints de rentabilité Layer/Incubation/Eau n'ont aucune
  couverture e2e** — seul `GET /broiler-batches/:id/profitability` est
  exercé par un test réel (`items-stock.e2e-spec.ts:318,340`). Les 3
  autres compilent et passent le typecheck mais n'ont jamais été appelés
  contre une vraie base de données par la suite de tests.
- **Concept multi-magasin absent, sans documentation de la décision** :
  le modèle de données du cahier (§12) liste une table `warehouses`
  dédiée, et le §8.2 liste explicitement "Transfert" (entrée entre
  magasins/bâtiments) comme fonction de stock. `Item.currentStock` est un
  nombre unique par ferme, sans notion de lieu de stockage ; aucun type
  `TRANSFERT` n'existe sur `StockMovement`. La décision "pas de 3ᵉ type
  TRANSFERT cette phase" a été prise pendant la conception mais **n'a
  jamais été écrite dans `DETTE_TECHNIQUE.md`** — contrairement à toutes
  les autres omissions volontaires du projet.
- **§8.7 "Suivi caisse et comptes de paiement"** partiellement couvert :
  le journal expose la méthode de paiement par ligne (`method`) mais
  n'agrège jamais par méthode/compte — pas de "solde par compte
  d'encaissement" (espèces vs virement vs mobile money).

---

## Synthèse rapide

| Module | Cœur métier | Concurrence testée | Dette 🔴 ouverte | Manque non documenté le plus notable |
|---|---|---|---|---|
| Auth/RBAC (P1) | ✅ solide | n/a | aucune | Pas d'API de rôle personnalisé par ferme |
| Socle (P2) | ✅ solide | n/a | aucune | Canal email des notifications jamais câblé |
| Chair (P3) | ✅ solide | ❌ non protégé | survente sans verrou | Pas de filtres/pagination sur la liste des bandes |
| Pondeuses (P4) | ✅ solide | ✅ FIFO testé | aucune | Calibres/plateaux non exploités malgré préparation partielle |
| Couvoir (P5) | ✅ solide | ❌ non protégé | survente sans verrou (partagée P3) | `close()` sans contrôle de cohérence d'effectif |
| Eau (P6) | ✅ solide | n/a (non applicable) | aucune | `WaterReadingsService.create()` : fenêtre de course non verrouillée sur l'index |
| Stocks/Finances (P7) | ✅ solide | ✅ testé (FOR UPDATE) | aucune | **Aucune alerte stock/financière** ; `TreasuryService` jamais testé |

**Seule dette 🔴 réellement ouverte à ce jour** : l'absence de verrou de
concurrence sur la vérification de disponibilité POULET_CHAIR/Incubation
(Phases 3 et 5), déjà identifiée, groupée, et dont le correctif
(`FOR UPDATE`, pattern déjà validé 2 fois sur ce projet) est bien défini
mais pas encore appliqué. Tout le reste est 🟠/🟡/🟢 — assumé, documenté
ou de faible impact.

---

## Recommandation

**Terminer d'abord un mini-chantier de durcissement transversal (1-2
jours), puis basculer sur le frontend — pas la V6.**

### Pourquoi pas la V6 en premier
La V6 (Patrimoine, IoT, QR, Prévisions IA, offline) ajoute de la surface
fonctionnelle neuve sur un socle qui n'a **aucun consommateur** à ce jour
— zéro écran construit, zéro retour utilisateur réel sur les 7 modules
déjà livrés. Ajouter une 8ᵉ couche de backend avant qu'un seul utilisateur
n'ait cliqué sur un écran de Poulets de chair est le chemin qui maximise
le risque de construire quelque chose qui ne collera pas à l'usage réel à
Samba — alors que le principe directeur même du projet ("une saisie
alimente tout automatiquement") ne peut être vérifié qu'en conditions
d'usage réelles, via une interface.

### Pourquoi pas la V6 non plus en second, avant le durcissement
Deux points 🔴/🟠 seraient contre-productifs à laisser trainer plus
longtemps s'ils passent devant le frontend :
1. La dette de concurrence POULET_CHAIR/Incubation (🔴) — un frontend qui
   expose la vente de poulets à plusieurs utilisateurs simultanés (le cas
   d'usage réel visé) rendrait cette fenêtre de course *atteignable* pour
   la première fois, alors qu'elle est restée théorique tant que seuls
   des tests e2e séquentiels et un seul utilisateur backend l'ont
   exercée.
2. L'absence totale d'alerte stock/financière (Phase 7) — un frontend
   affichant un tableau de bord sans alertes de rupture de stock ni de
   facture impayée serait un très mauvais premier contact utilisateur sur
   exactement les KPI que le cahier §9 met en avant en premier
   ("Articles sous seuil, valeur du stock, ruptures" / "Créances, dettes,
   résultat").

### Ordre recommandé
1. **Durcissement ciblé (avant tout, quelques jours)** : `FOR UPDATE` sur
   les 3 points de la dette transversale concurrence (Broiler/Incubation/
   Orientation) + cron d'alerte stock/financier minimal (Phase 7) +
   couverture e2e de `TreasuryService` et des 3 endpoints de rentabilité
   non testés. Ce sont des correctifs bornés, sur du code déjà écrit, pas
   une nouvelle phase métier.
2. **Frontend** (écrans réels sur les 7 modules déjà livrés) — c'est ce
   qui donnera la première vraie validation du principe directeur du
   projet et fera émerger les vrais besoins (dashboard §9, rapports/
   exports §14/§18, qui n'existent nulle part aujourd'hui et sont
   nécessaires quel que soit le chemin choisi ensuite).
3. **V6** ensuite, une fois qu'un retour d'usage réel existe pour prioriser
   correctement entre IoT/patrimoine/prévisions IA/offline plutôt que de
   deviner.

### Critères ayant motivé ce choix
- **Risque** : la dette 🔴 concurrence devient réellement dangereuse
  seulement avec un accès multi-utilisateurs simultané — exactement ce
  qu'un frontend introduit. La corriger avant, pas après.
- **Valeur utilisateur immédiate** : 7 modules backend complets et
  testés sans aucun écran ont une valeur nulle pour Samba tant qu'ils
  restent inaccessibles.
- **Dépendances techniques** : aucune fonctionnalité V6 (patrimoine, IoT,
  prévisions) ne dépend du frontend ou du frontend ne dépend d'elles —
  aucun couplage technique ne force un ordre particulier entre les deux,
  la décision est donc purement une question de priorité produit, pas de
  contrainte technique.
