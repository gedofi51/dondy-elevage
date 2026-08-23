# DETTE TECHNIQUE — DONDY ELEVAGE

Registre centralisé, phase par phase, des points de dette technique déjà
signalés dans les rapports de mission. Objectif : éviter qu'un point
transversal (touchant plusieurs phases) reste noyé dans une seule PR et
soit traité comme un détail isolé plutôt que comme un vrai chantier à part
entière. Un point de dette est retiré de ce registre uniquement quand il
est corrigé (avec référence au commit/PR de correction), jamais par
suppression silencieuse.

Pour le détail complet Phases 0-1 (Docker, Prisma, Auth/RBAC), voir aussi
[`README.md`](./README.md) — ce document n'en reproduit que les points
encore ouverts, sans dupliquer les sections déjà résolues.

## Phase 0 — Fondations techniques

- **Conteneur `web` non fonctionnel sur Windows** (erreur de résolution
  CSS `tw-animate-css`, `500` systématique) — cause exacte non identifiée
  après 7 hypothèses écartées avec preuve. Contournement accepté et
  toujours en vigueur : `web` tourne en natif sur l'hôte, `mysql`/`redis`/
  `api`/`nginx` restent orchestrés via Docker (voir CLAUDE.md, section
  "Mode de développement hybride Windows"). Détail complet dans
  `README.md`, section "Blocage non résolu".
- **Vulnérabilité `npm audit` connue et acceptée** : `deepmerge-ts < 8.0.0`
  (dépendance transitive de `@prisma/config`, CLI uniquement — jamais
  livré en production). Aucune version stable de Prisma 7 ne la corrige à
  ce jour. À réévaluer à la prochaine version stable de Prisma.
- **Mode sombre non conçu** — différé sciemment, `tokens.css` garde un
  bloc `.dark` placeholder identique au thème clair.

## Phase 1 — Auth, Users, RBAC, Farms, Buildings

- **OAuth Google/Microsoft implémenté mais jamais testé en conditions
  réelles** — aucune credentials d'app disponible au moment du
  développement.
- **Rate limiting IP uniquement**, pas d'axe email dédié.
- ~~**`test:e2e` non intégré à la CI**~~ — **corrigé depuis, entrée
  laissée en trace plutôt que supprimée silencieusement** (principe de ce
  registre). C'était une dette réelle au moment de la rédaction de cette
  ligne (2026-08-20), mais `.github/workflows/ci.yml` provisionne en
  réalité un service `mysql:8.4` et exécute
  `npm run test:e2e --workspace=apps/api` depuis le commit `c4846fa`
  (2026-08-18) — **antérieur** à la rédaction de cette entrée. Signalé
  comme incohérence par le bilan de complétude V1-V5 (Phase 8,
  `docs/architecture/BILAN_COMPLETUDE_V1_V5.md`) : dette **documentaire**
  (le registre affirmait un état déjà faux), pas dette réelle du pipeline
  lui-même.
- **Permissions embarquées dans le JWT à la connexion** : un changement de
  rôle par un admin n'est effectif qu'au prochain login/refresh (15 min
  maximum), jamais en cours de session.

## Phase 2 — Suppliers, Customers, Documents, Alerts, Notifications

Rapport de mission détaillé non reproduit ici (antérieur à l'historique
disponible dans cette session) — se référer à la discussion de
[PR #1](https://github.com/gedofi51/dondy-elevage/pull/1) sur GitHub pour
le détail exact des risques signalés à l'époque plutôt qu'une
reconstruction approximative. Aucun point de dette de cette phase n'a été
identifié comme actif dans les phases suivantes.

## Phase 3 — Poulets de chair (J1-J45)

- ~~**Vérification de disponibilité `SalesService`/`POULET_CHAIR` sans
  verrou**~~ — **corrigé en Phase 8**, voir "✅ Corrigé".
- **`remove()` étendu au-delà du périmètre initialement prévu** :
  `BroilerBatchesService.remove()` bloque le hard-delete dès qu'une
  activité liée existe, y compris `BroilerMortality`/`BroilerHealthEvent`
  en plus d'`Expense`/`Sale` — extension volontaire, jugée plus sûre, mais
  au-delà de la formulation littérale du plan d'origine.
- **Indice de consommation (feed conversion ratio) approximatif** dans le
  résumé de clôture : le poids d'arrivée des poussins (quelques dizaines
  de grammes) est négligé dans le calcul du gain de poids vif — erreur
  induite marginale sur un poulet de ~1,5-2 kg à J45, jamais quantifiée
  précisément.
- **Pas de verrouillage de champ sur `BROILER_BATCHES_UPDATE`** après le
  début d'activité (ex. modifier `receivedQuantity` après des ventes déjà
  enregistrées reste possible).
- **Alerte "poids inférieur à l'objectif" (§9.1) non implémentée** —
  nécessiterait une courbe de poids-cible par jour absente du périmètre
  donné à cette phase.

## Phase 4 — Pondeuses et stock d'œufs

- **Bug amont confirmé et non résolu de `@prisma/adapter-mariadb` 7.9.1**
  (seule version stable publiée à ce jour) : des connexions ne sont pas
  rendues au pool, restent indéfiniment en état "Sleep"
  ([prisma/prisma#28964](https://github.com/prisma/prisma/issues/28964)).
  Contourné pour la consommation FIFO du stock d'œufs en remplaçant
  `isolationLevel: Serializable` par un verrouillage `SELECT ... FOR
  UPDATE` classique (`EggStockService.consumeFifoInternal`) — le bug amont
  lui-même reste ouvert et pourrait resurgir sur tout futur usage naïf de
  transactions Serializable dans ce projet. **Ne pas réintroduire
  `isolationLevel: Serializable` sans revérifier que ce ticket amont est
  résolu.**
  - Seuil de mortalité pondeuses (0,1 %/0,5 % IMPORTANT/CRITIQUE) faute de
    chiffre quotidien sourcé spécifique à la phase de ponte adulte —
    recoupé avec des données annexes, mais pas directement sourcé pour ce
    cas précis. Reconfigurable sans déploiement (`Setting`).
- **Seuil de déviation de consommation d'aliment (20 %)** assumé comme
  paramètre d'ingénierie, aucune source documentée trouvée pour ce cas
  précis (contrairement aux autres seuils de cette phase).
- **Fractionnement d'un lot d'œufs en plusieurs calibres après
  production** : hors périmètre V1, aucun workflow de tri/calibrage décrit
  dans le cahier des charges à ce stade.
- **Réforme/vente des poules pondeuses elles-mêmes en fin de lot** : hors
  périmètre Phase 4, aucun champ dédié dans le cahier à cette phase.

## Phase 5 — Reproductrices, couvoir et poussins

- ~~**Vérification de disponibilité `IncubationBatch`/`OrientationService`
  sans verrou**~~ — même point que Phase 3, reconduit délibérément, pas un
  nouveau gap à l'époque. **Corrigé en Phase 8**, voir "✅ Corrigé".
- **Température/humidité de couveuse hors périmètre** : aucune saisie de
  ce type n'existe dans le périmètre donné à cette phase (pas de capteurs
  IoT — cohérent avec le cahier V6, qui classe explicitement l'IoT couveuse
  hors périmètre V5).
- **Suivi d'effectif journalier des reproducteurs hors périmètre** : le
  cahier §6.2 ne demande qu'un suivi de production d'œufs, aucun champ
  mortalité/réforme/autres sorties pour les reproducteurs eux-mêmes
  (contrairement aux pondeuses en Phase 4).
- **Seuils de taux d'éclosion/mortalité embryonnaire** sourcés par
  recoupement de bornes catégorielles (poultryhatch.com, thepoultrysite.com)
  plutôt que par une étude ciblée sur ces seuils précis — même niveau de
  rigueur que les autres seuils déjà sourcés dans le projet, mais à
  reconsidérer si une source plus directement applicable apparaît.

## Phase 6 — Vente et distribution d'eau

- **Pas d'occurrence de la dette transversale "vérification de
  disponibilité sans verrou"** (voir "✅ Corrigé", Phase 8) : la vente d'eau
  (`Sale`, productType=EAU) n'a, structurellement, **aucune** vérification
  de disponibilité/stock à faire (l'eau n'est pas un lot fini avec
  effectif, contrairement à `POULET_CHAIR`/`OEUFS`/`POUSSINS`) — donc
  aucune fenêtre de course lecture-puis-écriture comparable. La contrainte
  unique `[waterPointId, date]` sur `WaterReading` protège nativement les
  doublons de relevé, comme `BreederDailyRecord`/`LayerDailyRecord`,
  jamais signalée comme un gap dans ces modules non plus. Conclusion
  explicitement vérifiée avant implémentation (voir plan Phase 6, section
  "Concurrence") : ce n'est pas de la dette différée, le problème
  n'existe simplement pas dans ce module.
- **Seuils d'écart de caisse (5 % / 2 000 FCFA) non sourcés** —
  `water.cash_variance_threshold_percent`/`water.cash_variance_threshold_fcfa_floor`
  (`WaterAlertsCronService`), paramètres d'ingénierie assumés faute de
  norme publiée pour la tolérance de caisse d'un point de vente d'eau
  informel (contrairement aux seuils avicoles sourcés des phases
  précédentes). Même traitement que
  `DEFAULT_FEED_DEVIATION_THRESHOLD_PERCENT` (Phase 4), reconfigurables
  sans déploiement (`Setting`).
- **Angle mort constaté (pas introduit par cette phase) : `remove()` sans
  garde-fou réel sur `Building`/`Incubator`/`Supplier`** — ces trois
  services font un `prisma.X.delete()` nu, sans `count()` préalable ni
  interception de `PrismaClientKnownRequestError` P2003 ; une suppression
  avec des données liées existantes remonterait probablement une erreur
  500 non gérée plutôt qu'un 409 propre. Repéré lors de la revue du plan
  Phase 6 (comparaison avec le garde-fou explicite de
  `BroilerBatchesService.remove()`). **Non corrigé sur ces trois entités**
  (hors périmètre demandé — corriger du code de phases antérieures non
  sollicité). `WaterPointsService.remove()`, créé dans cette même phase,
  **en est exempté dès l'origine** : garde-fou explicite ajouté
  directement (`count()` sur `WaterReading`/`Sale` liés → 409).
- **"Vente au récipient" (§7.1, unité tarifaire alternative) non
  implémentée comme flux dédié** : couverte structurellement par
  `Sale.saleMode = UNITE` + `Sale.unitPriceFcfa` saisi librement par
  vente (comme toute vente généralisée), sans relevé `WaterReading`
  associé — pas un champ manquant, une conséquence directe de la
  décision de ne pas ajouter de structure tarifaire multi-unité à
  `WaterPoint` (le §7.2 et le scénario §16-E sont exclusivement
  index/m³). À revoir si l'usage réel montre un besoin différent.

## Phase 7 — Stocks, achats, finances et rentabilité

- **`Item.currentStock`/`Item.averageUnitCostFcfa` persistés, DIVERGENCE
  assumée par rapport à la convention dominante du projet** (partout
  ailleurs : `BroilerBatch.currentHeadcount`, `EggStockLot.remaining`,
  `BreederBatch.availableFertileEggs`... sont dérivés à la lecture, jamais
  stockés). Justification : un article générique consommé quotidiennement
  sur toute la durée de vie de la ferme a un volume de mouvements non
  borné dans le temps (contrairement à un lot borné à 45-90 jours) —
  sommer tous les `StockMovement` à chaque lecture deviendrait coûteux à
  mesure que l'historique grandit. Compensée par une discipline stricte de
  **point d'écriture unique** : `StockMovementsService.
  recordMovementInTransaction()` est le SEUL endroit du code qui écrit ces
  deux champs — vérifié à la revue, aucun autre service n'y touche
  directement. Risque résiduel : un bug futur qui contournerait ce point
  d'entrée (écriture directe `prisma.item.update({data:{currentStock:...}})`
  ailleurs) ferait dériver silencieusement le compteur sans qu'aucun test
  actuel ne le détecte spécifiquement — à surveiller en revue de code plutôt
  qu'un risque activement mitigé par un mécanisme automatique.
- **CUMP (coût moyen pondéré) non réversible rétroactivement** — corriger
  une `ACHAT` à mauvais prix après coup ne peut pas restaurer "ce que le
  CUMP aurait dû être" sans rejouer tout l'historique des mouvements ;
  chaque `StockMovement.unitCostFcfaSnapshot` fige le coût au moment du
  mouvement, jamais recalculé après coup (même principe que
  `WaterReading.tariffFcfaPerM3Snapshot`, Phase 6). Limitation connue de
  toute comptabilité CUMP réelle (contrairement au FIFO des œufs, où
  chaque lot garde son identité propre et peut être corrigé
  individuellement) — même niveau d'acceptation que l'indice de conversion
  alimentaire approximatif de la Phase 3.
- **Rentabilité `IncubationBatch`** : le chiffre d'affaires ne compte que
  les ventes de poussins issus d'une orientation VENTE
  (`BatchLineage.childType='chick_batch'`) — les orientations
  CHAIR/RENOUVELLEMENT (transfert vers une bande poulet de chair/pondeuse)
  ne génèrent délibérément aucun CA côté couvoir, pour éviter un double
  comptage avec le P&L de la bande destinataire. Effet de bord accepté :
  un couvoir qui oriente surtout vers du renouvellement interne affichera
  une rentabilité structurellement faible/négative (charges d'incubation
  sans CA en face), ce qui reflète une réalité comptable réelle (le couvoir
  n'est dans ce cas qu'un centre de coût interne), pas un bug.
- **Trésorerie (`TreasuryService`) : vue par période, pas un solde cumulé
  depuis l'origine** — `netTreasuryFcfa` (résumé) et les totaux du journal
  sont calculés uniquement sur `[from, to]`, aucune notion de solde de
  caisse permanent/reporté d'une période à l'autre. Cohérent avec le
  périmètre §8.7 tel que fourni (lecture agrégée par période, pas un
  compte de trésorerie à solde persistant) — à revisiter si un besoin de
  solde cumulé émerge.
- **Confirmation explicite** : la dette transversale "vérification de
  disponibilité sans verrou" (POULET_CHAIR/Incubation/Orientation, ouverte
  depuis les Phases 3/5) reste inchangée par cette phase — `Item.
  currentStock` est un mécanisme structurellement différent (compteur de
  stock générique écrit par plusieurs flux automatiques, pas une
  vérification de disponibilité lecture-puis-comparaison sur un effectif
  animal/couvain), déjà protégé par `SELECT ... FOR UPDATE` dès l'origine
  avec son propre test de concurrence dédié (`items-stock.e2e-spec.ts`).
  La dette transversale elle-même a depuis été corrigée en Phase 8, voir
  "✅ Corrigé" — ne pas confondre les deux mécanismes lors d'une future
  revue.

## Phase 8 — Durcissement (concurrence, alertes, couverture de test)

Phase issue du bilan de complétude V1-V5
(`docs/architecture/BILAN_COMPLETUDE_V1_V5.md`) — corrige les points les
plus critiques identifiés avant V6/frontend. Le correctif de concurrence
(seul point 🔴 du bilan) est détaillé dans "✅ Corrigé" ci-dessous ; les
points suivants sont des décisions de périmètre prises **sans code**
cette phase, documentées explicitement plutôt que silencieusement
laissées de côté.

- **`SalesService.update()` (POULET_CHAIR/POUSSINS) non corrigé,
  décision explicite** : ces deux branches ont exactement le même défaut
  de concurrence que `create()` (lecture-comparaison-écriture sans
  verrou) — non traité cette phase, avec le même raisonnement déjà écrit
  dans le code pour `OEUFS.update()` : un seul utilisateur authentifié à
  la fois modifie une vente déjà créée (une correction, pas une nouvelle
  vente), risque sans commune mesure avec la création (où deux
  utilisateurs différents peuvent légitimement viser la même ressource au
  même instant). Avant cette phase, seule la branche OEUFS avait cette
  justification écrite ; POULET_CHAIR/POUSSINS.update() partageaient le
  même choix sans jamais le documenter — corrigé ici (documentation
  seule, aucun code).
- **`close()` sans contrôle de cohérence sur `IncubationBatch`/
  `BreederBatch`** — contrairement à `BroilerBatchesService.close()` (qui
  bloque explicitement si `currentHeadcount > 0`), `IncubationBatchesService.
  close()` et `BreederBatchesService.close()` changent le statut sans
  aucune vérification préalable. **Risque concret** : rien n'empêche de
  clôturer un lot d'incubation dont tous les poussins éclos n'ont pas été
  orientés (poussins "perdus" comptablement, ni vendus ni affectés à une
  bande, sans qu'aucune alerte ne le signale), ou un lot reproducteur
  encore en pleine activité de ponte. Violation potentielle non détectée
  de la règle §15 ("une clôture de lot doit vérifier les incohérences
  d'effectif, de stock et de finance"). **Différé** : corriger
  proprement demanderait de définir ce que "cohérent" signifie pour ces
  deux entités (aucun équivalent direct à "effectif vivant" pour un
  couvoir) — à trancher lors de la construction du frontend, qui
  révélera l'usage réel de la clôture sur ces modules, plutôt qu'à
  deviner maintenant.
- **Concept multi-magasin/`Transfert` absent (Phase 7, cahier V5 §8),
  décision jamais documentée avant cette phase** : le modèle de données
  du cahier (§12) liste une table `warehouses` dédiée, et le §8.2 liste
  explicitement "Transfert" (entrée entre magasins/bâtiments) comme
  fonction de stock. `Item.currentStock` est un nombre unique par ferme,
  sans notion de lieu de stockage ; `StockMovementType` n'a que
  `ENTREE`/`SORTIE`, aucun `TRANSFERT`. Décision prise pendant la
  conception de la Phase 7 (single-entrepôt implicite, cohérent avec une
  exploitation de la taille de Samba) mais jamais écrite — corrigé ici
  (documentation seule). À revisiter si un usage multi-bâtiment/
  multi-site réel émerge.
- **Points du bilan V1-V5 explicitement différés, sans code cette
  phase** (périmètre jugé trop large pour un chantier de durcissement
  ciblé — à trancher par l'usage réel lors de la construction du
  frontend plutôt qu'à l'aveugle) :
  - GMQ (Broiler) calculé et testé unitairement mais jamais exposé par
    aucune route (`computeGmqGramsPerDay`).
  - Aucun filtre/pagination/recherche sur `GET /broiler-batches` —
    écart réel avec CLAUDE.md, à traiter avec les autres endpoints de
    liste au moment de construire les écrans qui en ont besoin.
  - 2 KPI couvoir calculés et testés unitairement mais jamais exposés
    (`computeFertilityRatePercent`, `computeInfectedRatePercent`).
  - Calibre d'œufs non réglable via l'API (`EggStockLot.caliber` existe
    en base, jamais dans un DTO), concept plateaux totalement absent.
  - Aucun module Rapports/Exports transversal (§14/§18 des deux
    cahiers) — bloc fonctionnel entier non entamé, pas spécifique à une
    phase précise.
  - Les crons d'alerte restent testés au niveau "s'exécute sans erreur"
    pour tous les crons **antérieurs** à cette phase (Broiler/Layer/
    Breeder-Incubation/Water) — seuls les deux nouveaux crons de cette
    phase (`ItemsAlertsCronService`, `PurchaseOrdersAlertsCronService`)
    ont une couverture allant jusqu'au contenu réel de l'alerte
    déclenchée (voir "✅ Corrigé").

## Phase 9 — Socle frontend + module Eau

Première phase frontend (`apps/web`) : socle transversal (connexion,
client API, permissions UI, composants partagés) puis le module Eau
complet (choix argumenté dans le plan de mission — dette la plus faible
des 8 modules candidats, cycle le plus simple, rôle "Responsable eau"
déjà taillé pour lui dans `roles.catalog.ts`).

- **`PERMISSIONS`/`PermissionCode`/`ALL_PERMISSIONS`/
  `PERMISSION_DESCRIPTIONS` déplacés vers
  `packages/shared-types/src/permissions.ts`** (pas dupliqués — voir
  discussion ci-dessous) — `apps/api/src/common/rbac/permissions.
  constants.ts` n'est plus qu'un ré-export nommé. Un agent Explore a
  d'abord audité les 42 points d'import du fichier source (41 dans
  `apps/api/src`, 1 dans `prisma/seed.ts`, 0 dans les suites e2e) :
  déplacement sûr côté code (aucun export par défaut, aucune dépendance
  à l'identité du module). Deux problèmes de packaging bloquaient
  ensuite le déplacement réel, tous deux corrigés :
  1. Le stage `runner` du `Dockerfile` de `apps/api` ne copiait pas
     `packages/` → ajout d'un `COPY --from=builder /repo/packages/
     shared-types ./packages/shared-types`.
  2. `packages/shared-types` n'avait pas d'étape de build (TS brut) —
     suffisant pour `apps/web` (Turbopack transpile via
     `transpilePackages`), **insuffisant pour `apps/api`** : `nest
     build`/`node` exécutent du CommonJS pur, incapables de charger un
     `.ts` non compilé (`ERR_MODULE_NOT_FOUND` reproduit et vérifié).
     Ajout d'un vrai build (`tsconfig.json` + script `build: tsc`,
     `main`/`types` pointant vers `dist/`), invoqué explicitement dans
     le stage `builder` du Dockerfile (avant le build de `apps/api`) et
     dans la commande de démarrage du stage `dev` (le dossier `src` de
     `packages/shared-types` n'arrivant qu'au runtime via le bind-mount
     du monorepo complet, jamais présent au moment du `npm ci` du stage
     `deps` — un `postinstall` racine a été essayé puis abandonné pour
     cette raison précise, il cassait le cache Docker du stage `deps`).
  Vérifié : image `runner` reconstruite et démarrée manuellement — plus
  aucune erreur de résolution de module sur `@dondy-elevage/shared-types`
  (voir aussi les deux bugs Docker **préexistants et sans rapport**,
  découverts pendant cette vérification, ci-dessous). RBAC revérifié
  fonctionnel (401 sans token, 200 avec) + suite e2e complète (142/142,
  11/11 suites) rejouée deux fois consécutives après le déplacement,
  aucune régression.
- **Deux bugs Docker de production préexistants, découverts en
  vérifiant le point ci-dessus, sans rapport avec cette phase** — la
  chaîne `builder`→`runner` du `Dockerfile` de `apps/api` n'avait
  apparemment jamais été construite ET démarrée de bout en bout
  auparavant (cohérent avec `ci.yml` : "le déploiement lui-même est
  ajouté à partir de la phase où un environnement de déploiement réel
  existe") :
  1. `CMD ["node", "dist/main.js"]` (stage `runner`) — chemin faux, la
     sortie réelle de `nest build` est `dist/src/main.js`
     (`tsc` calcule un `rootDir` commun incluant `apps/api/
     prisma.config.ts`, qui vit hors de `src/`, ce qui pousse tout le
     reste sous `dist/src/`).
  2. `otplib` absent de `node_modules` dans l'image `runner` alors que
     déclaré en dépendance directe de `apps/api/package.json` — cause
     non creusée (hors périmètre de cette phase).
  Non corrigés (hors périmètre socle frontend) — signalés ici pour ne
  pas être redécouverts comme un "nouveau" bug le jour où quelqu'un
  tente un vrai déploiement de production.
- **Bug de session découvert et corrigé en cours de vérification
  manuelle** : `AuthProvider` déclenchait un rafraîchissement silencieux
  du token au montage (`POST /api/auth/refresh`) sans protection contre
  un double appel concurrent (React StrictMode en dev, mais le risque
  existe aussi en prod — deux onglets ouverts simultanément, une
  reprise sur 401 chevauchant ce montage...). Le refresh token étant à
  usage unique côté API avec **révocation de toute la famille de
  tokens en cas de réutilisation détectée** (`TokenService.
  rotateRefreshToken`), un simple double appel invalidait la session
  entière silencieusement — symptôme observé : perte de session
  systématique sur tout rechargement complet de page. Corrigé par un
  dédoublonnage des appels concurrents vers une seule requête réelle
  partagée (`lib/auth/auth-client.ts`, promesse en vol mémorisée).
  Aucune régression possible côté API (le comportement de rotation
  lui-même n'a pas changé) — le correctif est entièrement côté client.
- **Période par défaut du KPI point d'eau non spécifiée par l'API,
  tranchée côté front** : `GET /water-points/:id/kpi` exige `from`/`to`
  sans valeur par défaut (choix délibéré côté API, "pas d'ambiguïté").
  Le front retient le mois en cours comme période d'affichage par
  défaut sur la fiche point d'eau — décision d'affichage, pas un bug ;
  pas de sélecteur de période dans cette première version (aucun champ
  pour changer la plage), à ajouter si l'usage réel en montre le besoin.
- **Aucune pagination serveur sur `GET /water-points`** — cohérent avec
  le constat déjà documenté (seuls Alerts/Notifications sont réellement
  paginés) : le nombre de points d'eau par ferme reste naturellement
  petit, pas de nécessité identifiée. Le composant `DataTable` accepte
  néanmoins déjà soit un tableau simple soit un `PaginatedResult<T>`,
  pour ne pas devoir le réécrire quand un module au volume croissant
  (ex. historique des ventes, bandes Chair) en aura besoin.
- **2FA, mot de passe oublié/réinitialisation et OAuth (Google/
  Microsoft) implémentés mais non couverts par des tests de
  composants** — seul `AppShell` a un test (Phase 0, étendu pour
  englober `AuthProvider`). Honnêteté du périmètre : aucun test de
  composant écrit cette phase au-delà de celui déjà existant, uniquement
  une vérification manuelle guidée dans un vrai navigateur (voir
  rapport de mission).
- **`apps/web/proxy.ts` (redirection optimiste pré-rendu) non
  implémenté** — le garde côté client du layout `(app)` suffit pour la
  correction fonctionnelle (redirige vers `/connexion` si aucune
  session), documenté comme reporté dans le plan de mission (non
  bloquant, juste un flash de contenu protégé évitable en plus).

## Phase 10 — Design system "Agritech Premium"

Remplacement de la palette Phase 0 par la direction "Agritech Premium"
d'un mockup fourni par le porteur de projet (`docs/design/DONDY
ELEVAGE - 5 directions.html`, 5 directions présentes, une seule
retenue). Détail complet des tokens, arbitrages et vérifications :
`docs/architecture/DESIGN_SYSTEM.md` — ce point ne liste ici que ce qui
relève de la dette/risque, pas la doc de référence elle-même.

- **Deux couleurs de la fiche "Agritech Premium" échouaient le
  contraste WCAG AA texte normal (4.5:1)** sur leur fond respectif :
  texte atténué `#8A8A7A`/fond `#FAF7EF` (3,27:1) et texte vigilance
  `#B06F12`/fond badge `#FBEFD9` (3,60:1) — pertinent vu l'usage
  extérieur à Samba (forte luminosité). Assombries à teinte égale
  (`#6E6E60` et `#96600F`, ~4,6-4,8:1) plutôt qu'appliquées telles
  quelles. Point limite résiduel, signalé et non corrigé : le badge
  "Vigilance" composé sur son propre fond dérivé (`bg-warning/10`,
  très clair) retombe à ~4,34:1 — sous 4.5:1 mais proche, et
  nettement au-dessus du seuil 3:1. Assombrir davantage dériverait
  vers un brun peu distinct de "vigilance" ; à re-mesurer si un retour
  terrain signale une difficulté de lecture. Calcul détaillé :
  `DESIGN_SYSTEM.md` section "Accessibilité".
- **`--shadow-kpi-hero` (carte KPI "vedette", fond primary) défini mais
  sans usage** — le dashboard Phase 9 n'affiche qu'un seul `KpiCard`,
  une distinction vedette/standard serait prématurée. Même logique que
  `--chart-4`/`--chart-5` (Phase 0), déjà préparés sans usage actuel
  pour de futurs dashboards. Le token reste documenté et disponible.
- **`rounded-2xl` (candidat pour un futur "app frame") sans usage
  réel** — décision assumée de ne pas encadrer l'application dans un
  conteneur arrondi/ombré comme le fait le mockup (lecture retenue :
  artefact de présentation d'une maquette comparative à 5 directions
  juxtaposées, pas une intention d'habillage réel d'app web plein
  viewport). Voir `DESIGN_SYSTEM.md` section "Décisions", point 1.
- **`next/font/google` refuse la syntaxe de plage de poids pour
  Newsreader/Instrument Sans** — tenté (`weight: '400 600'`/`'400
  700'`) pour ne charger que les poids réellement utilisés, rejeté à la
  compilation (`Unknown weight ... Available weights: 400, 500, 600,
  700, variable`) : la syntaxe plage documentée ne s'applique qu'aux
  polices variables à continuum réel (type Inter), pas à des paliers
  discrets. Sans impact pratique — l'omission de `weight` (déjà
  recommandée, comportement par défaut `'variable'`) charge de toute
  façon un seul fichier par police. Signalé pour ne pas être retenté
  à l'identique dans une phase future.
- **`components/ui/table.tsx` (`TableHead`) retouché sans être listé
  dans le plan de phase initial** — trouvé pendant la vérification
  visuelle : le style d'en-tête du mockup (majuscules, espacement de
  lettres) ne cascadait pas automatiquement depuis les tokens de
  couleur/rayon, contrairement à l'essentiel des autres composants
  shadcn. Retouché au même titre que `card.tsx`/`dialog.tsx`/etc.
- **`app/(auth)/layout.tsx` avait une régression visuelle non
  anticipée** — trouvée uniquement grâce à la vérification manuelle en
  navigateur (pas repérable par grep statique) : `bg-muted`, adapté à
  de petites pastilles d'icônes avant cette phase, devenait un fond de
  page entier vert pâle une fois `--dondy-muted` reteinté vers
  `#EEF1EA`. Corrigé en `bg-background`, branding aligné sur
  `app-sidebar.tsx`. Confirme l'utilité de la vérification visuelle
  guidée au-delà du seul contrôle statique (aucune couleur codée en
  dur, donc invisible à un grep).
- **4 `h1` de formulaires d'authentification sans traitement "titre"**
  (`features/auth/components/{login,two-factor,forgot-password,
  set-password}-form.tsx`) — non repérés par l'audit de faisabilité
  initial (classes déjà sémantiques, `text-foreground`, pas de couleur
  en dur) car le défaut n'était pas une valeur incorrecte mais une
  classe `font-heading`/`text-primary` manquante, même schéma que
  `PageHeader` (déjà identifié dans le plan). Corrigés en vérification
  visuelle, même règle appliquée aux 4 fichiers.

## Phase 11 — Frontend Poulets de chair

Deuxième module métier frontend complet, construit directement dans le
design "Agritech Premium" (Phase 10) : bandes, suivi quotidien
(45 lignes pré-générées, adressées par jour), mortalité, santé, vente,
clôture, alertes calendaires, KPI dashboard.

### Statuts « terminaux » non protégés au niveau service — catégorie transversale, 4 modules (ouverte cette phase)

**À traiter ensemble dans une future phase de durcissement, pas au coup
par coup module par module** — même logique de consolidation que la
dette "vérification de disponibilité sans verrou" (Phases 3/5, corrigée
d'un bloc en Phase 8, voir "✅ Corrigé" ci-dessous). Signalé
explicitement pour ne pas laisser ce gap se disperser en mentions
isolées phase après phase.

**Le schéma exact, identique dans les 4 modules** : le DTO de
modification documente en commentaire que les statuts "terminaux"
(annulation/clôture) doivent passer exclusivement par un endpoint dédié
(`/annuler`, `/cloturer`) — mais rien au niveau du service n'empêche de
les atteindre directement via le PATCH générique, qui applique le DTO
tel quel (`data: { ...dto }`) sans filtrer `status`. Le garde-fou est
une convention documentée, pas un contrôle appliqué.

Occurrences confirmées (grep + lecture du service pour chacune) :
- **`BroilerBatch`** (Chair, Phase 3/11) — `UpdateBroilerBatchDto`
  documente "ANNULEE et CLOTUREE passent par les endpoints dédiés" ;
  `BroilerBatchesService.update()` (`data: { ...dto }`) ne filtre rien.
  **Contourné côté frontend cette phase** : le `<Select>` statut du
  formulaire de modification n'affiche que les 8 valeurs libres
  (`BROILER_BATCH_EDITABLE_STATUSES`, `packages/shared-types/src/
  broiler-batches.ts`) — un contournement UI, pas une correction de la
  source.
- **`LayerBatch`** (Pondeuses, Phase 4) — même schéma
  (`layer-batches.service.ts`, `data: { ...dto, entryDate: ... }`),
  **non contourné même côté frontend** : ce module n'a pas encore
  d'écran (Phase 12+ probable).
- **`BreederBatch`** (Reproductrices, Phase 5) — même schéma
  (`breeder-batches.service.ts`, `data: { ...dto, constitutionDate:
  ... }`), statuts libres `ACTIF`/`REFORME`. Non contourné (pas
  d'écran).
- **`IncubationBatch`** (Couvoir, Phase 5) — même commentaire DTO
  ("ANNULEE et CLOTURE passent par les endpoints dédiés"), transition
  libre `EN_INCUBATION`→`ECLOS`. Non contourné (pas d'écran).

**Pourquoi ce n'est pas corrigé côté backend cette phase** : Phase 11
est explicitement frontend seulement (voir Contexte du plan de
mission) — le contournement UI sur Chair est la seule action possible
dans ce périmètre. Une correction backend correcte (rejeter `status`
dans le PATCH générique si la valeur cible est terminale, sur les 4
modules à la fois) est un chantier de durcissement ciblé, pas une
correction ponctuelle module par module.

### Autres points

- **KPI dashboard "mortalité du jour" (toutes bandes Chair) — fetch par
  bande active plutôt qu'un agrégat serveur** : `BroilerBatchWithComputed`
  n'expose aucun champ de mortalité agrégée, et aucun endpoint
  farm-wide n'existe. Un fetch `GET .../daily-records/:dayNumber` est
  émis par bande **active et dans son cycle** (`useTodayMortalityTotal`,
  `features/broiler-batches/hooks.ts`), gaté sur
  `BROILER_DAILY_RECORDS_READ` pour éviter des 403 en boucle sur les
  rôles qui n'ont que `BROILER_BATCHES_READ` (ex. Vendeur/Caisse).
  Borné par le nombre de bandes actives d'une ferme (pas un vrai N+1 à
  grande échelle), mais c'est un **arbitrage réel contre la contrainte
  permanente "faible consommation réseau" de CLAUDE.md** — accepté
  faute d'alternative sans modification backend, pas ignoré
  silencieusement.
- **GMQ (gain moyen quotidien) non affiché** — calculé et testé côté
  backend (`broiler-growth.calculations.ts`) mais jamais exposé par
  aucune route (dette déjà documentée Phase 8). Non recalculé côté
  client : reproduire cette logique dans le frontend créerait une
  double source de vérité, contraire au principe directeur CLAUDE.md
  ("jamais de recalcul manuel"). Reste une limite d'affichage connue.
- **`GET /broiler-batches` toujours sans filtre/pagination serveur**
  (confirmé inchangé depuis `BILAN_COMPLETUDE_V1_V5.md`, non corrigé en
  Phase 8) — mitigé par un toggle "Actives"/"Toutes" **purement
  côté client** sur `poulets-chair/page.tsx` (filtrage en mémoire sur
  les données déjà entièrement récupérées). Un palliatif d'affichage,
  pas une résolution du gap réseau — le gap backend reste ouvert.
- **Onglets Mortalité et Santé sans test de composant** (comme les 4
  formulaires d'authentification en Phase 9) — honnêteté sur le
  périmètre testé : validation manuelle en navigateur uniquement cette
  phase, aucun test Vitest écrit pour `mortality-form.tsx`/
  `health-event-form.tsx`/`daily-record-form.tsx` faute de temps.
- **`weightKg` ajouté à `SaleForm`/`sales/schemas.ts`, purement
  descriptif** : le montant d'une vente reste `quantity ×
  unitPriceFcfa` quel que soit `saleMode` côté API — un `saleMode=POIDS`
  avec `weightKg` renseigné n'affecte aucun calcul, comportement API
  préexistant confirmé (pas une régression introduite ici), juste
  rendu visible côté formulaire pour la première fois.

## ✅ Corrigé

### Vérification de disponibilité sans verrou — POULET_CHAIR, POUSSINS, IncubationBatch, OrientationService (ouvert depuis Phase 3/5, corrigé en Phase 8)

**Le seul point classé 🔴 (priorité) du bilan de complétude V1-V5.**
Trois occurrences du même défaut structurel — lecture agrégée d'une
disponibilité, comparaison, écriture, sans transaction ni verrou :

| Origine | Emplacement | Nature |
|---|---|---|
| Phase 3 | `SalesService.create()`, branche `POULET_CHAIR` | Lecture de `BroilerBatch.currentHeadcount` (agrégation Prisma) puis comparaison à la quantité vendue. |
| Phase 8 (découverte) | `SalesService.create()`, branche `POUSSINS` | Même schéma exact — jamais inventoriée séparément dans ce registre avant cette phase, malgré un commentaire de code ("même schéma que POULET_CHAIR") présent depuis la Phase 5. |
| Phase 5 | `IncubationBatchesService.create()` (`eggCount <= availableFertileEggs`), `OrientationService.orient()` (poussins disponibles = `chicksHatched - SUM(BatchLineage.quantity)`) | Même schéma exact. |

**Correction retenue** — pattern déjà validé deux fois sur ce projet
(Phase 4, `EggStockService.consumeFifoInternal` ; Phase 7,
`StockMovementsService.recordMovementInTransaction`), jamais appliqué ici
jusqu'à présent : verrouiller `SELECT ... FOR UPDATE` la ligne parente
dans une transaction, recalculer l'agrégat de disponibilité via ce même
client transactionnel, comparer, puis écrire. Jamais
`isolationLevel: Serializable` (bug amont `@prisma/adapter-mariadb`
confirmé, voir Phase 4 ci-dessous).

- `BroilerBatchesService`/`ChickBatchesService` : `computeCurrentHeadcount`/
  calcul équivalent acceptent un client Prisma optionnel
  (`tx ?? this.prisma`) ; nouvelle méthode publique
  `assertAvailableHeadcountInTransaction` (verrou + recalcul +
  comparaison, seul endroit où `FOR UPDATE` est pris — jamais dans les
  méthodes de lecture pure réutilisées par `findAll`/`findOne`).
- `SalesService` : branches POULET_CHAIR et POUSSINS restructurées sur
  le gabarit déjà existant `createEggSaleAndConsumeStock` (pré-check
  hors transaction + boucle retry P2034/P2002 + transaction verrouillée).
  **Comportement préservé à l'identique** : contrairement à OEUFS, ces
  deux branches vérifient la disponibilité pour tous les statuts (y
  compris BROUILLON, §17 — "vérifié dès la création, même en brouillon,
  pour ne jamais laisser promettre plus que l'effectif réel") ; ce
  correctif rend cette vérification atomique, il ne change pas quand
  elle s'applique.
- `BreederBatchesService` : `computeAvailableFertileEggsForBatch` accepte
  un client optionnel ; nouvelle méthode publique
  `assertAvailableFertileEggsInTransaction`.
- `IncubationBatchesService.create()` : fusionne l'ancienne boucle retry
  (P2002, collision de code) avec un retry P2034 — une transaction par
  tentative, verrou+validation en premier.
- `OrientationService.orient()` : verrou déplacé en tête de la
  transaction déjà existante (Phase 5, atomicité entité-enfant +
  `BatchLineage`) ; boucle retry P2034/P2002 ajoutée (absente jusqu'ici
  — nécessaire car `BroilerBatchesService.create()` appelé avec `tx`
  n'a aucun retry P2002 interne sur la génération de code).

**Tests de concurrence dédiés** (`Promise.all` sur deux requêtes
simultanées dépassant la ressource disponible, `[201,409]` attendu, état
final vérifié cohérent — même gabarit que la Phase 4) :
`broiler-batches.e2e-spec.ts` (ventes poulets),
`incubation-batches.e2e-spec.ts` (ventes poussins, création de lot
d'incubation, orientation) — 4 nouveaux tests.

**Non corrigé, décision explicite** : `SalesService.update()`
(POULET_CHAIR/POUSSINS) garde le même défaut — voir section "Phase 8"
ci-dessus pour le raisonnement complet (même justification que
`OEUFS.update()`, désormais documentée pour les trois branches).

Voir `sales.service.ts`, `broiler-batches.service.ts`,
`chick-batches.service.ts`, `breeder-batches.service.ts`,
`incubation-batches.service.ts`, `orientation/orientation.service.ts`.

### Absence d'alerte stock/finance (Phase 7, corrigé en Phase 8)

Le bilan de complétude V1-V5 a signalé qu'aucune alerte stock/finance
n'existait pour la Phase 7, contrairement à **tous** les autres modules
métier (Broiler/Layer/Breeder-Incubation/Water ont chacun leur cron
dédié) — malgré le cahier §10 ("Alertes de stock : seuil minimum,
rupture" / "Alertes financières : facture impayée"). Corrigé :
`ItemsAlertsCronService` (réutilise `computeStockStatus` déjà existant,
VIGILANCE si ORANGE / CRITIQUE si ROUGE) et
`PurchaseOrdersAlertsCronService` (facture fournisseur en retard de
paiement, réutilise `PurchaseOrder.dueDate` déjà existant, IMPORTANT).
"Dépense inhabituelle" (détection d'anomalie statistique) explicitement
exclue — aucune définition dans le cahier, périmètre V6/IA. Les deux
crons ont une couverture e2e allant jusqu'au contenu réel de l'alerte
déclenchée (type/sévérité + idempotence), au-delà du niveau "s'exécute
sans erreur" du reste du projet — logique de seuil neuve, plus de valeur
qu'un simple smoke test.

### Couverture de test nulle sur `TreasuryService` et rentabilité Layer/Incubation/Eau (Phase 7, corrigé en Phase 8)

Le bilan de complétude V1-V5 a signalé que `TreasuryService` (journal,
créances/dettes, vue consolidée) n'avait aucun test — ni unitaire, ni
e2e — et que seul `GET /broiler-batches/:id/profitability` était
exercé parmi les 4 endpoints de rentabilité Phase 7. Corrigé : nouveau
`treasury.e2e-spec.ts` (scénario d'acceptation G du cahier — ventes,
dépenses, paiements, marge par activité puis globale) ; nouveaux tests
dans `layer-batches.e2e-spec.ts`/`incubation-batches.e2e-spec.ts`/
`water-points.e2e-spec.ts` pour leurs endpoints/champs de rentabilité
respectifs.

### `PaymentsService.create()` — absence de plafond de paiement (§15, angle mort pré-existant depuis Phase 3, corrigé en Phase 7)

**Découvert pendant la conception de `SupplierPaymentsService`** (Phase 7,
achats fournisseurs) : le cahier §15 exige qu'"un paiement ne puisse pas
excéder le solde restant" — règle que `SupplierPaymentsService` devait de
toute façon implémenter pour son propre compte. En l'implémentant, la
revue a fait apparaître que `PaymentsService` (Phase 3, ventes
POULET_CHAIR/OEUFS/POUSSINS/EAU généralisées) ne l'a **jamais** appliquée :
`CreatePaymentDto`/`PaymentsService.create()` n'avaient aucun contrôle de
plafond, et `computeSaleStatus` ne bloque jamais un dépassement — un
paiement pouvait dépasser `Sale.netAmountFcfa` sans erreur.

**Décision explicite, tranchée pendant l'implémentation (pas laissée en
dette différée)** : le trou est corrigé **dans cette même phase**, pas
seulement documenté, avec le raisonnement suivant :

1. C'est une règle d'intégrité financière explicite du cahier (§15),
   activement violée par du code déjà en production logique sur 4 modules
   généralisés (POULET_CHAIR/OEUFS/POUSSINS/EAU) — pas une préférence de
   conception, une règle métier écrite.
2. Cette même phase construit de la logique financière **neuve**
   (trésorerie, créances clients, `TreasuryService`) directement au-dessus
   de `Payment` — un `Sale.status`/solde faussé par un dépassement non
   bloqué aurait contaminé silencieusement ces nouveaux calculs. Le trou
   était donc pertinent pour **cette** phase précisément, pas seulement une
   dette abstraite héritée d'une phase antérieure.
3. Le correctif est un simple garde-fou **additif** : il rejette un état
   auparavant accepté à tort, ne change le comportement d'aucun cas déjà
   valide. Risque de régression quasi nul — confirmé après coup : aucun
   scénario des 4 suites e2e pré-existantes (Broiler/Layer/Breeder/Eau) ne
   teste un paiement excédant le montant net d'une vente, et la suite
   complète (127 tests, 2 exécutions consécutives) est passée sans
   régression après application du correctif.
4. **Précédent direct dans cette même mission** : Phase 5, correctif de
   l'atomicité `OrientationService` (voir ci-dessous) appliqué
   immédiatement plutôt que différé, sur exactement ce même raisonnement
   ("si c'est simplement et sûrement corrigeable, corriger maintenant
   plutôt que reporter à `DETTE_TECHNIQUE.md`").

**Ce qui n'a volontairement PAS été ajouté avec ce correctif** : aucun
nouveau mécanisme de verrouillage (`FOR UPDATE`). Le correctif est une
lecture-puis-comparaison classique (agrégat `Payment` non supprimés pour
la vente, puis comparaison à `netAmountFcfa`) — action ponctuelle par un
utilisateur unique sur une vente précise, jamais un compteur partagé à
haute fréquence comme `Item.currentStock`. Ce schéma reste dans la même
catégorie de risque "faible" qu'étaient alors (Phase 7) les vérifications
de disponibilité sans verrou (POULET_CHAIR/Incubation/Orientation, non
urgentes à l'époque, depuis corrigées en Phase 8, voir "✅ Corrigé"
ci-dessus) — pas incohérent avec elles, juste corrigé ici parce que la
correction était triviale et le bénéfice réel, alors que cette dette-là
nécessitait un chantier plus large (trois points distincts, protection
cohérente à construire d'un coup — ce qui a fini par être fait en
Phase 8).

Voir `payments.service.ts` (méthode privée `assertDoesNotExceedBalance`,
appelée en tête de `create()`) et `supplier-payments.service.ts` (même
contrôle, implémenté nativement dès la création puisque c'est une entité
neuve sans passif à préserver).

### `OrientationService.orient()` — absence de transaction unique (Phase 5)

**Signalé puis corrigé dans la même phase**, avant merge — un premier
commit de la Phase 5 avait laissé la création de l'entité enfant
(`BroilerBatch`/`ChickBatch`, selon `transformationType`) et la ligne
`BatchLineage` en deux écritures séparées, chacune validée indépendamment,
avec le raisonnement suivant (retenu à tort) : `BroilerBatchesService.
create()` possède déjà sa propre transaction interne (bande + 45 journées,
héritée de la Phase 3), et la faire participer à une transaction englobante
semblait exiger une modification disproportionnée d'un service Phase 3 non
sollicité par ailleurs.

**Risque concret qui aurait résulté de ce choix** : un échec de l'INSERT
`BatchLineage` — après le succès de la création du `BroilerBatch`/
`ChickBatch` — aurait laissé cette entité enfant orpheline : un lot de
poulets ou de poussins existant réellement en base, rattaché à un
bâtiment et à un responsable, mais sans aucune ligne de filiation le
reliant à son incubation d'origine. Concrètement : le compteur "poussins
disponibles" de l'incubation (`chicksHatched - SUM(BatchLineage.quantity)`)
resterait incorrect (surestimé, puisque la quantité orientée n'aurait pas
été comptabilisée), permettant d'orienter à nouveau des poussins déjà
matériellement utilisés — et la traçabilité de filiation (exigée par le
cahier §6.5, testée en e2e) serait rompue pour ce lot précis.

**Correction retenue** — repérée comme simple avant d'être reportée à tort
(le précédent direct existait déjà : bande + 45 journées en Phase 3, via
`prisma.$transaction`) : `BroilerBatchesService.create()` et
`ChickBatchesService.createInternal()` acceptent désormais un paramètre
`tx?: Prisma.TransactionClient` optionnel. Quand il est fourni, ils
écrivent avec ce client au lieu d'ouvrir leur propre transaction (Prisma ne
supporte pas les transactions interactives imbriquées, mais un
`Prisma.TransactionClient` s'utilise comme le client normal pour de
nouvelles écritures dans la même transaction déjà ouverte par l'appelant)
et ne journalisent plus eux-mêmes l'audit log dans ce cas (un log écrit
avant le commit de la transaction englobante serait visible en base pour
une écriture pas encore garantie définitive, et resterait orphelin si
l'étape suivante échouait). `OrientationService.orient()` ouvre désormais
une unique transaction (`this.prisma.$transaction`) englobant la création
de l'entité enfant (le cas échéant) et la ligne `BatchLineage`, et émet
tous les logs d'audit après le commit. Voir
`orientation.service.ts`/`broiler-batches.service.ts`/
`chick-batches.service.ts`.

## Comment utiliser ce document

- **En fin de mission** : avant de rédiger la section "Risques / dette
  technique" du rapport, relire ce fichier pour vérifier si un point signalé
  est en réalité la ré-occurrence d'une dette déjà connue plutôt qu'une
  nouveauté — le documenter comme tel ici plutôt que comme une mention
  isolée dans la seule PR de la phase.
- **En début de mission** : consulter les sections par phase et "✅ Corrigé"
  pour savoir si le périmètre de la nouvelle phase touche un point déjà
  connu (transversal ou non) et mérite d'être traité (ou explicitement
  reporté, avec justification) plutôt que redécouvert à zéro.
- **Une fois un point corrigé** : le déplacer dans la section "✅ Corrigé"
  ci-dessus, avec le commit/PR de correction en référence — jamais de
  suppression silencieuse d'un point qui a réellement existé.
