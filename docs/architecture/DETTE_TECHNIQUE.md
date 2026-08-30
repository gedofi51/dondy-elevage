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
  (`layer-batches.service.ts`, `data: { ...dto, entryDate: ... }`).
  **Désormais contourné côté frontend (Phase 12)** : le `<Select>`
  statut du formulaire de modification n'affiche que les 3 valeurs
  libres (`LAYER_BATCH_EDITABLE_STATUSES` = `ELEVAGE`/`PONTE`/
  `REFORME`, `packages/shared-types/src/layer-batches.ts`) —
  `CLOTURE`/`ANNULEE` restent atteignables uniquement via les endpoints
  dédiés (`/cloturer`, `/annuler`) côté UI. Toujours un contournement
  UI, pas une correction de la source.
- **`BreederBatch`** (Reproductrices, Phase 5) — même schéma
  (`breeder-batches.service.ts`, `data: { ...dto, constitutionDate:
  ... }`), statuts libres `ACTIF`/`REFORME`. **Select statut désormais
  contourné côté frontend (Phase 13)** : `BREEDER_BATCH_EDITABLE_STATUSES`
  restreint le formulaire de modification aux 2 valeurs libres, garde
  `isBatchOpen` appliquée sur le bouton Modifier. Nuance par rapport à
  Layer/Broiler : `/cloturer` et `/annuler` eux-mêmes ne sont **pas**
  construits côté UI cette phase (voir section Phase 13 ci-dessous) —
  aucun bouton n'expose donc encore le chemin réel vers un statut
  terminal, la garde reste pour l'instant purement défensive/anticipatoire.
- **`IncubationBatch`** (Couvoir, Phase 5) — même commentaire DTO
  ("ANNULEE et CLOTURE passent par les endpoints dédiés"), transition
  libre `EN_INCUBATION`→`ECLOS`. **Select statut désormais contourné
  côté frontend (Phase 13)** : `INCUBATION_BATCH_EDITABLE_STATUSES`
  restreint le formulaire de modification aux 2 valeurs libres, même
  garde `isBatchOpen`, même nuance que `BreederBatch` ci-dessus
  (`/cloturer`/`/annuler` non construits cette phase).

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

### `SelectValue` (base-ui) affiche la value brute au lieu du libellé — trouvé et corrigé cette phase, jamais documenté (entrée ajoutée rétroactivement en Phase 12)

Trouvé pendant la vérification manuelle de cette phase (le champ
"Bâtiment" affichait un UUID brut au lieu du nom sélectionné) :
`SelectValue` (`@base-ui/react/select`) sans `items`/`itemToStringLabel`
sur `Select.Root` retombe sur la `value` brute sélectionnée, sauf si un
enfant fonction `{(value) => ...}` est fourni directement à
`SelectValue` — confirmé en lisant le code source installé
(`node_modules/@base-ui/react/select/value/SelectValue.js`,
`.../internals/resolveValueLabel.js`), pas deviné par essai-erreur.
Fix appliqué à tous les `<SelectValue>` peuplés dynamiquement, dans le
code neuf de cette phase et rétroactivement dans du code Phase 9 déjà
mergé (`water-point-form.tsx`) : enfant fonction
`(value) => value ? (map.get(value) ?? value) : 'texte'`. **Effet de
bord découvert au second passage** : passer un enfant fonction fait
ignorer le prop `placeholder` par `SelectValue` (`shouldCheckNullItemLabel`
exige `childrenProp == null`) — la fonction doit donc gérer elle-même le
cas valeur vide/non sélectionnée et renvoyer le texte de substitution.

Chaque fichier corrigé porte un commentaire renvoyant à "DETTE_TECHNIQUE.md
Phase 11" (`broiler-batch-form.tsx`, `mortality-form.tsx`,
`water-point-form.tsx`, `sale-form.tsx`) — **mais cette entrée n'existait
pas réellement** (vérifié par grep négatif en tout début de Phase 12) :
un oubli de documentation, pas un correctif manquant. Ajoutée ici en
Phase 12, rétroactivement, puisque c'est cette phase qui a détecté
l'absence de l'entrée — le correctif lui-même date bien de la Phase 11.

## Phase 12 — Frontend Pondeuses

Troisième module métier frontend complet, construit directement dans le
design "Agritech Premium" : lots de pondeuses, suivi journalier créé à
la demande (architecture différente de Chair — pas de 45 lignes
pré-générées), santé, stock d'œufs (premier mécanisme de stock FIFO
réellement exposé au frontend), vente, clôture, alertes, KPI dashboard.
Statut `LayerBatch` désormais contourné côté frontend — voir la puce
mise à jour dans la catégorie transversale "Statuts terminaux non
protégés au niveau service" (Phase 11 ci-dessus), pas une nouvelle
entrée isolée.

### `POST /layer-batches/:id/annuler` — existe, non testé, reporté

`POST /layer-batches/:id/annuler` (`layer-batches.controller.ts:81-89`,
permission `LAYER_BATCHES_DELETE`) existe côté backend mais **n'a
aucune couverture de test** dans `layer-batches.e2e-spec.ts` (vérifié
par grep — la seule occurrence "annuler" du fichier concerne
l'annulation d'une *vente*, pas d'un lot). Contrairement à `POST
/:id/cloturer` (testé, test 14, `layer-batches.e2e-spec.ts:488-515`,
inclus cette phase avec le même patron que Chair), le critère fixé pour
cette phase (existence + test) n'est pas satisfait pour `/annuler` —
l'action "Annuler" est donc absente de la fiche du lot cette phase,
reportée à une phase future. `DELETE /layer-batches/:id` (hard-delete)
reste également non exposé côté frontend, comme pour Broiler.

### KPI dashboard "production d'œufs du jour" — fetch par lot actif, arbitrage réseau (même schéma que la mortalité Chair, avec une différence réelle)

`LayerBatchWithComputed` n'expose aucun champ agrégé de production, et
aucun endpoint farm-wide n'existe. `useTodayEggProductionTotal`
(`features/layer-batches/hooks.ts`) émet un fetch `GET
.../daily-records/:date` (date du jour) par lot **actif**
(`ELEVAGE`/`PONTE`), gaté sur `LAYER_DAILY_RECORDS_READ`. Différence
importante avec `useTodayMortalityTotal` (Chair) : il n'y a pas de
cycle borné à filtrer en amont côté Pondeuses — un 404 "pas encore
saisi aujourd'hui" est le cas **normal et quotidien** pour chaque lot
actif tant que personne n'a saisi, pas une exception rare comme pour
Chair (où le 404 hors-cycle est filtré avant le fetch). `retry: false`
sur chaque requête pour ne pas retarder l'affichage ; un 404 compte
pour 0 (normal), une autre erreur (403/500) fait retourner `undefined`
(affiché "—") plutôt que de la masquer silencieusement derrière un
total potentiellement faux. Même arbitrage réel contre la contrainte
réseau permanente de CLAUDE.md que pour Chair — accepté faute
d'alternative sans modification backend, pas ignoré silencieusement.

### Widget alertes sur la fiche de lot — filtrage entièrement côté client, et absent côté Chair malgré le plan Phase 11

`GET /alerts` n'a pas de filtre serveur par `entityId` (seulement
`status`/`limit`) — `BatchAlertsWidget`
(`features/layer-batches/components/batch-alerts-widget.tsx`) fetch
les 50 alertes déclenchées les plus récentes toutes entités confondues
et filtre côté client sur `entityId === batchId`. Borné par `limit:
50` : un lot dont l'alerte serait "noyée" au-delà de ce rang (peu
probable en pratique, mais possible sur une ferme avec beaucoup
d'alertes actives simultanées, toutes entités confondues) ne
l'afficherait pas sur sa fiche.

**Constaté en implémentant ce widget** : le plan Phase 11 (Chair)
prévoyait explicitement un widget équivalent sur
`broiler-batch-detail-view.tsx` ("alertes calendaires visibles sur la
fiche de bande, comme pour Chair" est d'ailleurs la formulation
reprise dans le kickoff de cette phase) — mais il n'a en réalité
**jamais été construit** (vérifié : seul le widget dashboard global
`AlertsWidget` existe côté Chair, aucun `AlertBadge` ni équivalent
n'apparaît dans `broiler-batch-detail-view.tsx`). Non corrigé ici (hors
périmètre Pondeuses, toucher du code Chair déjà mergé) — signalé pour
une phase de rattrapage ou pour uniformiser les deux fiches ensemble.

### Colonne "taux de ponte récent" absente de la liste des lots

`LayerBatchWithComputed` n'expose aucun `layingRate` agrégé — seule
source : `LayerDailyRecord.layingRatePercent` de la dernière journée
saisie. L'ajouter à la liste (`layer-batch-table.tsx`) obligerait un
fetch `daily-records` par ligne (N+1) sur une liste déjà non paginée
côté serveur (voir point suivant) — non ajouté, choix documenté plutôt
que silencieux. Affiché en revanche sur la fiche du lot (KPI "Taux de
ponte actuel"), dérivé de la liste déjà chargée par l'onglet Suivi
journalier, sans coût réseau supplémentaire.

### `GET /layer-batches` toujours sans filtre/pagination serveur

Même gap que `GET /broiler-batches` (signalé Phase 11, non corrigé
Phase 8) — mitigé par un toggle "Actifs"/"Tous" purement côté client
sur `pondeuses/page.tsx` (filtrage en mémoire sur les données déjà
entièrement récupérées). Palliatif d'affichage, pas une résolution du
gap réseau — le gap backend reste ouvert pour les deux modules.

### Onglet Santé, suivi journalier et perte manuelle de stock sans test de composant

Comme pour Chair (Phase 11) : validation manuelle en navigateur
uniquement cette phase, aucun test Vitest écrit pour
`health-event-form.tsx`, `daily-record-form.tsx` (les deux variantes
création/édition) ou `egg-stock-movement-form.tsx` faute de temps.

## Phase 13 — Frontend Reproduction/Couvoir

Quatrième module métier frontend complet, construit directement dans le
design "Agritech Premium" : couveuses (référentiel), lots reproducteurs
(suivi journalier créé à la demande, comme Pondeuses), lots d'incubation
(bilan de mirage/éclosion, 4 KPI couvoir), orientation des poussins vers
4 destinations (chair/renouvellement/vente/réforme-perte), lots de
poussins, filiation consultable dans les deux sens. Backend 100%
construit et testé depuis les Phases 5/8 — phase strictement frontend,
sauf une retouche additive sur `broiler-batch-detail-view.tsx` (Phase 11,
Card "Origine") et la documentation.

### Clôture/annulation `BreederBatch` et `IncubationBatch` — différées, avec un risque concret trouvé au passage

`POST /:id/cloturer` et `POST /:id/annuler` existent pour les deux
entités mais **aucun des 4 endpoints n'a de couverture e2e** (grep sur
`annuler|cloturer` dans `apps/api/test/` : zéro occurrence pour
`breeder-batches`/`incubation-batches` — la seule couverture indirecte
vient de `create`/`read` utilisés comme fixtures dans
`incubation-batches.e2e-spec.ts`). Même critère que celui fixé pour la
clôture Pondeuses en Phase 12 (existence + couverture e2e réelle avant
d'exposer une action de transition irréversible) : non satisfait pour
les 4 endpoints → différés, aucun bouton Clôturer/Annuler construit
cette phase sur les fiches Reproducteurs/Couvoir. Cette décision **tranche
explicitement** le point ouvert en Phase 8 ci-dessus ("à trancher lors
de la construction du frontend, qui révélera l'usage réel de la
clôture") — verdict : l'usage réel révélé est qu'aucun des deux
endpoints n'est assez éprouvé pour être exposé sans garde-fou de
précondition.

**Fait concret trouvé en lisant `IncubationBatchesService` pendant cette
phase, pas seulement "non testé"** : `computeAvailableFertileEggsForBatch`
(`breeder-batches.service.ts`) exclut les `IncubationBatch` de statut
`ANNULEE` du calcul d'`availableFertileEggs` — **annuler un lot
d'incubation recrédite donc silencieusement ses œufs dans le solde
disponible du lot reproducteur parent**, y compris si `chicksHatched` est
déjà renseigné et que des `BatchLineage`/`ChickBatch`/`BroilerBatch`
réels ont déjà été créés par orientation. Rien ne bloque cette
incohérence côté service. Ce risque, spécifique à `/annuler` (absent de
`/cloturer`, un simple changement de statut sans effet de bord), rend la
décision de différer d'autant plus justifiée — et candidat concret pour
une Phase 14 : soit bloquer `/annuler` si `chicksHatched !== null` /
des `BatchLineage` existent, soit documenter explicitement que
l'exclusion est voulue.

Statuts "libres" (`ACTIF`/`REFORME` pour Breeder, `EN_INCUBATION`/
`ECLOS` pour Incubation) restent éditables via un formulaire de
modification classique, avec garde `isBatchOpen` appliquée
défensivement dès cette phase (voir mise à jour de la catégorie
transversale "Statuts terminaux non protégés", Phase 11 ci-dessus).

### `ChickBatch` — aucun endpoint dédié de clôture/annulation, gap structurellement différent des 4 autres modules

Contrairement à `BroilerBatch`/`LayerBatch`/`BreederBatch`/
`IncubationBatch`, `ChickBatch` n'a **aucune route `/cloturer` ni
`/annuler`** (`chick-batches.controller.ts`) — le PATCH générique
(`{buildingId?, status?}`) est donc le **seul** chemin possible vers
`CLOTURE`/`ANNULE`, sans précondition serveur, et sans convention
"transitions libres vs endpoint dédié" documentée dans son DTO (il n'y a
rien à contourner). Exposer `status` dans le formulaire d'édition
créerait de facto la seule UI de transition de statut jamais testée pour
ce module. **Décision** : le formulaire de modification `ChickBatch`
n'expose que `buildingId` — aucun sélecteur de statut cette phase.
Candidat Phase 14 : ajouter un endpoint dédié avec précondition (ex.
`currentHeadcount === 0` ou `null` avant clôture) plutôt que de
contourner via le PATCH générique.

### 4 KPI couvoir + solde de poussins orientables + `availableFertileEggs` — jamais exposés par l'API, recalculés côté client

Les 4 formules (`computeHatchRatePercent`, `computeFertilityRatePercent`,
`computeEmbryonicMortalityRatePercent`, `computeInfectedRatePercent`,
`calculations/incubation-kpi.calculations.ts`) sont calculées et testées
unitairement côté backend mais **ne sont exposées par aucune route** —
ni dans `GET /incubation-batches/:id`, ni par un endpoint dédié.
Précision par rapport au point Phase 8 déjà existant ("2 KPI couvoir...
jamais exposés") : en réalité **les 4** taux sont concernés, pas
seulement `computeFertilityRatePercent`/`computeInfectedRatePercent` —
`computeHatchRatePercent` et `computeEmbryonicMortalityRatePercent` ne
sont pas exposés non plus. Répliqués fidèlement côté client
(`features/incubation-batches/kpi.ts`, testé unitairement).

Même situation pour le solde de poussins orientables
(`chicksHatched − SUM(BatchLineage.quantity)`, aucun endpoint GET dédié
— `features/batch-lineage/available-chicks.ts`, testé unitairement) et
pour `BreederBatch.availableFertileEggs` (celui-ci **est** déjà exposé
en lecture par `GET /breeder-batches/:id`, contrairement aux deux
premiers — pas de recalcul nécessaire côté client, juste affiché tel
quel).

### Cohérence du bilan de mirage/éclosion — vérification uniquement asynchrone (cron), pas au moment de la saisie

`IncubationBatchesService.update()` (le PATCH générique, qui porte aussi
le bilan) n'a **aucune vérification synchrone** que
`eggsInfertile + eggsInfected + embryonicMortality + chicksHatched =
eggCount` — seul le cron quotidien (`BreederAlertsCronService.
checkCoherence`) lève une alerte asynchrone non bloquante
(`incubation_coherence`, sévérité CRITIQUE) en cas d'écart, une fois par
jour. L'indicateur client ajouté sur le formulaire d'édition ("Somme du
bilan : X / Y œufs incubés", `incubation-batch-form.tsx`) est une **aide
à la saisie**, pas une garantie — un enregistrement incohérent est
toujours accepté par le serveur, l'utilisateur ne le découvre qu'au
prochain passage du cron (jusqu'à 24h de latence).

### `GET /breeder-batches`, `GET /incubation-batches`, `GET /chick-batches` — toujours sans filtre/pagination serveur

Les trois `findAll()` sont structurellement identiques à `GET
/broiler-batches`/`GET /layer-batches` (Phases 11/12, non corrigé
depuis) : `findMany({ where: { farmId } })` sans aucun filtre ni
pagination. Même mitigation "toggle Actifs/Tous purement côté client"
appliquée aux trois nouvelles listes (`reproducteurs/page.tsx`,
`couvoir/page.tsx`, `poussins/page.tsx`) — palliatif d'affichage, gap
réseau backend toujours ouvert pour 5 modules désormais.

### `Incubator.remove()` sans contrôle FK préalable — risque de 500 générique

`IncubatorsService.remove()` (`incubators.service.ts`) appelle
directement `prisma.incubator.delete()` sans vérifier au préalable
l'existence d'`IncubationBatch` liés — contrairement à
`BreederBatchesService.remove()`, qui fait ce contrôle explicitement et
renvoie un 409 propre. Aucun filtre d'exception global ne gère les
erreurs Prisma `P2003` (contrainte FK) dans `apps/api/src/common`. Une
suppression sur une couveuse en cours d'usage échouera donc
probablement avec une erreur non interceptée proprement (500
générique), pas un message métier clair.

**Vérifié en manipulation réelle cette phase** (suppression d'une
couveuse référencée par `INC-2026-001`) : le serveur renvoie
effectivement une erreur non gérée, avec un corps JSON
`{statusCode: 500, message: "Internal server error"}` — le filtre
d'exception NestJS par défaut. Le message de fallback préparé côté UI
(`extractMessage` avec un texte dédié, `couveuses/page.tsx`) **ne
s'affiche en réalité jamais** dans ce cas précis : `extractMessage`
trouve `body.message` (une vraie chaîne, "Internal server error") et
l'utilise en priorité, avant d'atteindre le fallback — l'utilisateur
voit donc "Internal server error" tel quel, pas le message construit.
Comportement stable (aucune corruption de données, la couveuse reste
listée), mais UX dégradée. Corriger proprement nécessiterait soit un
409 métier explicite côté backend (comme `BreederBatchesService.
remove()`), soit un cas spécial côté `extractMessage`/l'appelant pour
ignorer les messages génériques NestJS ("Internal server error",
"Bad Request", etc.) — hors périmètre frontend cette phase, candidat
Phase 14 au même titre que le 409 manquant côté service.

### Bouton "Orienter les poussins" — pas de rafraîchissement optimiste multi-onglets

Le solde disponible affiché avant orientation (`OrientationForm`) est
calculé au chargement de la page et non re-synchronisé en continu — si
un second onglet/utilisateur oriente une partie du même solde entre le
chargement et la soumission, le nombre affiché devient obsolète. Choix
assumé : le 409 serveur (verrouillage `SELECT ... FOR UPDATE`, testé en
concurrence réelle côté backend Phase 8) reste la seule source de
vérité en cas de dépassement — construire un mécanisme de
rafraîchissement optimiste supplémentaire aurait été de la
sur-ingénierie pour un cas à faible fréquence déjà correctement
protégé côté serveur.

### Navigation mobile — 4 nouvelles entrées, défilement horizontal défensif, pas de sous-menu

`nav-items.ts` passe de 4 à 8 entrées avec cette phase (Reproducteurs/
Couveuses/Couvoir/Poussins ajoutés, chacun gaté par sa propre
permission, cohérent avec le fait que `Vendeur/Caisse` n'a que
`CHICK_BATCHES_READ` sans les 3 autres). `app-bottom-nav.tsx`
(`justify-around`, hauteur fixe, aucune notion de groupe/sous-menu) ne
tenait pas 8 icônes sur la largeur d'un mobile — `overflow-x-auto` +
`shrink-0` ajoutés pour absorber le débordement sans les tasser
illisiblement. Reste une dette UX réelle, non résolue ici : un
Gérant/Administrateur avec toutes les permissions doit désormais faire
défiler la barre du bas pour atteindre les derniers modules ; une
vraie sous-navigation par domaine (Élevage/Couvoir/Ventes...) serait la
correction propre, hors périmètre d'une simple correction défensive.

**Toujours vrai en Phase 21** : la sidebar desktop a depuis été
restructurée en catégories dépliables (`NavCategory`/
`getVisibleNavEntries`, `nav-items.ts`) — exactement le regroupement par
domaine envisagé ci-dessus. Mais cette infrastructure n'a volontairement
pas été branchée sur `app-bottom-nav.tsx`, qui garde son patron à plat
(`flatNavItems`, mêmes 14 routes, même défilement horizontal) : une vraie
sous-navigation mobile (tiroir/bottom-sheet à 2 niveaux) est un nouveau
patron d'interaction, pas une simple réutilisation des données déjà
groupées — hors périmètre d'une phase de réorganisation de menu. Cette
dette reste donc entière côté mobile, seulement mieux outillée pour être
résolue plus tard.

### Suivi journalier reproducteurs, bilan mirage-éclosion, formulaire ChickBatch et couveuses sans test de composant

Comme pour Chair/Pondeuses (Phases 11/12) : validation manuelle en
navigateur uniquement cette phase pour `breeder-batches/components/
daily-record-form.tsx`, `incubation-batch-form.tsx` (bilan), les
formulaires `incubator-form.tsx`/`chick-batch-form.tsx`, faute de temps.
Priorité donnée aux tests de la logique la plus à risque de divergence
avec le backend (les 4 KPI, le solde de poussins orientables, le rendu
conditionnel du formulaire d'orientation) — voir tests unitaires/
composant ajoutés cette phase (`kpi.test.ts`, `available-chicks.test.ts`,
`schemas.test.ts`, `orientation-form.test.tsx`).

## Phase 14 — Frontend Stocks/Achats/Finances (dernier module V1-V5)

Cinquième et dernier module métier frontend du périmètre V1-V5 : Items/
StockMovement (catalogue, statut VERT/ORANGE/ROUGE, mouvement manuel),
PurchaseOrder/GoodsReceipt/SupplierPayment (cycle d'achat complet,
premier `useFieldArray` du frontend), Expense (dépenses générales et
rattachées), Treasury (journal, créances, dettes, rentabilité
consolidée — 4 endpoints déjà agrégés côté API). Backend 100% construit
et testé depuis les Phases 7/8 — phase strictement frontend, sauf la
mutualisation du widget d'alertes (voir "✅ Corrigé") et la
documentation.

### Catégorie `Item` — dérive de casse trouvée et corrigée cette phase

Aucune valeur canonique n'existe en base (pas de seed `Item`), et le
code existant contenait déjà 2 casses différentes pour le même concept
(`'aliments'` en frontend Chair/Pondeuses vs `'Alimentation'` dans les
fixtures e2e backend, cette dernière non normative). `docs/reference/
STOCKS.md` tranche : 8 catégories canoniques (*aliments, médicaments,
vaccins, désinfectants, litière, équipements, carburant,
consommables*), cohérentes avec le frontend existant. Corrigé en
amont : `ItemForm` utilise un `<Input list="item-categories">` avec un
`<datalist>` pré-rempli de ces 8 valeurs + les catégories déjà
observées en base — le champ reste texte libre côté API (aucune
contrainte ajoutée côté serveur), juste guidé côté saisie. N'a pas
touché les fichiers Chair/Pondeuses déjà mergés (hors périmètre).

### `POST /purchase-orders/:id/annuler` — différé (0 couverture e2e)

Endpoint existe (permission `PURCHASE_ORDERS_CLOSE`, garde 409 si des
réceptions existent déjà) mais aucune occurrence dans
`apps/api/test/*.e2e-spec.ts` (grep confirmé). Même critère que
Breeder/Incubation Phase 13 (action de transition + garde métier
conditionnelle jamais exercée par un test → pas de bouton construit).
`PurchaseOrder` n'a par ailleurs pas le bug "statut terminal non
protégé" des 4 modules d'élevage : `PurchaseOrdersService.update()`
vérifie réellement `status='COMMANDE'` uniquement depuis `BROUILLON`
(400/409 selon le cas) — seule la garde d'`/annuler` elle-même reste
non exercée.

### Réception sur une commande `BROUILLON` — techniquement acceptée côté serveur, restreinte côté UI

`GoodsReceiptsService.create()` ne rejette que `status ∈ {ANNULE,
RECU}` — une commande encore en `BROUILLON` (jamais confirmée) peut
donc techniquement recevoir une réception, sans qu'aucune garde ne
l'en empêche. `docs/reference/ACHATS_ET_FOURNISSEURS.md` définit
pourtant un cycle linéaire explicite (Brouillon → Commandé →
Partiellement reçu → Reçu → Annulé) où une réception n'a de sens
qu'après confirmation — ce silence serveur ressemble à une garde
manquante plutôt qu'à une fonctionnalité voulue. **Décision** : le
bouton "Réceptionner" n'est affiché côté UI que si `status ∈
{COMMANDE, PARTIELLEMENT_RECU}` — restriction UX assumée, pas une
correction du gap serveur (hors périmètre frontend), candidat Phase 15
(ajouter la garde manquante côté `GoodsReceiptsService`).

### 4 KPI couvoir et taux de rentabilité : formules jamais exposées, recalculées côté client

Sans lien avec ce module directement, mais confirmé à nouveau ce
phase : `computeReceiptDiscrepancy` (écart de réception), lui, EST
exposé (`PurchaseOrderItemWithComputed.discrepancy`) — contrairement
aux KPI couvoir (Phase 13), aucun recalcul client n'est nécessaire ici,
juste un affichage direct. Mentionné pour mémoire : ne pas supposer
systématiquement qu'un calcul métier doit être répliqué côté frontend
sans avoir vérifié si le serveur l'expose déjà (ce fut le cas ici,
contrairement à l'hypothèse initiale du kickoff).

### Pas d'écran de gestion des Fournisseurs (ni Buildings) — candidat "référentiels partagés"

Le kickoff ne demande que la *sélection* de fournisseurs (Items/
PurchaseOrder/Expense), jamais leur CRUD. `Building` a une API CRUD
complète côté backend depuis la Phase 3 mais aucune UI de création
n'existe après 5 phases frontend — `Supplier` est dans la même
situation. Pas un oubli isolé : un pattern déjà établi de deux
référentiels transverses jamais rattachés à un module propriétaire
unique. Candidat pour une future phase "référentiels partagés"
(Buildings + Suppliers ensemble, même gap structurel, même solution),
à traiter groupé plutôt que redécouvert séparément.

### `GET /items`, `/purchase-orders`, `/expenses` — pagination/filtre serveur

`GET /purchase-orders` et `GET /expenses` n'ont aucun filtre/pagination
serveur (même gap que tous les modules précédents) — mitigé par le
toggle "Actifs/Tous" habituel sur `achats/page.tsx` (`expenses/page.tsx`
n'a pas ce toggle, `Expense` n'ayant pas de notion de statut/cycle de
vie comparable). `GET /items` fait exception notable : `belowThreshold`
est un **vrai filtre serveur** (`ListItemsQueryDto`), pas un palliatif
client — premier module du projet où le toggle "liste réduite" est
réellement offload côté API plutôt que du filtrage en mémoire sur une
liste déjà entièrement récupérée.

### Formulaires sans test de composant

Comme les phases précédentes : validation manuelle en navigateur
uniquement pour `item-form.tsx`, `expense-form.tsx`,
`goods-receipt-form.tsx`, faute de temps. Priorité donnée aux tests de
la logique la plus à risque de divergence/régression silencieuse
(mapping reason→type des mouvements de stock, calculs d'affichage des
lignes de commande/réception, avertissement de dépassement de solde de
paiement) — voir `reason-type.test.ts`, `line-totals.test.ts`,
`receipt-remaining.test.ts`, `supplier-payment-form.test.tsx`.

## Phase 15 — Durcissement frontend ciblé (avant V6)

Phase issue du bilan de complétude frontend
(`docs/architecture/BILAN_COMPLETUDE_FRONTEND_V1_V5.md`) — corrige les
points prioritaires identifiés avant V6, même logique que la Phase 8
côté backend. Les correctifs (garde "Vendre", rollout `extractMessage`,
KPI dashboard, 2 colonnes de liste, 4 fichiers de test) sont détaillés
dans "✅ Corrigé" ci-dessous ; les points suivants sont des décisions de
périmètre prises **sans code** cette phase, documentées explicitement.

- **`BroilerBatchesService.cancel()` reste sans garde d'effectif,
  décision explicite** : `cancel()` (`broiler-batches.service.ts:429-
  443`) passe une bande à `ANNULEE` sans vérifier `currentHeadcount`,
  contrairement à `close()` qui bloque si `currentHeadcount > 0`. Risque
  réel confirmé par le bilan frontend, mais **désormais borné** par la
  garde `isBatchOpen` ajoutée cette phase sur le bouton "Vendre" (voir
  "✅ Corrigé") : une bande `ANNULEE` ne peut plus jamais afficher ce
  bouton, quel que soit son effectif réel. `/annuler` n'est par ailleurs
  exposé nulle part côté UI et n'a 0 couverture e2e
  (`apps/api/test/broiler-batches.e2e-spec.ts` ne teste que
  `/cloturer`) — même critère que Breeder/Incubation (Phase 13) : action
  de transition sans garde métier exercée par un test → différée, pas
  corrigée en douce. Candidat pour un futur durcissement backend
  (aligner `cancel()` sur `close()`), au même titre que le reste de la
  dette "statuts terminaux" déjà groupée (Phase 11).
- **OAuth Google/Microsoft — bouton de connexion toujours absent,
  décision explicite** : `GET /auth/oauth/{google,microsoft}` existent
  et fonctionnent côté backend, mais `OAUTH_GOOGLE_CLIENT_ID`/
  `OAUTH_MICROSOFT_CLIENT_ID` sont vides dans `.env.example`, et les
  stratégies passport (`apps/api/src/modules/auth/strategies/{google,
  microsoft}.strategy.ts`) retombent sur la chaîne littérale
  `'not-configured'` en leur absence. Câbler un bouton qui échouerait
  systématiquement serait une pire UX que son absence — différé jusqu'à
  ce que de vraies credentials d'app soient enregistrées (dette connue
  depuis Phase 1). Candidat pour cette échéance : un flag d'activation
  conditionnelle côté frontend plutôt qu'un bouton toujours visible.
- **Édition/suppression de mortalité et d'événements sanitaires
  (Chair) — toujours absentes, décision explicite** : le backend expose
  déjà `PATCH`/`DELETE /broiler-batches/:batchId/mortality/:id` et
  `PATCH /broiler-batches/:batchId/health-events/:id` avec permissions
  dédiées, mais `features/broiler-batches/hooks.ts` n'a que les hooks de
  création. Aucun composant "dialog d'édition de sous-ressource"
  générique n'existe dans le projet à réutiliser — construire ceci
  (2 hooks + 2 dialogs + colonnes Actions + `ConfirmDialog`) représente
  un coût net réel, différé pour ne pas déborder le périmètre déjà
  substantiel de cette phase. Non bloquant : la création reste
  fonctionnelle, aucune corruption de donnée possible.
- **11 des 13 colonnes du §4.2 (liste des bandes Chair) restent
  absentes** : seules Date d'arrivée et Bâtiment ont été ajoutées cette
  phase (coût nul : déjà dans le payload / hook de lecture déjà
  existant). Les colonnes restantes (mortalités cumulées, taux de
  mortalité, poids moyen...) nécessiteraient un agrégat serveur par
  bande sur la liste — hors périmètre, aucun endpoint agrégé de ce type
  n'existe (`GET /broiler-batches` reste sans filtre/pagination serveur,
  dette déjà documentée Phase 11).
- **Aucun écran d'administration utilisateurs/rôles, décision
  explicite** : les 11 rôles réels de `roles.catalog.ts` restent ni
  visibles ni assignables depuis le frontend. Différé — un seul compte
  Propriétaire/Administrateur suffit à l'usage réel actuel à Samba,
  l'attribution de rôle reste possible via seed/API directe pour le peu
  de comptes concernés. Candidat pour une future phase "référentiels
  partagés" (déjà envisagée pour Buildings/Suppliers).
- **Tests de composants (React Testing Library) toujours absents sur
  Eau/Chair/Pondeuses** : cette phase ajoute 4 fichiers de test (3
  fonctions pures + 1 schéma Zod, voir "✅ Corrigé"), mais aucun test de
  composant (rendu, interaction utilisateur) sur les formulaires de ces
  3 modules — seuls `orientation-form.test.tsx` (Phase 13) et
  `supplier-payment-form.test.tsx` (Phase 14) existent dans tout le
  projet. Gap honnêtement non résolu, chantier plus large que le
  périmètre ciblé de cette phase.

## Phase 16 — Backend Patrimoine & Amortissements (premier module V6)

Premier module backend V6 (cahier §3) : cycle de vie complet d'un actif
(acquisition, mise en service, amortissement linéaire prorata temporis,
transfert, réforme, sortie). Backend uniquement, aucun écran cette
phase. Le cahier V6 est nettement moins détaillé que V1/V5 (10 pages de
synthèse) — plusieurs zones d'ombre ont dû être tranchées explicitement,
documentées ci-dessous comme des hypothèses assumées, pas des faits du
cahier.

- **Prorata temporis — modèle de calendrier fiscal, hypothèse non
  vérifiable dans le cahier** : le tableau d'exemple du §3.2 (Année N
  "Prorata temporis" / Année N+1 "Annuité" / Fin "Solde éventuel") a été
  interprété comme des périodes alignées sur l'année civile (première
  période de `serviceDate` au 31 décembre proratisée au jour près,
  années intermédiaires pleines, **dernière période = solde** pour
  garantir que la VNC finale tombe exactement sur la valeur résiduelle
  sans dérive d'arrondi). Aucun exemple chiffré complet n'existe dans le
  cahier pour trancher sans ambiguïté entre ce modèle et une alternative
  anniversaire (périodes de 365 jours depuis `serviceDate`, sans
  alignement calendaire) — l'hypothèse retenue est la plus probable
  (convention comptable standard, cohérente OHADA) mais **reste à faire
  valider par un comptable local avant tout usage réel en production**.
  Implémentée et testée dans
  `apps/api/src/modules/assets/calculations/depreciation.calculations.ts`
  (13 tests unitaires, cas limites : durée 1 an, mise en service au 1er
  janvier exact, année bissextile, valeur résiduelle nulle/non nulle,
  arrondi sur une base peu divisible). **Mise à jour Phase 20** : le
  point de blocage technique (redéploiement nécessaire pour changer de
  convention) est levé — voir "✅ Corrigé" ci-dessous — mais la
  validation comptable elle-même reste entièrement ouverte, ce n'est
  pas la même chose que "résolu".
- **`serviceDate` obligatoire à la création, pas de statut intermédiaire
  "acquis mais pas encore en service"** : le cahier distingue "date
  d'achat" et "date de mise en service" comme deux étapes du cycle de
  vie ("acquisition, mise en service..."), et un vrai précédent de
  transition différée existe dans le projet (`PurchaseOrder`
  BROUILLON→COMMANDE). Simplification assumée pour cette phase : les
  deux dates sont saisies ensemble à la création, le plan
  d'amortissement est généré immédiatement — cohérent avec l'unique
  scénario d'acceptation du cahier (§19), qui décrit un flux en un seul
  temps. `purchaseDate`/`serviceDate` restent deux champs réellement
  indépendants pour ne pas fermer la porte à un futur endpoint de mise
  en service différée si l'usage réel en montre le besoin.
- **`DepreciationEntry` supprimée en cascade avec `Asset`, pas
  append-only comme `StockMovement`** : décision délibérée, pas un
  oubli — contrairement à `StockMovement` (événements réels
  indépendants), une `DepreciationEntry` est une projection déterministe
  dérivée uniquement des paramètres de l'actif, sans valeur informative
  propre si l'actif n'aurait jamais dû exister. Même gabarit exact que
  `BroilerBatchesService.remove()` pour ses 45 `BroilerDailyRecord`
  placeholder : le garde-fou de suppression (`AssetsService.remove()`)
  porte sur l'activité RÉELLE (`Expense.assetId`), jamais sur la
  présence des lignes de plan elles-mêmes.
- **"Transfert" — pas d'endpoint dédié** : le cahier ne donne aucun
  détail au-delà de la phrase d'ouverture du §3. Un changement de
  localisation/responsable passe par le `PATCH` générique, avec l'audit
  log standard qui capture déjà la traçabilité attendue.
- **TCO partiel cette phase** : `TCO = Acquisition + Installation +
  Maintenance + Réparations + Consommables + Autres` (§3.3) dépend du
  module Maintenance (Phase 17, hors périmètre). Calculé à la lecture
  comme `purchasePriceFcfa + installationCostFcfa + SUM(Expense.
  amountFcfa WHERE assetId = asset.id)` — couvre déjà réparations/
  consommables/autres dès qu'une dépense est rattachée à l'actif,
  extensible sans refonte une fois Maintenance construit.
- **Modèle de données simplifié vs le §18 du cahier** : le schéma
  consolidé suggéré (`asset_categories, assets, asset_components,
  asset_locations, asset_documents, asset_costs` +
  `depreciation_methods, depreciation_schedules, depreciation_entries`
  — 9 tables) a été réduit à 2 nouvelles tables (`Asset`,
  `DepreciationEntry`) : `category`/`location` en texte libre (comme
  `Item.category`/`WaterPoint.location`), `asset_documents` couvert par
  le module `Document` déjà polymorphe (`entityType:'asset'`, aucune
  extension nécessaire), `asset_costs` couvert par `Expense.assetId`
  (8ᵉ FK optionnelle, même patron exact que l'extension Phase 7 pour
  `breederBatchId`/`incubationBatchId`/`waterPointId`), `depreciation_
  methods`/`depreciation_schedules` jugées superflues pour une seule
  méthode active et des paramètres qui vivent directement sur `Asset`.
  `asset_components` non construit — aucun des 4 points fonctionnels de
  cette mission ne le demande ; le seul besoin proche trouvé dans le
  cahier ("amortissement séparé des composants") est rattaché au §4
  Autonomie solaire, un module V6 distinct et hors périmètre.
- **Pas de recouvrement avec `Building`** : un `Asset` de catégorie
  "Bâtiments" (enregistrement comptable) reste indépendant de l'entité
  `Building` opérationnelle (FK des bandes d'élevage) — aucun lien
  structurel construit, décision documentée explicitement puisque le
  cahier V6 ne tranche pas cette frontière lui-même.

## Phase 17 — Backend Maintenance (deuxième module V6)

Module de planification et traçabilité de l'entretien/pannes/réparations
des `Asset` (cahier V6 §7), dépendant de Patrimoine (Phase 16). **Le
cahier V6 §7 est encore plus laconique que ne l'était le §3 (Patrimoine)**
: 6 puces conceptuelles, aucun champ détaillé, aucune formule de
récurrence, aucun exemple chiffré — contrairement à l'amortissement §3.2
qui donnait au moins la mécanique de calcul. Chaque zone d'ombre est
tranchée ci-dessous comme hypothèse explicite, avec la même discipline
qu'en Phase 16 (prorata temporis).

- **Périodicité en jours entiers, sans unité imposée par le cahier**
  (`MaintenancePlan.periodicityDays: Int`) — hypothèse d'ingénierie
  assumée. Le tableau d'exemples §7 associe "Pompe forage" à un
  déclencheur possible par compteur d'usage ("heures de fonctionnement"),
  hors de portée cette phase : aucun champ de ce type n'existe nulle part
  dans le projet (`WaterPoint` n'a pas de compteur d'heures). Limite
  connue, pas un oubli.
- **Génération des tâches préventives à la demande** (pas de
  pré-génération en masse comme `DepreciationEntry`/45
  `BroilerDailyRecord`) : un plan de maintenance est ouvert/infini dans le
  temps, sans durée fixe connue — analogue à `LayerBatch`, pas à
  `BroilerBatch`/`Asset`. La première tâche est créée à `dueDate =
  plan.startDate` directement dans la même transaction que le plan ; les
  suivantes sont générées **immédiatement, dans la même transaction**,
  à la clôture de la précédente (intervention ou annulation) — jamais
  différé au cron quotidien, qui n'est qu'un filet de sécurité (rattrape
  les tâches orphelines). Ancrage systématique sur la dernière
  **intervention réelle** du plan (jamais une tâche annulée), pour ne pas
  laisser le planning dériver silencieusement en l'absence de toute
  maintenance effective.
- **Verrouillage `SELECT ... FOR UPDATE`** sur la ligne `MaintenancePlan`
  avant génération (`MaintenanceTaskGenerationService.ensureNextTaskGenerated`,
  même pattern que le verrouillage `Item` dans
  `StockMovementsService.recordMovementInTransaction`) — garantit qu'au
  plus une tâche ouverte existe par plan actif malgré des appels
  concurrents (clôture transactionnelle + cron de rattrapage). Couvert par
  un test e2e dédié (deux générations concurrentes sur le même plan,
  vérifie qu'une seule tâche est créée).
- **`MaintenanceIntervention` append-only** (pas de PATCH/DELETE exposés)
  — traitée comme un événement réel immuable, à l'identique de
  `StockMovement`, PAS comme `DepreciationEntry` (projection déterministe
  supprimable) : une intervention a déjà consommé du stock et généré un
  coût réel au moment de sa création. Correction d'une intervention
  erronée : aucun nouveau mécanisme construit — soft-delete de l'`Expense`
  auto-créée (déjà exclue du TCO via `deletedAt: null`) + mouvement de
  stock compensatoire via l'endpoint `AJUSTEMENT` déjà existant si la
  quantité physique doit être corrigée.
- **Pas de table `maintenance_parts`** (suggérée au §18) : le
  `StockMovement` (`sourceType='maintenance_intervention'`,
  `sourceId=intervention.id`, mécanisme polymorphe déjà générique) EST la
  trace de la pièce utilisée — `partsCostFcfa`/`totalCostFcfa` recalculés
  à la lecture, jamais stockés.
- **Pas de table `asset_incidents`** (suggérée au §18) : une panne non
  résolue = `MaintenanceTask(type=CORRECTIVE, planId=null, status=A_FAIRE)`
  créée manuellement ; une réparation déjà effectuée sans planification
  préalable = `MaintenanceIntervention(taskId=null)`. Deux mécanismes
  complémentaires, pas de table dédiée.
- **Coût imputé à l'actif — zéro changement de code sur `AssetsService`** :
  `attachComputed()` sommait déjà `Expense.amountFcfa WHERE assetId=...`
  depuis la Phase 16 (préparé explicitement pour ce module). Chaque pièce
  consommée déclenche un mouvement de stock (`reason: MAINTENANCE`,
  nouvelle valeur d'enum, réservée au flux automatique via
  `AUTOMATIC_ONLY_REASONS`) PUIS une `Expense` liée
  (`category:'Pièces maintenance'`), même pattern exact que
  `HealthEventsService.applyHealthStockInstructions` (Phase 3/7) ; la
  main-d'œuvre génère une `Expense` séparée (`category:"Main-d'œuvre
  maintenance"`).
- **Garde `REFORME`** : impossible de créer un plan, une tâche ou une
  intervention sur un `Asset` déjà réformé (409) — absente du code Phase
  16 (seul le cron d'alertes filtrait les actifs réformés), ajoutée ici
  dès l'origine plutôt que découverte plus tard. `AssetsService.remove()`
  a aussi été étendu (garde sur `MaintenanceTask`/`MaintenanceIntervention`
  liés) : les nouvelles FK `ON DELETE RESTRICT` introduites par cette
  phase auraient sinon fait remonter une erreur SQL brute (500) au lieu
  d'un 409 propre lors de la suppression d'un actif à historique de
  maintenance.
- **`entityId` des alertes reste l'id de la tâche, jamais
  `Asset.responsibleId`** — cohérence avec l'usage uniforme du reste du
  projet (`entityType:'asset', entityId: asset.id`, jamais un id
  utilisateur). Le "responsable alerté" du scénario §19 ("Maintenance
  pompe à échéance") est **interprété comme un broadcast ferme-entière**
  via `NotificationsService.notifyForAlert` (tous les titulaires d'un
  rôle portant `ALERTS_ACKNOWLEDGE`) : **aucun mécanisme de ciblage
  individuel par utilisateur n'existe nulle part dans le code actuel** —
  en construire un aurait été hors de proportion pour cette phase.
  Hypothèse assumée, à documenter/valider si un vrai besoin de ciblage
  individuel émerge plus tard.
- **Sévérité `IMPORTANT` (pas `VIGILANCE`) pour la maintenance en
  retard** — choix délibéré : seules `IMPORTANT`/`CRITIQUE` franchissent
  `NOTIFIED_SEVERITIES` et déclenchent une vraie notification
  (`alerts.service.ts`). Une alerte `VIGILANCE` reste silencieuse (visible
  seulement au tableau de bord), ce qui n'aurait pas satisfait le texte
  littéral du §19 ("responsable alerté").
- **Aucun rôle RBAC "technicien" inventé** — le cahier V6 n'en mentionne
  aucun nulle part. Distribution calquée sur `ASSETS_*` (Propriétaire/
  Gérant = accès complet, Comptable = tout sauf `DELETE`, Lecteur =
  lecture seule) ; `Magasinier/Responsable stocks` ne reçoit rien cette
  phase malgré son lien logique avec la consommation de pièces, cohérent
  avec l'absence de permissions `ASSETS_*` pour ce même rôle en Phase 16.
- **Aucun code métier auto-généré** (`PAT-AAAA-NNN` n'a pas d'équivalent
  ici) : le cahier ne nomme jamais de champ "code" pour la maintenance,
  contrairement à Asset (§3.1).
- **Scénarios e2e minces** : les deux scénarios §19 utilisés ("Maintenance
  pompe à échéance" → "Tâche créée et responsable alerté" ; "Pièce
  utilisée en réparation" → "Stock décrémenté et coût imputé à l'actif")
  sont chacun une seule phrase de résultat attendu, sans détail
  exploitable — nettement plus minces que le scénario Patrimoine (§19
  assets). Le test e2e les complète par des scénarios inventés
  (concurrence, gardes, RBAC) documentés comme tels, pas comme un
  gabarit d'acceptation officiel.

## Phase 18 — Backend Autonomie eau/solaire/Internet (troisième module V6)

Suivi manuel des 3 infrastructures critiques (cahier V6 §4 solaire, §5
eau/forage, §6 réseau/Starlink). **Frontière vérifiée explicitement** :
`WaterPoint`/`WaterReading` (module V4, Phase 6) restent 100% commerciaux
(vente d'eau comptoir/riverains) — ce module ajoute la face "production/
infrastructure" (forage, centrale solaire, matériel réseau), sans aucun
recouvrement ni duplication.

- **3 tables séparées (`WaterInfrastructureReading`,
  `SolarInfrastructureReading`, `NetworkStatusReading`), pas une table
  unique** — décision initiale (1 table à colonnes nullable par domaine)
  rejetée après revue : le précédent `BroilerDailyRecord`/
  `LayerDailyRecord` (recouvrement de champs bien plus fort, tables quand
  même séparées) et `MaintenancePlan`/`Task`/`Intervention` (3 tables + 3
  groupes de permissions malgré un mandat RBAC identique) argumentent
  tous les deux pour la séparation. Argument décisif : `PermissionsGuard`
  est strictement endpoint-level (aucun filtrage par ligne/catégorie) —
  une table unique aurait rendu *techniquement impossible* d'étendre le
  rôle "Responsable eau" aux seuls relevés eau sans lui ouvrir aussi
  solaire/réseau.
- **Équation de contrôle eau (§5)** : "Eau produite = consommation ferme
  + eau vendue + pertes/écarts" (citation exacte du cahier), calculée à
  la lecture, jamais stockée (`computeWaterControlGapM3`, même
  philosophie que `computeSalesCashGapFcfa`, Phase 6). `soldVolumeM3` =
  `SUM(WaterReading.consumptionM3)` agrégé **ferme entière** (tous les
  `WaterPoint` confondus) pour la même date — pas `Sale` (`Sale.quantity`
  pour `productType=EAU` est un nombre de récipients en `saleMode=UNITE`,
  pas un volume m³ ; `WaterReading.consumptionM3` est la seule vérité
  métrée m³). `gapM3 = null` si `pumpedVolumeM3` absent (équation non
  calculable, cahier : "si mesurable"). Granularité jour (même
  périodicité que `WaterReading`) — hypothèse, le cahier ne précise
  aucune période pour l'équation.
- **`pumpHoursCumulative` — champ purement informatif** : relevé simple,
  sans chaîne de continuité (contrairement à `WaterReading.indexMatin/
  indexSoir`, enjeu moindre : suivi opérationnel, pas facturation).
  **Ne déclenche rien automatiquement** — `MaintenanceTaskGenerationService`/
  `computeNextDueDate` ne calculent les échéances que par périodicité
  calendaire (`periodicityDays`), aucun crochet pour un déclenchement par
  compteur d'heures cette phase (trou déjà documenté en Phase 17, non
  résolu ici).
- **`Asset.status` vs `NetworkStatusReading.operationalStatus` — deux
  notions distinctes, pas une redondance** : le premier est un statut de
  cycle de vie patrimonial (ACTIF/HORS_SERVICE/REFORME, long terme), le
  second une connectivité instantanée (OPERATIONNEL/DEGRADE/HORS_LIGNE,
  peut changer plusieurs fois par jour) — un `Asset` `ACTIF` peut avoir
  un relevé `HORS_LIGNE` (Starlink en coupure) sans que l'actif change de
  statut.
- **Alertes — absence de relevé récent, ajoutée après revue** : la
  décision initiale (aucune alerte de staleness, jugée hors du périmètre
  littéral "disponibilité faible/panne" du cahier) a été rejetée en
  confrontation avec un précédent direct du même domaine :
  `WaterAlertsCronService.checkMissingEntry()` alerte déjà sur "aucun
  relevé saisi pour hier" côté commercial. Seuil plus souple ici (défaut
  7 jours, paramétrable par domaine via `Setting`, contre "hier" strict
  pour `checkMissingEntry`) car ces relevés sont "si mesurable"/"si
  disponible", pas un rituel commercial quotidien obligatoire — vérifié
  seulement sur les `Asset` ayant déjà au moins un relevé, dédoublonnage
  persistant (pas re-déclenché chaque jour).
- **Sévérité `IMPORTANT`** (pas `VIGILANCE`) pour réservoir bas/batterie
  basse/réseau hors ligne — délibéré, pour franchir
  `NOTIFIED_SEVERITIES` et produire une vraie notification
  (infrastructures qualifiées "critiques" par le cahier), même choix
  qu'en Phase 17 pour la maintenance en retard.
- **RBAC — extension du rôle "Responsable eau"** : ce rôle (mandat §11
  "Points d'eau, relevés, ventes et encaissements") n'avait aucune
  permission `ASSETS_*`/`MAINTENANCE_*` avant cette phase. Étendu à
  `WATER_INFRASTRUCTURE_READINGS_CREATE/READ/UPDATE` uniquement (pas
  solaire/réseau, hors de son mandat déclaré) — extension rendue possible
  et sûre précisément par la séparation en 3 groupes de permissions.
  Pas d'extension à `ASSETS_READ`/`MAINTENANCE_*_READ` pour ce rôle cette
  phase (non demandé, raffinement futur possible).
- **Comptable — lecture seule sur les 3 domaines** (pas de CREATE/UPDATE,
  contrairement à son profil sur Assets/Maintenance) : ce ne sont pas des
  actes comptables comme créer un Asset/une Expense, mais des relevés
  opérationnels de terrain — même précédent que `WATER_READINGS_READ`
  (Comptable a déjà lecture seule sur `WaterReading` pour la même
  raison).
- **Inventaire/coût des 3 infrastructures déjà entièrement couverts,
  zéro nouveau code** : `Asset` (catégories "eau"/"solaire"/"internet",
  déjà canoniques depuis Phase 16) + `Expense.assetId` (déjà agrégé par
  `AssetsService.attachComputed().tcoFcfa` sans filtre de catégorie) +
  `MaintenanceModule` (déjà générique sur tout Asset, Phase 17) couvrent
  intégralement §5 "coût de production/distribution", §6 "coût
  d'acquisition et amortissement"/"abonnements et dépenses récurrentes"
  et "historique des incidents et maintenances" des 3 sections. Aucun
  nouveau mécanisme de "dépense récurrente" (`Expense` n'a et n'aura
  aucun champ `recurrence`) — les abonnements (ex. Starlink) restent des
  `Expense` classiques ressaisies manuellement à chaque échéance, lecture
  du cahier ("enregistrées comme charges d'exploitation récurrentes")
  comme classification comptable, pas comme demande d'automatisation.
- **Aucun scénario §19 dédié** à l'eau/solaire/Internet (vérifié
  verbatim) — les scénarios e2e sont construits à partir des champs du
  cahier + l'équation de contrôle, documentés comme inventés, pas comme
  gabarit d'acceptation officiel (même discipline que Phase 17).

## Phase 19 — Frontend Patrimoine/Maintenance/Infrastructures (premier frontend V6)

Premier frontend V6, construit sur les 3 modules backend Phase 16-18.

- **Infrastructures = onglets conditionnels sur la fiche Patrimoine, pas
  de module séparé** — les 3 contrôleurs backend sont nichés sous
  `/assets/:assetId/...` (aucun contrôleur top-level), la fiche Actif est
  le seul point d'entrée UI cohérent. La correspondance catégorie→onglet
  (Eau/Solaire/Réseau) n'est **pas** un simple confort d'affichage : le
  backend ne vérifie aucune correspondance catégorie/domaine
  (`assertAssetEligible` des 3 services Infrastructure ne teste que
  farm/statut REFORME, jamais `category`), donc une catégorie mal
  orthographiée aurait silencieusement masqué un onglet pourtant
  utilisable côté API. Corrigé à la source plutôt que compensé : le champ
  `category` du formulaire Actif est un `<Select>` strict sur les 10
  valeurs canoniques du cahier V6 §3 (`features/assets/schemas.ts`), sans
  option "Autre" en texte libre — élimine complètement le risque de faute
  de frappe (pas de filet de secours "afficher les 3 onglets par défaut"
  nécessaire, décision assumée). La correspondance onglet est une simple
  égalité (`asset.category === 'eau'`), pas une normalisation trim/
  lowercase/diacritiques — inutile puisque la valeur est déjà canonique à
  la source.
- **Maintenance = présence unique, pas de double surface** — aucun
  précédent dans le projet pour "page globale + onglet fiche" sur la
  même sous-ressource (Ventes/Mortalité/Santé n'ont jamais de page
  globale ; Alerts, le plus proche analogue, n'a qu'un widget dashboard +
  un widget filtré par entité). Retenu : page globale `/maintenance` en
  **lecture seule** (file d'attente transverse, triée par échéance,
  `isLate` mis en évidence, à la manière d'Alerts) — aucune création
  possible depuis cette page. Toute création/annulation se fait
  exclusivement depuis l'onglet Maintenance de la fiche Actif
  (`assetId` déjà connu du contexte). `MaintenanceTaskTable`
  (`features/maintenance/components/maintenance-task-table.tsx`) est un
  composant unique partagé entre les deux surfaces (prop
  `showAssetColumn`) — une seule définition de colonnes/tri.
- **Pas de nouveau composant `AssetSelect` mutualisé** — doctrine du
  projet (confirmée par `entity-select.tsx`) : mutualiser au 2ᵉ/3ᵉ usage
  réel, jamais par anticipation. La page Maintenance globale étant
  lecture seule (`assetId` toujours connu du contexte ailleurs), le seul
  site d'appel réel identifié est le formulaire Dépenses — lacune fermée
  directement (voir "✅ Corrigé" ci-dessous) plutôt que de créer un
  composant partagé sans second consommateur.
- **Aperçu de coût des pièces d'intervention — informatif, estimation
  assumée, pas un miroir garanti du calcul serveur**
  (`features/maintenance/intervention-cost-preview.ts`) : contrairement à
  `PurchaseOrderForm` (prix saisi par l'utilisateur des deux côtés,
  aucune divergence possible hors arrondi), le CUMP utilisé ici
  (`Item.averageUnitCostFcfa`) peut évoluer entre l'ouverture du Dialog
  et la soumission (réception de stock concurrente) — le serveur reste
  seul autoritaire sur `partsCostFcfa`. Mention explicite affichée sous
  l'aperçu plutôt que silence sur cette divergence possible.
- **Relevés d'infrastructure — création seulement, pas de modification
  depuis le frontend** cette phase, malgré `PATCH /assets/:assetId/
  {water,solar,network}-infrastructure-readings/:date` déjà exposé côté
  API. Choix aligné sur le seul précédent direct du projet pour ce type
  d'entité (`WaterReadingForm`, module V4 Phase 6 : création uniquement,
  aucune UI d'édition d'un relevé passé). Raffinement possible plus tard,
  non bloquant (une correction se fait par un nouveau relevé à la même
  date restant impossible sans UI d'édition — contrainte d'unicité par
  jour côté API, à corriger manuellement en base si nécessaire d'ici là).
- **Tâches de maintenance — pas de modification de désignation/échéance
  depuis le frontend** (`MAINTENANCE_TASKS_UPDATE` existe côté API,
  non câblé côté UI cette phase) : seules création (manuelle,
  CORRECTIVE/CONDITIONNELLE) et annulation sont exposées, cohérent avec
  le flux réel attendu (une tâche PREVENTIVE est générée automatiquement,
  une tâche manuelle mal saisie s'annule et se recrée plutôt que de se
  corriger). Idem pour `MaintenancePlan` (`MAINTENANCE_PLANS_UPDATE/
  DELETE` non câblés — un plan mal configuré se corrige aujourd'hui
  uniquement côté API/support).

## Phase 20 — Durcissement V6 (Patrimoine/Maintenance)

Correctifs ciblés sur les 2 points 🔴 du bilan de complétude V6
(`docs/architecture/BILAN_COMPLETUDE_V6_PATRIMOINE_MAINTENANCE_INFRA.md`)
et 3 des 4 points 🟠 secondaires — même logique que les Phases 8 et 15
(durcissement avant d'ajouter du nouveau). Backend uniquement, aucun
écran cette phase. Détail des corrections dans "✅ Corrigé" ci-dessous.

- **Différé, pas traité cette phase — les 6 autres points lisant
  `asset.status==='REFORME'` sans verrou** (constat transversal n°2 du
  bilan V6 : `MaintenancePlansService.create()`,
  `MaintenanceTasksService.create()`,
  `MaintenanceInterventionsService.create()`, 3×
  `*-infrastructure-readings.service.ts` `create()`). 4 des 6 méthodes
  concernées n'ouvrent aujourd'hui aucune transaction — le correctif
  n'est pas une copie mécanique d'une requête raw dans un `tx` déjà
  existant (comme pour `MaintenancePlansService.create()` et
  `MaintenanceInterventionsService.create()`, déjà transactionnelles),
  mais une restructuration ouvrant une nouvelle transaction, avec un
  effet de bord réel : verrouiller `assets` pendant l'écriture d'une
  table indépendante sérialiserait des écritures auparavant concurrentes
  sans conflit (ex. deux relevés eau à des dates différentes sur le même
  actif, déjà protégés par `@@unique([assetId,date])`). Combiné au fait
  que le bilan qualifie ce risque de "probabilité très faible" (saisie
  généralement séquentielle par un seul responsable), ce chantier
  dépasse le périmètre d'un durcissement ciblé — à reprendre dans une
  phase dédiée si le besoin réel se confirme.
- **Point transversal découvert pendant cette phase, hors périmètre du
  bilan V6, depuis corrigé — voir "✅ Corrigé" ci-dessous pour la cause
  réelle et le correctif.** Diagnostic initial erroné, corrigé
  explicitement plutôt que laissé en l'état : la suite e2e `apps/api`
  ne démarrait plus (projet entier, pas spécifique à cette phase),
  d'abord attribuée à un problème de chargement du compilateur WASM de
  Prisma 7.x (`WasmQueryCompilerLoader`/`getQueryCompilerWasmModule`).
  **Cette attribution était fausse** — le symptôme observé alors
  (`pool timeout... active=0 idle=0`) était réel, mais sa cause ne
  l'était pas. La vraie cause, révélée par un rapport de bug utilisateur
  distinct ("Internal server error" au login, `docker logs` exploités
  jusqu'au champ `cause` imbriqué de l'erreur Prisma) : authentification
  MySQL `caching_sha2_password` sans `allowPublicKeyRetrieval`, voir
  l'entrée dédiée ci-dessous. Le compilateur WASM n'a jamais été en
  cause ; le pool ne se remplissait simplement jamais faute
  d'authentification réussie, sur toute requête Prisma du projet, pas
  seulement en test. Leçon retenue : un symptôme "pool timeout"
  générique doit toujours être creusé jusqu'au champ `cause` imbriqué
  avant toute attribution, jamais arrêté au premier message d'erreur de
  surface.

## Phase 21 — Réorganisation du menu (navigation groupée)

Regroupement des 14 entrées à plat de `nav-items.ts` en 7 entrées de
premier niveau (3 dépliables), sur le modèle de la direction mockup
"1a — Agritech Premium" (`docs/design/`, référence design system Phase
10). Frontend uniquement, aucune route/permission ajoutée ou retirée —
détail du nouveau modèle de données et de la sidebar dans "✅ Corrigé"
ci-dessous ; voir aussi la mise à jour de l'entrée Phase 13 ci-dessus
pour la dette mobile associée, restée entière.

- **"Santé" et "Ventes" du mockup n'ont pas de route dédiée — restent
  dans leur module d'origine, pas d'entrée de menu séparée.** Le mockup
  liste "Santé" et "Ventes" comme des catégories de premier niveau au
  même titre qu'"Élevage"/"Stocks"/"Achats", mais aucune des deux n'a de
  page autonome dans le code réel : "Ventes" est un sous-écran
  `.../[id]/vendre` dans chaque module (`poulets-chair`, `pondeuses`,
  `poussins`, `points-eau`) ; "Santé" est un onglet CRUD complet
  (`value="sante"`, `HealthEventTable`/`-form`/`-create-dialog`) dans la
  page de détail de bande, confirmé sur `poulets-chair/[id]/
  broiler-batch-detail-view.tsx` et `pondeuses/[id]/
  layer-batch-detail-view.tsx`, absent des 4 autres modules d'élevage
  (Reproducteurs/Couveuses/Couvoir/Poussins). Dans les deux cas, créer
  une entrée de menu de haut niveau aurait nécessité soit une page
  qui n'existe pas, soit un lien contextuel sans `[id]` cible fixe —
  hors périmètre d'une phase de réorganisation pure ("aucune nouvelle
  route"). "Personnel" et "Rapports", également présents dans le
  mockup, sont dans le même cas mais explicitement exclus dès le
  cadrage de cette phase (aucun module réel derrière).

## Personnel — Lot 1 (fondation de données)

Modèles Prisma `Employee`/`Attendance`/`EmployeeTask`/`Payroll`/
`SalaryAdvance` (migration `20260830171702_add_personnel_module`) —
**extension de périmètre assumée par le porteur de projet le
2026-08-30**, au-delà des cahiers V1/V5/V6 : la V5 (§17 "Hors périmètre
et feuille de route V6") liste explicitement "Paie complète et
comptabilité générale réglementaire" comme non prévue, aux côtés de la
maintenance préventive (depuis construite en V6) et des prévisions IA
(pas encore construites) ; le cahier V6 ne mentionne le Personnel nulle
part. Fondation de données uniquement, aucun code applicatif (DTO,
service, contrôleur, permission RBAC) — voir le commentaire en tête de
section dans `schema.prisma`.

- **Aucune couche de contrôle sur ces 5 tables pour l'instant** —
  normal et attendu à ce stade (rien n'est exposé, aucun endpoint
  n'existe), mais à ne pas oublier : le principe non négociable "RBAC
  vérifié en back-end" (CLAUDE.md) s'appliquera dès le premier lot qui
  expose un contrôleur, pas seulement au moment de câbler le frontend.
- **`Employee.code` (matricule) sans générateur** — même situation que
  `BroilerBatch.code`/`Asset.code` à leur création : le champ existe,
  la logique de génération (format, ex. `EMP-AAAA-NNN`) revient à un
  lot applicatif ultérieur.
- **`Payroll.status` volontairement minimal (BROUILLON/VALIDE)** —
  aucun lien vers `Payment`/`Expense` pour le suivi du paiement effectif
  du bulletin. Le cahier V1 §8.5 liste déjà "Personnel" comme catégorie
  de dépense existante (texte libre sur `Expense.category`) — réutiliser
  ce mécanisme plutôt qu'en inventer un nouveau est l'option la plus
  probable, mais non tranchée : décision différée à un lot applicatif
  dédié plutôt que présumée dans ce lot schéma-only.

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

### Bouton "Modifier" accessible sur un lot déjà terminal — Select statut vide, enregistrement bloqué silencieusement (Broiler Phase 11, Pondeuses Phase 12 — trouvé et corrigé en Phase 12)

**Trouvé en vérification manuelle de cette phase** (clôture d'un lot de
pondeuses de test, puis navigation directe vers `modifier/` pour vérifier
le garde-fou de statut) : le bouton "Modifier" de la fiche n'a jamais été
conditionné à un statut non terminal — seul "Clôturer" l'était
(`canCloseBatch`). Conséquence concrète : sur un lot déjà `CLOTURE`/
`ANNULEE` (Pondeuses) ou `CLOTUREE`/`ANNULEE` (Chair), le formulaire de
modification restait accessible, mais son `<Select>` statut (restreint aux
valeurs "libres" — voir catégorie transversale ci-dessus) n'a aucune
option correspondant à la valeur réelle du lot : le champ s'affiche vide,
`zodResolver` rejette `status` à la soumission, et **rien ne se passe** au
clic sur "Enregistrer" — pas de message d'erreur visible sous le champ (ce
champ n'avait pas d'affichage `errors.status`), aucune navigation, aucun
toast. Un cul-de-sac silencieux, reproductible pour n'importe quel champ
du formulaire (même une simple correction d'observation), pas seulement le
statut.

**Corrigé immédiatement plutôt que documenté seul** (même raisonnement que
`PaymentsService`/Phase 7 et `OrientationService`/Phase 5 ci-dessus : cause
simple, correctif sûr et purement additif) : le bouton "Modifier" est
désormais gardé par la même condition que "Clôturer" (`isBatchOpen =
status !== 'CLOTURE(E)' && status !== 'ANNULEE'`), sur les deux fiches
(`layer-batch-detail-view.tsx` — code neuf de cette phase — et
`broiler-batch-detail-view.tsx` — code Phase 11 déjà mergé, corrigé ici
car défaut identique trouvé par comparaison directe). Pas de refonte du
formulaire/schéma : la modification métier d'un lot déjà clôturé/annulé
n'a de toute façon aucun cas d'usage légitime identifié dans le cahier.

### `Select` Bâtiment/Responsable passant de non contrôlé à contrôlé — warning React sur les formulaires de création (Broiler Phase 11, Pondeuses Phase 12 — trouvé et corrigé en Phase 12)

**Trouvé en vérification manuelle** (console du navigateur, formulaire de
création d'un lot de pondeuses) : `CreateLayerBatchForm` n'initialisait pas
`buildingId`/`primaryManagerId` dans `defaultValues` — `field.value` valait
`undefined` au premier rendu (Select non contrôlé), puis devenait une
chaîne dès la première sélection (Select contrôlé), déclenchant
l'avertissement base-ui *"A component is changing the uncontrolled value
state of Select to be controlled"*. Vérifié : **même défaut préexistant
sur `CreateBroilerBatchForm`** (Phase 11, jamais remarqué faute de
vérification console dédiée à l'époque) — la fuite de scope pour aller le
corriger a été jugée justifiée ici car la cause et le correctif sont
identiques à la lettre, purement additifs (deux clés `''` de plus dans un
objet `defaultValues` déjà existant), et sans risque de régression.
Corrigé dans les deux fichiers (`layer-batch-form.tsx`,
`broiler-batch-form.tsx`) en initialisant ces deux champs à `''`. Les
formulaires d'édition (`Edit*BatchForm`) n'étaient pas concernés : leurs
`defaultValues` renseignent déjà `buildingId`/`primaryManagerId` depuis
l'entité chargée.

### `BatchAlertsWidget` mutualisé en `EntityAlertsWidget` — ferme le gap Broiler documenté depuis la Phase 11/12 (Phase 14)

Le widget d'alertes filtrées côté client par `entityId` n'existait que
sur la fiche Layer (Phase 12) — le plan Phase 11 (Chair) le prévoyait
explicitement mais ne l'avait jamais construit, gap documenté deux
phases de suite sans être corrigé. Extrait en
`components/shared/entity-alerts-widget.tsx` (prop renommée `batchId`→
`entityId`, corps identique) pour être réutilisé par Item et
PurchaseOrder (Phase 14) — 3 usages simultanés ont justifié la
mutualisation immédiate. Le gap Broiler a été fermé dans le même
mouvement (~3 lignes d'ajout une fois le composant généralisé) plutôt
que laissé en dette une 3e phase consécutive.

### `CreateStockMovementDto`/schéma frontend — `itemId` requis par le schéma Zod mais jamais rempli par le formulaire, échec de validation silencieux (trouvé et corrigé en Phase 14)

**Trouvé en vérification manuelle** (dialog "Nouveau mouvement" sur la
fiche d'un article, aucune requête réseau émise malgré un clic sur
"Enregistrer", aucune erreur visible). Cause : `createStockMovementSchema`
incluait `itemId: z.string().min(1)` par calque involontaire du DTO
backend (`CreateStockMovementDto.itemId`), alors que `StockMovementForm`
ne rend jamais de champ `itemId` — l'identifiant de l'article est connu
du contexte (prop du composant, `itemId` de la fiche déjà ouverte) et
injecté directement dans le payload final au moment de la soumission,
jamais géré par React Hook Form. La validation Zod échouait donc
systématiquement sur ce champ fantôme, sans qu'aucun message d'erreur
ne puisse s'afficher puisqu'aucun élément du JSX ne lui est associé —
échec silencieux total. Corrigé en retirant `itemId` du schéma
(`features/stock-movements/schemas.ts`) ; le composant l'injecte déjà
correctement dans `onSubmit`, aucun autre changement nécessaire.
Reproductible à coup sûr (pas un cas limite) : tout mouvement manuel
échouait avant ce correctif.

### `ExpenseForm` (création) — `date` sans valeur par défaut, contrairement à tous les autres formulaires du projet (trouvé et corrigé en Phase 14)

**Trouvé en vérification manuelle** (formulaire "Nouvelle dépense",
erreur "Date requise" affichée immédiatement après soumission malgré
un remplissage complet des autres champs). `CreateExpenseForm` était
le seul formulaire de tout le frontend à ne pas initialiser `date` via
`todayIsoDate()` dans `defaultValues` — un oubli d'inattention (le
patron `defaultValues: { date: todayIsoDate(), ... }` est répété à
l'identique dans une dizaine d'autres formulaires du projet). Corrigé
en ajoutant `date: todayIsoDate()` (helper local ajouté au fichier) aux
`defaultValues` de `CreateExpenseForm`. `EditExpenseForm` n'était pas
concerné (pré-rempli depuis l'entité chargée).

### Bouton "Vendre" (Chair) non gardé par `isBatchOpen` — trouvé par le bilan frontend, corrigé en Phase 15

`broiler-batch-detail-view.tsx` : le bouton "Vendre" n'était gardé que
par `Can permission={SALES_CREATE}`, contrairement à "Modifier"/
"Clôturer" (gardés par `isBatchOpen` depuis la Phase 12) — une bande
`CLOTUREE`/`ANNULEE` restait vendable depuis l'UI. Corrigé en
enveloppant le bouton dans `{isBatchOpen ? (...) : null}`, exactement le
même patron que les deux boutons voisins. Combiné à cette garde, le
risque théorique de `cancel()` sans contrôle d'effectif (voir section
Phase 15 ci-dessus, resté non corrigé côté backend) est désormais borné
côté UI : une bande annulée ne peut plus jamais afficher ce bouton.

### `extractMessage` — rollout sur les 14 derniers formulaires (21 blocs `catch`), Phase 15

Le bilan frontend a quantifié précisément la dette déjà pressentie :
seuls 14 formulaires sur 28 utilisaient le helper mutualisé
`extractMessage` (extrait en Phase 11), les 14 autres (`item-form`,
`expense-form`, `layer-batch-form`, `incubator-form`,
`chick-batch-form`, `broiler-batch-form`, `breeder-batch-form`,
`health-event-form` ×2 [Chair/Pondeuses], `closure-dialog` ×2
[Chair/Pondeuses], `water-point-form`, `mortality-form`,
`daily-record-form` [Chair]) affichaient un message générique fixe au
lieu du message métier réel renvoyé par l'API (409/400 avec le détail
d'une règle violée). Corrigé sur les 21 blocs `catch` concernés (certains
fichiers ont un formulaire Création + Édition), même patron partout :
`catch (err) { toast.error(err instanceof ApiError ? extractMessage(err.body, fallback) : fallback) }`.
Vérifié en conditions réelles (interception `fetch` renvoyant un 409
avec un message métier crafté sur `item-form.tsx`) : le message exact de
l'API s'affiche désormais, plus le message générique.

### KPI dashboard Ventes/Dépenses/Marge — ajoutés en Phase 15

Le dashboard n'affichait aucun KPI Ventes/Dépenses/Marge malgré des
modules Ventes/Dépenses complets ailleurs dans l'app — écart avec
`docs/reference/TABLEAU_DE_BORD.md` signalé par le bilan frontend.
Corrigé : `TreasuryKpis()` (`app/(app)/page.tsx`) consomme
`useTreasurySummary(from, to)` (déjà existant, même endpoint et même clé
de cache React Query que la page Trésorerie), période fixe "mois
courant → aujourd'hui", **un seul GET supplémentaire**, gaté
`TREASURY_READ` comme `PayablesKpi`. Vérifié en conditions réelles
(données du farm de test : Ventes 413 000 FCFA, Dépenses 0 FCFA, Marge
brute 413 000 FCFA, cohérent avec `GET /treasury/summary`).

### Colonnes Date d'arrivée et Bâtiment — liste des bandes Chair, Phase 15

`broiler-batch-table.tsx` n'affichait que 5 colonnes sur les 13 du §4.2
du cahier. Ajout de 2 colonnes à coût nul : Date d'arrivée (déjà dans
`BroilerBatchWithComputed.arrivalDate`) et Bâtiment (résolu via
`useBuildings()`, même patron `Map` que `useUsers()` déjà utilisé dans
ce fichier). Le rôle Vendeur/Caisse a `BROILER_BATCHES_READ` mais pas
`BUILDINGS_READ` (`roles.catalog.ts`) — géré par un fallback gracieux
(`isError` sur `useBuildings()` → `—` plutôt qu'un 403 silencieux),
même patron que `SupplierField` (`broiler-batch-form.tsx`). Les 11
colonnes restantes du §4.2 nécessiteraient un agrégat serveur par bande
(N+1) — non ajoutées, voir section Phase 15 ci-dessus.

### 4 nouveaux fichiers de test — fonctions pures + schéma Eau, Phase 15

Candidats identifiés par le bilan frontend comme faciles à tester
(fonctions pures, pas de DOM, risque de divergence avec le backend) :
`features/broiler-batches/day-number.test.ts` (`computeDayNumber`/
`isDayNumberInCycle`), `features/layer-batches/hen-count.test.ts`
(`computeSuggestedHenCount`, réplique une formule backend),
`features/layer-batches/age.test.ts` (`computeCurrentAgeWeeks`). Un
4ᵉ candidat non anticipé dans le plan initial, trouvé pendant la revue :
`features/water-points/schemas.test.ts` — le module Eau n'a aucune
fonction pure extraite (0 fichier de test avant cette phase, confirmé
par le bilan), mais `createWaterReadingSchema.superRefine` (le seul
contrôle du §7.3 réellement dupliqué côté client) est testable via
`.safeParse()` à coût quasi nul. 4 fichiers, exécutés avec succès.

**Correction (Phase 19)** : la note ci-dessus recommandant
`--pool=forks` était erronée/obsolète — `apps/web/vitest.config.mts`
utilise `pool: 'threads'` (le défaut Vitest) et fonctionne de façon
fiable sur cette même machine Windows, reconfirmé à froid en Phase 19
(16 fichiers, 68/68 tests). Signalée comme contradictoire par l'agent de
revue du plan Phase 19 ; aucune trace du timeout de démarrage de worker
décrit initialement n'a pu être reproduite.

### Nettoyage `afterAll` non protégé contre un `app.close()` jamais exécuté — généralisé en helper partagé (`closeAppSafely`), Phase 16

**Deuxième occurrence indépendante d'un même bug** : Phase 8
(`treasury.e2e-spec.ts`, incident CI) avait déjà été corrigée localement
par un `try/finally` inline autour de `app.close()`, mais la leçon
n'avait jamais été généralisée aux 10 autres fichiers e2e. Redécouverte
indépendamment en Phase 16 (`assets.e2e-spec.ts`) : deux appels à
`createActiveUser()` déstructuraient `{ email }` sans capturer `id`,
laissant deux `User` orphelins référençant `farmId` — `prisma.farm.
deleteMany()` dans `afterAll` levait alors une violation de contrainte
FK. Comme `app.close()` était la dernière ligne du bloc (pas dans un
`finally`), cette exception l'empêchait de jamais s'exécuter :
l'application Nest de test restait vivante indéfiniment (connexion
Prisma ouverte + crons `ScheduleModule` actifs, dont
`AssetsAlertsCronService`), bloquant Jest en silence — **plus de 3
heures**, sans le moindre message d'erreur visible (la commande initiale
pipait la sortie dans `| tail -150`, qui n'affiche qu'après EOF).

Diagnostic mené sans corriger à l'aveugle : `information_schema.
innodb_trx` et `SHOW FULL PROCESSLIST` vérifiés en premier (aucune
transaction ni verrou actif — la transaction de génération du plan
d'amortissement, C.2, initialement suspectée, a été innocentée par
preuve directe : les 13 tests passent en ~20 s en isolation). La cause
réelle était entièrement côté infrastructure de test, pas dans le code
applicatif livré cette phase.

**Corrigé et généralisé** : nouveau helper `closeAppSafely(app,
cleanup)` dans `apps/api/test/helpers/e2e-test-utils.ts`
(`try { await cleanup() } finally { await app.close() }`), documenté
comme standard obligatoire pour tout nouveau fichier e2e directement
dans son docstring (colocalisé avec le code que chaque fichier importe
déjà, plutôt qu'un document de convention séparé à maintenir en plus).
Appliqué aux 11 fichiers ayant un nettoyage `afterAll` réel :
`assets`, `treasury` (conversion de leur `try/finally` inline existant
vers le helper partagé, pour une seule implémentation canonique),
`alerts-notifications`, `auth-rbac`, `broiler-batches`, `documents`,
`incubation-batches`, `items-stock`, `layer-batches`,
`suppliers-customers`, `water-points`. `app.e2e-spec.ts` volontairement
non touché (`afterEach` trivial, aucune écriture Prisma, rien qui
puisse lever avant `app.close()`). Suite e2e complète rejouée à froid
après généralisation : **12/12 suites, 155/155 tests, 39,8 s, aucun
processus résiduel**.

### Bug source — `createActiveUser()` avec `id` non capturé dans `assets.e2e-spec.ts` (Phase 16)

Corrigé en parallèle de la généralisation ci-dessus : les deux appels
(test d'isolation multi-tenant, `beforeAll` du bloc RBAC Comptable)
capturent désormais `{ id, email }` et poussent `id` dans
`createdUserIds`, fermant la fuite qui causait la violation de
contrainte FK à l'origine de l'incident.

### `WaterInfrastructureReading` — `farmInternalConsumptionM3` manquant côté type frontend (Phase 18, corrigé en Phase 19)

`packages/shared-types/src/infrastructure.ts` omettait ce champ sur le
type de sortie `WaterInfrastructureReading` alors que l'API le retourne
bien (présent depuis l'origine sur `CreateWaterInfrastructureReadingInput`/
`UpdateWaterInfrastructureReadingInput` du même fichier, et sur le
`return {...reading, soldVolumeM3, gapM3}` du service). Trouvé par
l'agent de recherche backend du plan Phase 19 avant l'écriture de toute
UI consommatrice — corrigé en premier, avant `WaterReadingTable`
(onglet Eau de la fiche Actif).

### `Expense.assetId` exposé côté backend depuis la Phase 16, jamais exposé côté formulaire Dépenses (corrigé en Phase 19)

`Expense.assetId` existe côté API/`shared-types` depuis la Phase 16
(alimente `AssetsService.attachComputed().tcoFcfa`) mais
`expense-form.tsx`/`schemas.ts` n'exposaient que 6 types de
rattachement (CHAIR/PONDEUSES/POUSSINS/REPRODUCTEURS/COUVOIR/EAU) —
"Actif" en était absent, rendant le TCO structurellement incomplet pour
toute dépense manuelle (assurance, facture externe) non passée par une
`MaintenanceIntervention`. Trouvé par l'agent de challenge du plan
Phase 19 (hors périmètre initial de la mission) ; ajouté comme 7ᵉ cas
au sélecteur local `EntityRefSelect` déjà existant dans ce même fichier
(pas de nouveau composant partagé), actifs `REFORME` exclus de la liste
proposée.

### Concurrence `MaintenanceTask` — 7e occurrence du défaut "vérification sans verrou" déjà corrigé 6 fois en Phase 8 (bilan V6, corrigé en Phase 20)

`MaintenanceTasksService.markRealizedInTransaction` et `cancel()`
lisaient le statut de la tâche sans verrou avant d'écrire —
contrairement à `MaintenanceTaskGenerationService.
ensureNextTaskGenerated` (même module, déjà protégé depuis la Phase 17).
Scénario concret : deux interventions concurrentes sur la même tâche
pouvaient toutes deux passer la garde de statut terminal, dupliquant
coût imputé et sortie de stock pour un seul événement métier.

**Correction retenue** — même patron déjà validé 6 fois sur ce projet
(`StockMovementsService.recordMovementInTransaction`,
`MaintenanceTaskGenerationService.ensureNextTaskGenerated`, etc.) :
nouvelle méthode privée `lockAndAssertTaskOpenInTransaction(tx,
taskId)` (`SELECT ... FOR UPDATE` en raw SQL sur `maintenance_tasks`,
sans filtre `farmId` — la validation farm est déjà faite par
l'appelant avant l'ouverture de la transaction, contrat identique à
l'ancien `markRealizedInTransaction`), appelée en tout début de
transaction par `markRealizedInTransaction` et `cancel()`. Retry P2034
gardé par cohérence de style avec le reste du projet — **pas une
nécessité technique stricte ici** : un verrou sur une seule ligne (clé
primaire) ne peut pas produire de deadlock à lui seul, une transaction
concurrente attend simplement la libération du verrou plutôt que
d'être avortée (confirmé par le comportement déjà en production de
`ensureNextTaskGenerated`, qui n'a jamais eu de retry).

**Gap préexistant corrigé dans le même mouvement** :
`MaintenanceInterventionsService.create()` verrouille déjà `Item` par
pièce (`recordMovementInTransaction`, boucle sur `dto.parts`) **sans
aucun retry P2034**, contrairement à `StockMovementsService.create()`
qui a ce filet depuis la Phase 7 pour le même type de verrouillage —
gap indépendant de la concurrence `MaintenanceTask` elle-même,
découvert en ajoutant le nouveau verrou dans cette même transaction.
Corrigé en même temps (boucle retry standard ajoutée autour de
l'ensemble de la transaction de création).

**2 tests de concurrence dédiés** (`Promise.all` sur deux requêtes HTTP
identiques, `[201,409]` attendu, état final vérifié cohérent — même
gabarit que Phase 8) : deux interventions concurrentes sur la même
tâche (une seule aboutit, stock/coût jamais dupliqués) ; une annulation
concurrente à une intervention sur la même tâche (état final soit
`REALISEE`+1 intervention, soit `ANNULEE`+0 intervention, jamais les
deux). **Exécutés avec succès après correction du blocage e2e transversal
(voir entrée dédiée ci-dessous)** — 5 exécutions consécutives, aucun
flake.

**Second correctif découvert en les exécutant pour de vrai** : le
premier des deux tests échouait `[201,500]` au lieu de `[201,409]` — un
vrai deadlock MySQL (code 1213 "Deadlock found") survenant dans
`StockMovementsService.recordMovementInTransaction` (verrouillage
`Item` via `$queryRaw`), remonté par Prisma sous le code générique
**P2010** ("Raw query failed"), jamais **P2034** — `isSerializationFailure`
ne le rattrapait donc pas, le retry ne se déclenchait jamais. Le vrai
code MySQL (1213 deadlock / 1205 lock wait timeout) est niché dans
`error.meta.driverAdapterError.cause.originalCode`, jamais exposé
directement. Corrigé dans les 3 nouvelles fonctions
`isSerializationFailure` de cette phase (`maintenance-interventions.
service.ts`, `maintenance-tasks.service.ts`, `assets.service.ts`) —
reconnaissent désormais P2034 ET (P2010 avec code MySQL 1213/1205).
**Risque transversal non corrigé ailleurs** : les 5 occurrences
préexistantes du couple `MAX_TRANSACTION_RETRIES`/`isSerializationFailure`
(`egg-stock`, `orientation`, `incubation-batches`, `sales`,
`stock-movements`) ne reconnaissent que P2034 — aucune n'a été prouvée
défaillante par un test réel à ce jour, mais le même angle mort
structurel s'y trouve probablement dès que leur transaction contient un
`$queryRaw` verrouillé. Non corrigé cette phase (hors périmètre —
aucune de ces 5 méthodes n'est touchée par le durcissement V6), à
vérifier si un incident similaire y survient.

Voir `maintenance-tasks.service.ts`, `maintenance-interventions.service.ts`,
`maintenance.e2e-spec.ts`.

### Prorata temporis rendu paramétrable via `Setting` — verrou technique de configuration levé, validation comptable toujours en attente (bilan V6, Phase 20)

Le modèle de calendrier fiscal (Phase 16, voir puce correspondante sous
`## Phase 16` ci-dessus) était figé dans le code — tout ajustement
aurait exigé un redéploiement. Désormais paramétrable par ferme via
`Setting{key:'assets.depreciation_convention'}`, sans migration Prisma
(`Setting.value: Json` déjà générique) : `computeDepreciationSchedule`
accepte un 5e paramètre optionnel `convention: 'CALENDAIRE' |
'TRENTE_360'` (défaut `'CALENDAIRE'`, comportement historique strictement
inchangé — les 13 tests existants passent sans modification).
`'TRENTE_360'` = convention 30E/360 (chaque mois compté 30 jours, année
360 jours, indépendante des années bissextiles), appliquée uniquement à
la proratisation de la première période (les années pleines restent une
dotation annuelle fixe, aucun day-count). Cas limite explicitement
tranché et testé : une mise en service au 31 décembre produit la
dotation minimale non nulle possible (1/360e), jamais 0 — comportement
assumé, pas un sous-produit accidentel de la formule. `AssetsService.
create()` lit le `Setting` de la ferme avant de générer le plan
(fallback `'CALENDAIRE'` si absent ou si la valeur ne correspond pas
exactement à l'énumération connue). **Aucun contrôleur Settings
n'existe nulle part dans le projet** — configurable uniquement en base
(seed/support) pour l'instant, même précédent exact que tous les autres
`Setting` du projet (ex. `assets.warranty_expiring_days`).

**Ce qui reste ouvert, sans ambiguïté** : la validation par un
comptable local du modèle retenu (ni `CALENDAIRE` ni `TRENTE_360` n'a
été confirmé contre une pratique comptable réelle) — ce correctif lève
le blocage technique de configuration, pas la question de fond. Reste
"meilleure hypothèse documentée" jusqu'à cette validation.

**~8 nouveaux tests unitaires** (`depreciation.calculations.spec.ts`) :
alignement début/milieu/fin de mois, cas limite 31 décembre,
indépendance aux années bissextiles, cohérence de la somme des
dotations sur un cas peu divisible.

Voir `depreciation.calculations.ts`, `depreciation.calculations.spec.ts`,
`assets.service.ts`.

### 3 correctifs mineurs Patrimoine (bilan V6, corrigés en Phase 20)

- **`AssetsService.remove()` omettait `MaintenancePlan`** dans son
  garde-fou de suppression (vérifiait `Expense`/`MaintenanceTask`/
  `MaintenanceIntervention`/3 relevés infra, jamais `MaintenancePlan`
  directement) — un plan pouvait exister avec 0 tâche active (tâches
  supprimables individuellement sans garde sur le plan parent), la
  contrainte `ON DELETE RESTRICT` sur `MaintenancePlan.assetId` levait
  alors une erreur SQL brute (P2003) non interceptée au lieu du 409
  propre attendu. Corrigé : `maintenancePlan.count()` ajouté au bloc de
  garde déjà existant.
- **`AssetsService.reform()` non protégé contre le double-appel
  concurrent** — même famille que la concurrence `MaintenanceTask`
  ci-dessus. Corrigé : verrou `SELECT ... FOR UPDATE` sur `assets` (même
  patron), retry P2034 par cohérence de style (même nuance : pas une
  nécessité technique stricte pour un verrou mono-ligne). **1 test de
  concurrence dédié** (`assets.e2e-spec.ts`, exécuté avec succès — voir
  entrée dédiée au blocage e2e ci-dessous) : deux réformes simultanées
  sur le même actif → `[201,409]`, un seul enregistrement d'audit
  `ASSET_REFORMED`.
- **Aucune validation croisée de dates sur Asset** — `reformDate`/
  `warrantyExpiresAt` pouvaient être antérieures à `purchaseDate`/
  `serviceDate` sans erreur, ni backend ni frontend. Corrigé côté
  backend (le seul touché cette phase) : `reformDate >= serviceDate`
  dans `reform()`, `warrantyExpiresAt >= purchaseDate` dans `create()`
  et `update()` (au niveau service, pas DTO — `UpdateAssetDto` n'a pas
  de champ `purchaseDate`, immuable après création, la comparaison se
  fait contre `existing.purchaseDate`).

Voir `assets.service.ts`, `assets.e2e-spec.ts`.

### Blocage transversal — connexion MySQL, `caching_sha2_password` sans `allowPublicKeyRetrieval` (corrigé en Phase 20, mal diagnostiqué une première fois)

**Cause réelle du blocage e2e documenté plus haut sous "Phase 20" — et,
plus grave, de l'erreur "Internal server error" au login en usage réel
(`POST /api/v1/auth/connexion`)**, tous deux le même symptôme de
surface : `PrismaClientKnownRequestError` code `45028`, "pool timeout...
pool connections: active=0 idle=0", sur la toute première requête
Prisma de chaque nouvelle instance d'app (tests, mais aussi le
conteneur `dondy-elevage-api` en usage normal). Le diagnostic initial
(section "Phase 20" ci-dessus, avant correction) attribuait ce
symptôme au compilateur WASM de Prisma — **faux**, découvert en
creusant le champ `cause` imbriqué de l'erreur réelle, remonté dans les
logs du conteneur API (`docker logs dondy-elevage-api`) lors du rapport
de bug utilisateur sur le login :

```
cause: '(conn:25, no: 45044, SQLState: 08S01) RSA public key is not
available client side. Either set option `cachingRsaPublicKey` to
indicate public key path, or allow public key retrieval with option
`allowPublicKeyRetrieval`'
```

`dondy_user` utilise le plugin d'authentification `caching_sha2_password`
(défaut de l'image `mysql:8.4` depuis MySQL 8.0), qui exige soit TLS,
soit `allowPublicKeyRetrieval=true` côté client pour l'échange de clé
RSA lors de la première connexion d'une session. Aucune des `DATABASE_URL`
du projet ne portait ce paramètre — chaque tentative de connexion
échouait silencieusement à l'authentification, jamais restituée au
pool, jusqu'au timeout (d'où "pool timeout" en symptôme de surface,
sans rapport apparent avec l'authentification).

**Corrigé** : `?allowPublicKeyRetrieval=true` ajouté aux 4
`DATABASE_URL` du projet (`docker-compose.dev.yml` — la valeur
réellement utilisée par le conteneur `api` — ainsi que `.env`/`.env.example`
à la racine et dans `apps/api/`, pour rester cohérents même si non
directement consommés par le conteneur). **Dev uniquement, documenté
explicitement comme tel dans chaque commentaire** — en production, une
vraie configuration TLS remplace ce paramètre, jamais l'inverse.
Vérifié en conditions réelles après correction : `POST /api/v1/auth/
connexion` répond `200` avec un JWT valide (login réel via le navigateur,
session authentifiée jusqu'au tableau de bord), et la suite e2e complète
(189/189 tests, 14 fichiers) s'exécute désormais sans aucun blocage.

Voir `docker/docker-compose.dev.yml`, `.env.example`, `apps/api/.env.example`.

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
