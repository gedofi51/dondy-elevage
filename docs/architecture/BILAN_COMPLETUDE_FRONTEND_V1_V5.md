# Bilan de complétude frontend V1 → V5 (Phases 9 à 14)

Miroir du bilan déjà produit côté backend
(`docs/architecture/BILAN_COMPLETUDE_V1_V5.md`, avant la Phase 8) :
demandé maintenant que les cinq modules métier frontend (Eau, Poulets de
chair, Pondeuses, Reproduction/Couvoir, Stocks/Achats/Finances) et le
socle transversal (auth, permissions UI, design system, navigation,
dashboard) sont tous livrés sur `main`, avant d'enchaîner sur la V6
(Patrimoine, Autonomie, IoT, QR, Prévisions/IA).

**Méthode** : 6 agents de recherche indépendants (un par module métier +
un transversal sur le socle), chacun chargé de relire intégralement la
section pertinente du cahier des charges (`pdftotext -layout` sur les
PDF V1/V5, jamais un résumé) et de vérifier chaque affirmation par
lecture directe du code source actuel — pas par confiance en
`docs/architecture/DETTE_TECHNIQUE.md`, aux résumés de fin de phase, ou
à la mémoire du travail déjà fait. Chaque agent a reçu instruction
explicite de confirmer ou d'infirmer les points déjà documentés (en
relisant le code, pas en recopiant) et de chercher activement des
manques non documentés. Tous les chemins de fichiers cités ci-dessous
proviennent de lectures directes ; l'agent Couvoir a également exécuté
réellement les suites de tests concernées (21 tests frontend, 18 tests
backend) plutôt que de supposer qu'elles passent.

**Grille de sévérité** (identique au bilan backend) :
- 🔴 **Élevée** — risque réel d'intégrité financière ou de donnée
  corrompue en usage normal (pas seulement théorique).
- 🟠 **Modérée** — gap fonctionnel ou de couverture qui peut se
  manifester en usage réel mais à faible probabilité ou à impact borné.
- 🟡 **Faible** — paramètre non sourcé, dette documentaire, cosmétique,
  ergonomique.
- 🟢 **Assumé** — décision consciente, documentée, non problématique.

---

## Constats transversaux (avant le détail module par module)

Plusieurs manques ci-dessous ne sont pas spécifiques à un module — ils
ont été trouvés indépendamment par plusieurs agents, ce qui en fait des
chantiers transversaux plutôt que des oublis isolés.

1. 🟠 **Couverture de tests de composants quasi nulle sur 4 des 5
   modules métier.** Eau : 0 fichier sur 6 dans `features/water-points/**`
   (et 0 également sur `features/sales/**`, dont dépend pourtant le flux
   de vente d'eau). Poulets de chair : 0 fichier, confirmé par recherche
   exhaustive — y compris les fonctions pures faciles à tester
   unitairement (`day-number.ts`). Pondeuses : 0 fichier sur les deux
   dossiers `layer-batches/**` et `egg-stock/**` — alors que le calcul
   côté client `hen-count.ts` reproduit une logique backend sensible
   (risque de divergence silencieuse). Couvoir : 4 fichiers/21 tests,
   mais concentrés sur 2 dossiers (`incubation-batches`,
   `batch-lineage`) — `breeder-batches`, `chick-batches`, `incubators`
   restent à 0. Stocks/Achats/Finances : 4 fichiers sur 6 dossiers
   (`items` et `expenses` à 0, `treasury` sans même de sous-dossier
   `components/`). **Total sur tout `apps/web/src` : 9 fichiers de
   test**, confirmé indépendamment par deux agents. C'est plus large que
   ce que documente `DETTE_TECHNIQUE.md` module par module (qui ne cite
   que quelques formulaires précis par phase) : en pratique, seules les
   Phases 13/14 ont commencé à tester des fonctions pures à risque de
   divergence, les 3 modules précédents (Eau, Chair, Pondeuses) n'ont
   strictement aucun filet automatisé.
2. 🟢 **Absence de filtre/pagination serveur généralisée sur les listes
   de lots métier — confirmé, mitigation cohérente.** Zéro `@Query()`
   sur `GET /water-points`, `/broiler-batches`, `/layer-batches`,
   `/breeder-batches`, `/incubation-batches`, `/chick-batches`,
   `/purchase-orders`. Seuls `GET /items` (`category`+`belowThreshold`,
   vrai filtre serveur), `/expenses` (6 FK de rattachement, réel mais
   jamais exploité par la page liste), `/stock-movements` (`itemId`),
   `/supplier-payments` (`purchaseOrderId`) et `/treasury/*`
   (`from`/`to` obligatoires) ont un vrai filtre serveur. Le palliatif
   "toggle Actifs/Tous" côté client, quand il existe, est honnêtement
   commenté dans le code lui-même à chaque endroit — mais reste un
   filtrage en mémoire sur une liste déjà entièrement rapatriée,
   contraire à la contrainte réseau Samba à mesure que les fermes
   grandissent. `/water-points` est le seul endpoit sans même ce
   palliatif (ni serveur, ni client).
3. 🟡 **`extractMessage` appliqué à seulement 14 formulaires sur 28.**
   Trouvaille la plus significative de ce bilan sur le plan UX,
   remontée par l'agent transversal : le helper mutualisé
   (`lib/api/extract-error-message.ts`, extrait en Phase 11 d'un
   pattern dupliqué) est bien utilisé sur 14 formulaires (paiements
   fournisseurs, mouvements de stock, commandes/réceptions, bilan
   d'incubation, suivi journalier reproducteurs/pondeuses/eau,
   orientation, ventes, auth) — mais **14 autres formulaires**
   (`item-form`, `expense-form`, `layer-batch-form`,
   `health-event-form` Pondeuses, `incubator-form`, `chick-batch-form`,
   `broiler-batch-form`, `mortality-form`, `health-event-form` Chair,
   `daily-record-form` Chair, `closure-dialog` ×2, `breeder-batch-form`,
   `water-point-form`) font un `catch { }` sans capturer l'erreur et
   affichent un message générique fixe (« Échec de la création —
   vérifiez les champs. »), **perdant le message métier réel renvoyé
   par l'API** (conflit, règle violée, validation précise). Le clivage
   n'est pas strictement par phase : au sein d'un même module, le
   formulaire "journalier/relevé" (ajouté plus tard) utilise souvent le
   bon pattern quand le formulaire "batch principal" (créé plus tôt) ne
   l'a jamais été mis à jour — une dette de refactor jamais rattrapée
   depuis l'extraction du helper.
4. 🟡 **Dashboard global toujours une simple juxtaposition de KPI par
   module, sans Ventes/Dépenses/Marge.** `SALES_READ`/`EXPENSES_READ`
   n'apparaissent nulle part dans `app/(app)/page.tsx` malgré des
   modules Ventes/Dépenses complets et fonctionnels ailleurs dans
   l'app. Aucun graphique nulle part dans toute l'application (aucune
   dépendance `recharts`, dashboard 100 % `KpiCard` en chiffres bruts).
   Écart confirmé avec `docs/reference/TABLEAU_DE_BORD.md` et le §9 du
   cahier V1 (effectif total agrégé, mortalité cumulée, poids moyen,
   consommation, ventes, dépenses, marge, tâches du jour, graphiques
   mobile — tous absents ou seulement partiels). Cohérent avec la
   décision déjà actée côté backend en Phase 7 ("pas d'agrégation
   cross-module"), mais confirme que le frontend n'a pas fait évoluer
   ce choix alors que la donnée existe déjà pour Ventes/Dépenses.
5. 🟢 **KPI/calculs métier jamais exposés côté API, recalculés côté
   frontend — pas un défaut frontend.** GMQ Broiler : jamais recalculé
   côté client non plus (le principe CLAUDE.md "jamais de recalcul
   manuel" est respecté à la lettre — la donnée reste simplement
   absente). 4 KPI couvoir + solde de poussins orientables : recalculés
   fidèlement côté client, testés unitairement, sans coût réseau
   additionnel (champs déjà chargés) — contredit le principe "saisie
   unique" en toute rigueur architecturale, mais l'alternative (backend
   non modifiable cette phase) ne laissait pas d'autre choix. Dette
   structurellement backend, déjà documentée dans
   `BILAN_COMPLETUDE_V1_V5.md`.
6. 🟠 **Bouton "Vendre" (Chair) non gardé par l'état "lot ouvert",
   combiné à `cancel()` sans contrôle d'effectif.** Trouvaille de
   l'agent Chair : `broiler-batch-detail-view.tsx`, le bouton "Vendre"
   n'est gardé que par `SALES_CREATE`, **pas** par `isBatchOpen`
   (contrairement à Modifier/Clôturer, corrigés en Phase 12). Combiné
   au fait que `BroilerBatchesService.cancel()`
   (`broiler-batches.service.ts:429-443`) ne vérifie aucun effectif
   avant de passer le statut à `ANNULEE` (contrairement à `close()`,
   qui bloque si `currentHeadcount > 0`) — une bande annulée pourrait
   en théorie conserver des sujets vivants et rester vendable via ce
   bouton non gardé. Risque pratique nul aujourd'hui (aucune UI
   n'expose `/annuler` côté Chair, voir point 7), mais la combinaison
   est de la même famille que les bugs déjà corrigés en Phase 12
   (garde manquante sur une action sensible) — non détectée jusqu'ici
   faute d'avoir audité ce bouton précis.
7. 🟡 **Actions de correction/annulation existantes côté API+RBAC sans
   aucune surface UI, non documentées pour Chair/Pondeuses.** Recensées
   indépendamment par plusieurs agents : suppression d'un point d'eau
   (`WATER_POINTS_DELETE`, hook `useDeleteWaterPoint` inutilisé),
   correction d'un relevé déjà saisi (`PATCH .../readings/:date`,
   idem), édition/suppression d'une mortalité ou d'un événement
   sanitaire Chair (`BROILER_MORTALITY_UPDATE/DELETE`,
   `BROILER_HEALTH_EVENTS_UPDATE`, permissions distribuées mais jamais
   consommées côté UI), annulation/suppression d'une bande Chair
   (`POST /:id/annuler`, `DELETE /:id`), annulation d'un lot Pondeuses
   (`POST /:id/annuler`), annulation d'une commande fournisseur
   (`POST /:id/annuler`). Pour Reproducteurs/Couvoir et
   PurchaseOrder, ce report est déjà explicitement documenté et
   justifié (0 couverture e2e, critère déjà établi Phase 13/14) ; pour
   **Chair et Pondeuses, en revanche, ce n'était documenté nulle part
   avant ce bilan**.
8. 🟢 **Aucune dérive du design system trouvée sur les 5 modules** —
   confirmé indépendamment par les 6 agents : zéro couleur
   hexadécimale en dur, zéro classe Tailwind hors token, un seul
   dossier `ui/` (pas de doublon shadcn non retouché réintroduit), h1
   `font-heading` systématique via `PageHeader`, hiérarchie de titres
   respectée. Contraste et mode sombre restent dans l'état exact
   documenté en Phase 10 — confirmé par `git log` sur `tokens.css` :
   aucun commit dessus depuis le 2026-08-23 (Phase 10).
9. 🟢 **RBAC UI structurellement fiable.** `Can` consomme un type
   `PermissionCode` strict (union littérale dérivée de `PERMISSIONS`) —
   une faute de frappe sur un code de permission est une erreur de
   compilation TypeScript, pas un bug silencieux. Sur un échantillon de
   25+ usages vérifiés à travers les 5 modules, aucune incohérence
   trouvée entre la permission gardée côté UI et celle réellement
   exigée côté API. 9 permissions `*_DELETE` du catalogue
   (Suppliers/Customers/Buildings/Documents/Payments/WaterPoints + 3
   lots métier) ne sont jamais consommées côté UI — pas une faille de
   sécurité (l'API reste seule autorité, conforme à CLAUDE.md), mais
   confirme qu'aucun écran CRUD complet n'existe pour ces entités.
   Aucune page (ni liste, ni `nouveau/`) n'est enveloppée d'un `<Can>`
   au niveau route — pattern uniforme et assumé du projet
   (`permission-gate.tsx` documente lui-même "purement cosmétique,
   jamais la seule barrière"), pas un défaut propre à un module.
10. 🟡 **Aucun écran d'administration utilisateurs/rôles.** Les 11
    rôles réels de `roles.catalog.ts` ne sont ni visibles ni
    assignables depuis le frontend — `features/users/hooks.ts` n'expose
    qu'une lecture seule, utilisée uniquement pour résoudre un nom
    affiché dans des tableaux. Écart réel avec
    `docs/reference/UTILISATEURS_ET_AUTORISATIONS.md`.
11. 🟡 **OAuth Google/Microsoft : plomberie de retour câblée, aucun
    point d'entrée.** Le callback (`app/(auth)/oauth/callback/page.tsx`)
    fonctionne, mais aucun bouton/lien ne permet de démarrer le flux
    depuis `login-form.tsx` — recherche exhaustive de
    `google|microsoft|oauth` côté UI sans aucun point d'entrée trouvé.
    Fonctionnalité à moitié construite, jamais signalée jusqu'ici (à
    mettre en regard du point déjà documenté côté backend : "OAuth
    jamais testé avec de vraies credentials d'app").
12. 🟡 **Navigation mobile : dette de défilement horizontal toujours
    active à 12 entrées**, jamais résolue depuis son introduction en
    Phase 13 (alors documentée à 8 entrées) — `app-bottom-nav.tsx`
    (`overflow-x-auto`+`shrink-0`) reste un palliatif, pas une vraie
    sous-navigation par domaine.
13. 🟡 **2 N+1 backend non documentés, trouvés en auditant les patterns
    de consommation frontend.** `EggStockService.findLots`
    (`egg-stock.service.ts:63-72`) : 1 requête `findMany` pour les lots
    + 1 requête supplémentaire par lot via `attachRemaining`, alors que
    `getAvailableQuantity`/`computeClosureSummary` résolvent déjà le
    même problème avec un simple `include`. `LayerBatchesService.findAll`
    (`layer-batches.service.ts:181-187`, appelé à chaque chargement de
    `/pondeuses` et du dashboard) : 1 requête pour les lots + 1
    `aggregate` par lot pour l'effectif. Bornés par le nombre de lots
    d'une ferme (pas un vrai risque à l'échelle de Samba), mais un
    pattern moins efficace que ce qui existe déjà ailleurs dans le même
    service — dette backend, surfacée par cet audit frontend.
14. 🟡 **§8.7 "solde par compte d'encaissement" plus dégradé côté
    frontend que ce que suggérait le bilan backend.** Le champ
    `TreasuryJournalEntry.method` existe déjà dans la réponse API mais
    **n'est même pas affiché** dans le tableau du journal de trésorerie
    construit en Phase 14 (`tresorerie/page.tsx`, colonnes
    Date/Type/Source/Référence/Montant seulement) — sans même parler
    d'agrégation par méthode/compte.

---

## 1. Vente et distribution d'eau (Phase 9)

### Livré et vérifié
Liste des points d'eau, fiche détail avec KPI (§7.5), les deux onglets
Relevés/Ventes, formulaire de création/édition couvrant le §7.1, saisie
de relevé avec les 3 contrôles du §7.3 (index soir < matin, index matin
incohérent, écart non justifié — tous reflétés côté formulaire en
miroir du `superRefine` serveur), vente comptoir et client identifié
(réutilise `SaleForm` générique). Les 2 alertes eau du §10 sont bien
déclenchées côté backend (`WaterAlertsCronService`) et remontent dans
le widget générique du dashboard. RBAC vérifié cohérent trait pour
trait (Employé/Vendeur-Caisse n'ont pas `WATER_READINGS_READ`, les
cartes KPI financières sont bien masquées pour eux).

### Hors périmètre justifié
Abonnement/compte (§7.4, "prévu pour évolution future") — vérifié
activement absent de `schema.prisma` comme du code, pas de début
caché. "Vente au récipient" — couverte par `Sale.saleMode=UNITE` sans
relevé associé, décision déjà documentée et confirmée cohérente dans le
code actuel.

### Dette connue, reclassée
- 🟢 Pas de sélecteur de période KPI (mois en cours fixé côté front,
  aucun défaut serveur) — confirmé toujours exact.
- 🟢 Pas de pagination serveur sur `GET /water-points` — confirmé, sans
  palliatif client non plus (voir constat transversal n°2).
- 🟢 Bug de double-refresh de session (Phase 9) — confirmé corrigé,
  toujours présent dans `auth-client.ts`.

### Manques réels identifiés (non documentés avant ce bilan)
- 🟡 **Colonnes Montant théorique / Écart / Remarques absentes de la
  table des relevés** — calculées et stockées côté API
  (`theoreticalAmountFcfa`/`varianceFcfa`/`remarks`) mais jamais
  affichées ligne par ligne, seulement agrégées dans les KPI de
  période. Aucun écran d'édition/détail de relevé n'existe.
- 🟡 Aucun point d'entrée UI pour supprimer un point d'eau (voir
  constat transversal n°7).
- 🟡 Onglet "Relevés" non gardé par un `Can` explicite alors que
  l'endpoint sous-jacent exige `WATER_READINGS_READ` (contrairement à
  l'onglet KPI, lui bien gardé) — un utilisateur sans cette permission
  verrait une requête échouer silencieusement plutôt qu'un onglet
  masqué proprement.
- 🟢 Alertes eau fonctionnelles mais génériques (widget dashboard
  seul, pas de section dédiée sur la fiche) — non bloquant, le cahier
  ne demande pas explicitement d'écran dédié.

---

## 2. Poulets de chair (Phase 11)

### Livré et vérifié
Cycle complet (liste, création, fiche détail, suivi quotidien J1-J45
en 8 sections miroir du §5.1, mortalité 10 causes, santé 6 types,
vente, clôture avec résumé de cohérence). **Les 12 jalons calendaires du
§9 sont tous présents à l'identique.** RBAC vérifié conforme trait pour
trait au §14 (Vendeur/Caisse : lecture + vente seules ; Responsable
élevage : CRUD sans DELETE/CLOSE). Les 3 bugs déjà documentés
(`SelectValue` brute, Select non contrôlé, bouton Modifier sur lot
terminal) confirmés corrigés dans le code actuel des 5 formulaires du
module.

### Hors périmètre justifié
§28 du cahier (pondeuses/reproduction/eau exclus du périmètre V1) —
cohérent, couvert par les autres modules. Aucun graphique (courbe de
poids, §18) — conséquence attendue de l'absence totale du module
Rapports/Exports déjà documentée transversalement côté backend, pas un
manque spécifique à ce module.

### Dette connue, reclassée
- 🟢 GMQ non affiché (calcul existe, jamais exposé côté API) —
  confirmé toujours exact.
- 🟢 Statuts terminaux contournés côté UI seulement (`<Select>`
  restreint à 8 valeurs libres) — confirmé, source backend inchangée.
- 🟢 `GET /broiler-batches` sans filtre/pagination serveur — confirmé,
  palliatif toggle client uniquement.

### Manques réels identifiés (non documentés avant ce bilan)
- 🟠 Bouton "Vendre" non gardé par `isBatchOpen` + `cancel()` sans
  contrôle d'effectif (voir constat transversal n°6).
- 🟡 **Liste des bandes très réduite vs §4.2** : 5 colonnes sur 13
  attendues, aucun des filtres/recherche du cahier (année, statut,
  bâtiment, responsable, période, phase, origine), pas même côté
  client — seul le toggle Actives/Toutes.
- 🟡 **Fiche très réduite vs §4.4** : 4 onglets sur 10 attendus.
  Dépenses, Documents et Historique sont totalement absents de la
  fiche de bande.
- 🟡 **Données déjà calculées par l'API mais jamais affichées** :
  `finalAverageWeightG`, `totalFeedConsumptionKg`,
  `costPerChickSoldFcfa` existent dans la réponse `/profitability`
  (déjà fetchée) mais ne sont rendues nulle part sur la fiche ni dans
  le dialog de clôture — un gap d'affichage pur, pas de calcul.
- 🟡 Aucune UI pour éditer/supprimer une mortalité ou un événement
  sanitaire, ni pour annuler/supprimer une bande (voir constat
  transversal n°7) — malgré le §17 ("journaliser les corrections des
  données critiques") et le §14 ("Supprimer/annuler bande" listé comme
  droit à part entière).

---

## 3. Pondeuses (Phase 12)

### Livré et vérifié
Cycle complet (liste, création, fiche détail, suivi journalier créé à
la demande, santé, stock d'œufs FIFO, vente, clôture, alertes,
dashboard KPI). Les formules du §5.3 (`computeEggsSellable`,
`computeLayingRatePercent`, `computeCostPerEggFcfa`) vérifiées exactes
dans le code et affichées correctement. FIFO livré et testé en
concurrence (`SELECT ... FOR UPDATE`). Les 3 bugs déjà documentés
(bouton Modifier sur lot terminal, Select non contrôlé, `SelectValue`
brute) confirmés corrigés dans le code actuel.

### Hors périmètre justifié
Réforme/vente des poules elles-mêmes en fin de lot — confirmé absent,
cohérent avec le cahier à ce stade.

### Dette connue, reclassée
- 🟢 `/annuler` non exposé côté frontend (0 couverture e2e confirmée
  par grep direct sur `layer-batches.e2e-spec.ts`) — toujours exact.
- 🟢 Colonne "taux de ponte récent" absente de la liste (le
  commentaire du code documente lui-même le N+1 qu'ajouter cette
  colonne provoquerait) — décision assumée, confirmée.
- 🟢 `GET /layer-batches` sans filtre/pagination serveur — confirmé,
  toggle client uniquement.

### Manques réels identifiés
- 🟢 **Calibres** : `EggStockLot.caliber` figé à `"non_calibre"` (0
  DTO ne l'expose), le tableau frontend affiche la colonne mais
  neutralise systématiquement la valeur (`— ` si non calibré) — un
  écho passif documenté explicitement dans le code lui-même, rien de
  nouveau au-delà de ce que `DETTE_TECHNIQUE.md` documente déjà.
- 🟡 **Plateaux (conversion unités ↔ plateaux, §5.4)** : recherche
  exhaustive `plateau|tray` sur tout `apps/` — **zéro occurrence**,
  confirmé totalement absent (ni implémenté, ni un champ préparé
  contrairement aux calibres).
- 🟡 2 N+1 backend non documentés (`EggStockService.findLots`,
  `LayerBatchesService.findAll`) — voir constat transversal n°13.
- 🟡 Fiche de lot : 7 requêtes indépendantes au montage, aucune
  conditionnée à l'onglet actif (3 des 7 ne servent qu'à l'onglet
  "Suivi journalier" initialement affiché).

---

## 4. Reproduction / Couvoir (Phase 13)

### Livré et vérifié
Les 4 écrans (couveuses CRUD, lots reproducteurs + suivi journalier,
lots d'incubation + bilan mirage/éclosion, lots de poussins) et la
filiation bidirectionnelle (`LineageTable` aval, `OriginCard` amont)
sont réellement présents, conformes au §6 ligne à ligne (§6.1 à §6.5
tous vérifiés champ par champ). Les 4 destinations d'orientation
(CHAIR/RENOUVELLEMENT/VENTE/REFORME_PERTE) sont exactement câblées.
RBAC "Responsable couvoir" conforme au §11. **21 tests frontend + 18
tests backend exécutés réellement pendant cet audit, tous passants.**

**Cas rare et notable** : chaque affirmation de `DETTE_TECHNIQUE.md`
Phase 13 vérifiée s'est révélée exacte à la ligne près — aucun bug ni
manque fonctionnel nouveau trouvé sur le périmètre strict du module,
au-delà de ce qui était déjà documenté.

### Hors périmètre justifié / différé, confirmé exact
- 🟠 `/cloturer`/`/annuler` (Breeder/Incubation) : existent côté API,
  0 couverture e2e, aucun bouton UI — **risque concret reconfirmé** :
  `NON_CANCELLED_INCUBATION_STATUSES` exclut les incubations annulées
  du calcul de `availableFertileEggs`, et `cancel()`/`close()` ne
  vérifient ni `chicksHatched` ni `BatchLineage` déjà créés — annuler
  un lot dont les poussins ont déjà été orientés recréditerait
  silencieusement le solde du lot reproducteur parent. Différé à
  raison, pas une négligence.
- 🟢 `ChickBatch` sans endpoint dédié de clôture — le formulaire
  n'expose que `buildingId`, jamais `status`, confirmé cohérent.
- 🟢 4 KPI couvoir + solde orientable recalculés côté client, jamais
  exposés côté API — sans coût réseau additionnel (voir constat
  transversal n°5).
- 🟢 `GET /breeder-batches`, `/incubation-batches`, `/chick-batches`
  sans filtre/pagination serveur — confirmé sur les 3 contrôleurs.
- 🟠 `Incubator.remove()` sans garde 409 (confirmé : `delete()` nu,
  500 générique attendu) — signalé, pas corrigé (hors périmètre
  frontend).

### Manques réels identifiés
- 🟡 Fiche d'un lot d'incubation : 5 requêtes GET en waterfall à deux
  étages (3 en parallèle puis 2 dépendantes) — aucun endpoint agrégé,
  coût de latence réel sur la connectivité Samba.
- 🟢 Point vérifié et écarté (pas une régression) : l'usage de
  `text-warning` sans halo dans `orientation-form.tsx`/
  `incubation-batch-form.tsx` a été mesuré au contraste WCAG
  (~4,93:1) — meilleur que le badge déjà documenté (~4,34:1), une
  simple divergence de style mineure entre deux conventions
  coexistantes, pas un défaut.

---

## 5. Stocks, achats, finances et rentabilité (Phase 14)

### Livré et vérifié
Catalogue articles avec statut VERT/ORANGE/ROUGE et catégorie guidée
par `<datalist>`, mouvement de stock manuel avec justification
conditionnelle, cycle achat complet (premier `useFieldArray` du
frontend, confirmé), réception avec écart déjà calculé serveur,
paiement avec avertissement de dépassement de solde (§15, testé),
dépenses générales et rattachées (6 types d'entité via un composant
générique local `EntityRefSelect`), trésorerie (journal/créances/
dettes/résumé, 4 endpoints déjà consolidés, consommés 1-pour-1 sans
assemblage client). Les 2 bugs déjà documentés (`itemId` fantôme,
`date` manquante) confirmés corrigés dans le code actuel. RBAC vérifié
au niveau bouton/section (pas seulement hook) : séparation
Magasinier/Comptable fonctionnelle et confirmée par fallback explicite.

### Différé explicitement, confirmé exact
- 🟢 `/annuler` PurchaseOrder non exposé (0 couverture e2e).
- 🟠 Bouton "Réceptionner" restreint à COMMANDE/PARTIELLEMENT_RECU côté
  UI — **le gap serveur n'est toujours pas corrigé** :
  `GoodsReceiptsService.create()` ne rejette que ANNULE/RECU, une
  commande BROUILLON reste techniquement réceptionnable par un appel
  API direct.
- 🟢 Pas d'écran Suppliers/Buildings — confirmé absent, cohérent avec
  le pattern déjà établi (Buildings jamais eu d'UI en 5 phases).

### Manques réels identifiés
- 🟡 **`GET /expenses` a en réalité un filtre serveur réel** (6 FK de
  rattachement) — la formulation actuelle de `DETTE_TECHNIQUE.md`
  ("aucun filtre/pagination serveur") est imprécise : le filtre existe,
  seulement jamais exploité par la page liste actuelle.
- 🟡 §8.7 "solde par compte d'encaissement" — voir constat transversal
  n°14, plus dégradé côté UI que ce que suggérait le bilan backend.
- 🟡 Fiche d'une commande fournisseur : 6 requêtes GET, dont 2
  (`/suppliers`, `/items`) chargent l'intégralité du référentiel juste
  pour résoudre quelques libellés — mitigé par le cache React Query
  partagé avec les autres pages du module, mais un coût réel dès que
  ces référentiels grandissent (aucune pagination sur les deux).

---

## 6. Socle transversal (auth, permissions UI, design system, navigation, dashboard — Phases 9-10 et évolutions 11-14)

### Auth
Login, refresh silencieux dédoublonné (confirmé toujours en place),
2FA TOTP, mot de passe oublié/réinitialisation, activation de compte —
tous réellement implémentés et fonctionnels. 🟡 **OAuth Google/Microsoft
inutilisable en pratique** : callback câblé, aucun point d'entrée côté
UI (voir constat transversal n°11). 🟡 Aucun test de composant sur les 4
formulaires d'auth restants, confirmé inchangé depuis Phase 9 malgré 5
phases supplémentaires.

### Permissions UI (`Can`)
🟢 Mécanisme structurellement fiable (type strict `PermissionCode`),
matrice de cohérence vérifiée sur 25+ usages à travers les 5 modules
sans aucune incohérence — voir constat transversal n°9.

### Design system
🟢 Aucune dérive transversale détectée (0 couleur en dur, 0 classe
Tailwind hors token) — voir constat transversal n°8.

### Navigation
🟡 12 entrées, chacune correctement gardée par sa permission `*_READ`.
Dette de défilement horizontal mobile toujours active (constat
transversal n°12).

### Dashboard
🟡 Reste une juxtaposition de KPI par module. Écart confirmé avec
`docs/reference/TABLEAU_DE_BORD.md` : Ventes/Dépenses/Marge/mortalité
cumulée/poids moyen/consommation/tâches du jour/graphiques tous absents
ou partiels (voir constat transversal n°4).

### Accessibilité / mode sombre
🟢 Calcul de contraste Phase 10 toujours valide (`tokens.css` non
modifié depuis, confirmé par `git log`). 🟢 Mode sombre toujours un
simple placeholder identique au thème clair, conforme à la décision
Phase 0.

### Performance / bundle
`npm run build --workspace=apps/web` exécuté avec succès (Next.js
16.3.1, Turbopack, 35 pages générées). 🟡 Turbopack n'imprime plus de
détail Size/First Load JS par route sur cette version — mesure de
repli : **3,29 Mo** de JS statique réellement livré au client
(`.next/static/`). Pas alarmant en absolu pour 5 modules métier + auth,
mais sans détail par route, une régression progressive ne serait pas
facilement détectable — `@next/bundle-analyzer` recommandé si le suivi
doit devenir un contrôle récurrent.

### RBAC — rôles réels vs usage frontend
🟡 Les 11 rôles réels ne sont ni visibles ni assignables depuis le
frontend — aucun écran d'administration utilisateurs/rôles (constat
transversal n°10).

### Cohérence des conventions
🟢 `ConfirmDialog` utilisé de façon homogène pour toute action
destructive, aucune déviation trouvée. 🟢 RHF+Zod+feature folders
respectés sans exception détectée. 🟡 `extractMessage` : adoption
incomplète et quantifiée (constat transversal n°3) — la déviation la
plus significative de cette section.

---

## Synthèse rapide

| Module | Cœur métier | Tests composants | Filtre/pagination serveur réel | Dette la plus notable |
|---|---|---|---|---|
| Eau (P9) | ✅ solide | 0 fichier | Aucun (ni serveur ni client) | Colonnes Montant théorique/Écart/Remarques absentes des relevés |
| Chair (P11) | ✅ solide | 0 fichier | Non (toggle client) | 🟠 Bouton "Vendre" non gardé par `isBatchOpen` + `cancel()` sans contrôle d'effectif |
| Pondeuses (P12) | ✅ solide | 0 fichier | Non (toggle client) | 2 N+1 backend non documentés (`findLots`, `findAll` headcount) |
| Couvoir (P13) | ✅ solide, dette déjà connue confirmée exacte | 4 fichiers/21 tests (2 dossiers sur 5) | Non (toggle client ×3) | 🟠 Risque de recrédit silencieux confirmé sur `/annuler` Incubation (différé à raison) |
| Stocks/Achats/Finances (P14) | ✅ solide | 4 fichiers/6 dossiers | Partiel (Items/Expenses/StockMovements/SupplierPayments/Treasury oui, PurchaseOrders non) | 🟠 Réception sur BROUILLON toujours non gardée côté serveur |
| Socle transversal | ✅ RBAC/design fiables | Auth non testée | n/a | 🟡 `extractMessage` sur 14/28 formulaires seulement ; dashboard sans Ventes/Dépenses/Marge ; OAuth inutilisable |

**Aucune dette 🔴 trouvée dans ce bilan.** Le point le plus proche
d'une vraie criticité (🟠) est la combinaison bouton "Vendre" non
gardé + `cancel()` sans contrôle d'effectif sur Poulets de chair —
borné aujourd'hui par l'absence de tout bouton `/annuler` côté UI, mais
à corriger avant qu'un tel bouton n'apparaisse dans une phase future.

---

## Recommandation

**Enchaîner sur une phase de durcissement frontend ciblée (quelques
jours), avant la V6 — pas directement sur la V6.**

### Pourquoi pas la V6 directement
Trois axes rendraient une V6 immédiate plus coûteuse à rattraper après
coup qu'à corriger maintenant :
1. **`extractMessage` sur 14/28 formulaires seulement** — chaque
   nouveau module V6 (Patrimoine, Autonomie...) ajoutera par défaut des
   formulaires suivant l'un ou l'autre pattern selon lequel fichier sert
   de modèle ; plus on attend, plus le rattrapage sera large.
2. **Couverture de tests quasi nulle sur Eau/Chair/Pondeuses** — un
   chantier V6 ajoutera de la surface fonctionnelle sur un socle déjà
   fragile côté régression ; combler maintenant les fonctions pures les
   plus à risque (`hen-count.ts`, `day-number.ts`) coûte peu et borne le
   risque avant qu'il ne s'accumule sur 3 modules de plus.
3. **Le bouton "Vendre" non gardé (Chair)** devient un vrai risque dès
   qu'un futur chantier ajoute le bouton `/annuler` manquant côté UI —
   autant corriger la garde maintenant, pendant qu'elle est encore
   théorique, plutôt que de la découvrir en marchant sur les traces de
   Phase 12 une deuxième fois.

### Pourquoi pas un chantier plus large non plus
Contrairement au bilan backend (qui avait une dette 🔴 réelle et un
cron d'alerte totalement absent), rien ici n'est bloquant pour l'usage
réel à Samba : le design system est irréprochable, le RBAC UI est
fiable, aucune corruption de donnée n'est possible depuis le frontend.
Les manques (dashboard incomplet, pas d'écran d'administration des
rôles, OAuth inutilisable, colonnes manquantes) sont des gaps de
complétude/ergonomie, pas de sécurité ni d'intégrité. Un chantier trop
large retarderait inutilement la V6 sur des points qui peuvent
attendre.

### Ordre recommandé pour le durcissement ciblé
1. Garde `isBatchOpen` sur le bouton "Vendre" (Chair) — correctif
   trivial, même patron que Phase 12.
2. Rollout `extractMessage` sur les 14 formulaires restants —
   mécanique, bornée, gain UX réel et immédiat.
3. Dashboard : ajouter KPI Ventes/Dépenses/Marge (données déjà
   exposées par des endpoints existants, aucun backend à toucher).
4. Colonnes manquantes triviales : Montant théorique/Écart/Remarques
   (relevés eau), Méthode de paiement (journal trésorerie).
5. OAuth : décision explicite à trancher avec le porteur de projet
   (câbler le bouton dès maintenant, ou documenter volontairement le
   report tant qu'aucune credentials d'app réelle n'existe) plutôt que
   de laisser une fonctionnalité à moitié construite sans arbitrage.
6. Les 2 N+1 backend trouvés (`EggStockService.findLots`,
   `LayerBatchesService.findAll`) — correctifs bornés, sur du code déjà
   écrit.

### Explicitement hors du durcissement ciblé, à documenter comme
backlog plutôt qu'à traiter maintenant
- Couverture de tests de composants complète sur les 5 modules — trop
  large pour un chantier ciblé, à traiter progressivement.
- Édition/suppression de mortalité/santé (Chair), correction de relevé
  (Eau), annulation de bande (Chair/Pondeuses) — fonctionnel mais pas
  bloquant, la création reste possible.
- Écran d'administration utilisateurs/rôles — plus proche d'une
  nouvelle fonctionnalité que d'un correctif, candidat pour une future
  phase "référentiels partagés" (déjà envisagée pour
  Buildings/Suppliers).

### Critères ayant motivé ce choix
- **Risque** : rien de 🔴, un seul 🟠 par module en moyenne — un
  chantier ciblé de quelques jours suffit, pas une phase complète.
- **Coût de report** : les 3 points listés en tête (extractMessage,
  tests, garde Vendre) grandissent avec chaque nouveau module ajouté —
  les corriger avant la V6 borne leur coût futur.
- **Valeur utilisateur immédiate** : les correctifs proposés (messages
  d'erreur réels, KPI Ventes/Dépenses visibles) sont directement
  perceptibles par les utilisateurs à Samba, contrairement à la
  majorité de la V6.
- **Aucune dépendance technique** entre ce durcissement et la V6 —
  l'ordre est une question de priorité produit, pas une contrainte
  technique.
