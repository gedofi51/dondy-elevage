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

## 🔴 Dette transversale (priorité — plusieurs modules concernés)

### Vérification de disponibilité sans verrou (survente concurrente possible)

**Statut : ouvert, non corrigé.** Occurrences connues à ce jour :

| Origine | Emplacement | Nature |
|---|---|---|
| Phase 3 | `SalesService.create()` / `.update()`, branche `POULET_CHAIR` | Lecture de `BroilerBatch.currentHeadcount` (agrégation Prisma) puis comparaison à la quantité vendue — aucune transaction, aucun verrou. |
| Phase 5 | `IncubationBatchesService` (validation `eggCount <= availableFertileEggs`), `OrientationService` (validation poussins disponibles = `chicksHatched - SUM(BatchLineage.quantity)`) | Même schéma exact : lecture agrégée puis comparaison, sans verrou. |

**Pourquoi regrouper ces deux occurrences plutôt que les traiter comme deux
mentions isolées** : c'est le même défaut structurel, reproduit
délibérément à l'identique en Phase 5 (voir plan Phase 5, section
"Concurrence") plutôt que corrigé au passage — corriger silencieusement du
code Phase 3 non sollicité aurait été hors périmètre de cette phase-là, et
inventer un nouveau mécanisme de protection uniquement pour Phase 5 aurait
créé une incohérence (deux standards différents pour le même type de
problème selon le module). Le bon niveau de correction est donc un
**chantier de durcissement transversal unique**, pas des correctifs
dispersés module par module.

**Ce qui existe déjà et qu'un futur chantier peut réutiliser tel quel** :
Phase 4 a rencontré ce même type de risque pour la consommation FIFO du
stock d'œufs (`EggStockService.consumeFifoInternal`) et l'a résolu avec un
verrouillage SQL `SELECT ... FOR UPDATE` sous l'isolation par défaut
(REPEATABLE READ) — voir le commentaire d'historique détaillé directement
dans ce fichier, qui documente aussi une tentative écartée
(`isolationLevel: Serializable`, a produit un blocage indéfini reproduit en
e2e, cause confirmée : bug amont non résolu de `@prisma/adapter-mariadb`
7.9.1, [prisma/prisma#28964](https://github.com/prisma/prisma/issues/28964)).
**Ne pas retenter Serializable** pour ce chantier — `FOR UPDATE` est le
pattern validé et éprouvé sur ce projet.

**Pourquoi ce n'est pas bloquant à ce jour** : les points concernés sont
des actions ponctuelles/rares dans l'usage réel (une vente de poulets n'est
pas un flux à très haute fréquence comparé aux ventes d'œufs déjà
protégées ; la création d'un lot d'incubation ou une orientation de
poussins sont des événements de l'ordre de quelques-uns par mois). Le
risque est réel mais improbable en usage normal — à traiter avant toute
montée en charge significative ou avant l'ouverture d'un accès multi-
utilisateurs simultanés élargi sur ces modules précis.

**Action future recommandée** : un chantier dédié qui reprend `FOR UPDATE`
sur les trois points listés ci-dessus en une seule passe cohérente, avec sa
propre suite de tests de concurrence réelle (pattern déjà établi en
Phase 4 : `Promise.all` sur deux requêtes simultanées, pas seulement
séquentielles).

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
- **`test:e2e` non intégré à la CI** (pas de MySQL provisionné dans le
  pipeline GitHub Actions) — reste une vérification manuelle locale à
  chaque phase, à froid, avant chaque push.
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

- **Vérification de disponibilité `SalesService`/`POULET_CHAIR` sans
  verrou** — voir "Dette transversale" en tête de ce document.
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

- **Vérification de disponibilité `IncubationBatch`/`OrientationService`
  sans verrou** — voir "Dette transversale" en tête de ce document (même
  point que Phase 3, reconduit délibérément, pas un nouveau gap).
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

## ✅ Corrigé

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
  est en réalité la ré-occurrence d'une dette déjà connue (comme le point
  transversal ci-dessus) plutôt qu'une nouveauté — le documenter comme tel
  ici plutôt que comme une mention isolée dans la seule PR de la phase.
- **En début de mission** : consulter la section "Dette transversale" pour
  savoir si le périmètre de la nouvelle phase touche un point déjà connu et
  mérite d'être traité (ou explicitement reporté, avec justification) plutôt
  que redécouvert à zéro.
- **Une fois un point corrigé** : le déplacer dans la section "✅ Corrigé"
  ci-dessus, avec le commit/PR de correction en référence — jamais de
  suppression silencieuse d'un point qui a réellement existé.
