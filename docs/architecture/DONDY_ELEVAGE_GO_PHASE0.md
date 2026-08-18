# DONDY ELEVAGE — Synthèse consolidée & GO Claude Code Phase 0

Document produit après lecture intégrale des cahiers des charges V1, V5, V6 et analyse du logo officiel.
Règle de résolution des conflits appliquée : **V6 > V5 > V1**, sauf lorsqu'une version antérieure apporte un niveau de détail non contredit par la suivante (auquel cas ce détail est conservé).

---

## A. Synthèse fonctionnelle consolidée

Le périmètre final est **cumulatif V1 → V6**. Rien n'est retiré d'une version à l'autre ; chaque version ajoute une couche.

| Bloc | Contenu consolidé |
|---|---|
| **Socle** | Farms (multi-tenant via `farmId`), Users, Roles/RBAC, Buildings, Suppliers, Customers, Documents, Alerts, AuditLogs, Notifications, Settings |
| **V1 — Chair** | Bandes PC-AAAA-NNN, cycle J1→J45 (démarrage/croissance/finition), suivi quotidien (aliment, eau, mortalité, poids, santé, comportement, température/humidité), calculs (effectif vivant, taux mortalité, GMQ, IC), alertes calendaires J1/J7/J14/J15/J21/J30/J31/J35/J40/J42/J44/J45/J46+, module santé (vaccination/traitement), commercial (clients, ventes multi-lignes, paiements multi-modes, sortie auto d'effectif), clôture + rentabilité |
| **V2 — Pondeuses** | Lots PON-AAAA-NNN, suivi journalier (œufs pondus/cassés/sales/commercialisables), taux de ponte, stock d'œufs avec calibres/plateaux/FIFO, alertes ponte |
| **V3 — Reproduction/Couvoir** | Lots REP-AAAA-NNN, œufs fécondés, lots d'incubation INC-AAAA-NNN, mirage, éclosion, KPI couvoir (taux éclosion/fécondité/mortalité embryonnaire), filiation `batch_lineage` (reproducteur → œufs → incubation → poussins → chair/renouvellement/vente), alertes couvoir |
| **V4 — Eau (vente)** | Points d'eau, compteurs, relevés matin/soir, contrôles de cohérence d'index, clients comptoir/identifiés, KPI eau (volume, CA théorique/encaissé, écarts) |
| **V5 — Stocks/Achats/Finances** | Catalogue articles, stock multi-magasin (CUMP), mouvements automatiques inter-modules, achats/fournisseurs (Brouillon→Commandé→Partiellement reçu→Reçu→Annulé), dépenses/recettes par entité, trésorerie, rentabilité analytique par bande/lot/couvoir/point d'eau/ferme, dashboard global, RBAC étendu (9 rôles), rapports/exports PDF/XLSX/CSV |
| **V6 — Ferme connectée** | Patrimoine & amortissements (assets, méthode linéaire prorata temporis, VNC, TCO), maintenance (préventive/corrective/conditionnelle liée au stock V5), autonomie solaire, autonomie eau (forage — **infrastructure**, distinct du module vente d'eau V4), Internet/Starlink en patrimoine + abonnement récurrent, IoT (capteurs, seuils, alertes sur durée pour éviter faux positifs), QR Codes (accès direct fiche), planning opérationnel (tasks/task_assignments), prévisions (stocks/production/finance), IA (détection anomalies, Assistant DONDY conversationnel, score de performance paramétrable), offline-first avec gestion de conflits sans écrasement silencieux, rapports automatiques étendus, continuité d'activité (sauvegardes PostgreSQL, tests de restauration) |

**Principe directeur transversal (constant sur les 3 versions)** : une donnée saisie une seule fois alimente automatiquement calculs, stocks, alertes, prévisions et rapports concernés — jamais de double saisie.

---

## B. Ambiguïtés et contradictions à signaler avant développement

1. **SGBD : PostgreSQL vs MySQL.** Les cahiers des charges V5/V6 mentionnent explicitement PostgreSQL (architecture cible V6, continuité d'activité §16 « Sauvegardes automatiques PostgreSQL »). Or `BASE_DE-DONNEES.md` et `OBJECTIF_PRODUIT.md` (fichiers projet, qui priment comme instructions opérationnelles) imposent **MySQL + Prisma**. → **Décision retenue : MySQL + Prisma**, conformément aux fichiers projet, qui sont la source de vérité technique pour le développement. Le cahier des charges V6 fixe le *fonctionnel*, pas l'implémentation SGBD. Point à faire valider explicitement par le porteur de projet.
2. **Vente d'eau (V4) vs infrastructure eau/forage (V6).** Deux notions distinctes à ne pas fusionner : V4 = activité commerciale (vente aux riverains, `water_points/water_meters/water_sales`), V6 = infrastructure de production (`water_installations`, forage/pompe/réservoir en tant qu'actif patrimonial avec maintenance). L'équation de contrôle V6 (« eau produite = consommation ferme + eau vendue + pertes ») relie les deux modules : `WaterInfrastructure` doit référencer `WaterSales` en lecture, sans dupliquer les entités.
3. **Durée d'incubation.** V5 indique « environ 21 jours pour poule, paramétrable » — à garder configurable par espèce/souche plutôt que codé en dur.
4. **Cycle chair 45 jours.** Valeur par défaut confirmée par les 3 versions et par `MODULE_ELEVAGE.md` — donnée paramétrable par ferme, pas une constante applicative.
5. **Granularité des rôles.** V5 §11 liste 9 rôles métier détaillés (Administrateur, Gérant, Responsable élevage, Responsable couvoir, Responsable eau, Magasinier, Vendeur/caisse, Comptable, Lecteur). `UTILISATEURS_ET_AUTORISATIONS.md` liste 8 rôles plus génériques (Super Admin, Propriétaire, Responsable ferme, Responsable élevage, Responsable stocks, Responsable financier, Employé, Lecture seule). → à fusionner en un référentiel de rôles unique dès Phase 1 (RBAC piloté par table `roles`/`permissions`, pas par enum figé, pour absorber les deux listes sans re-développement).
6. **Authentification.** Les fichiers projet et le cahier des charges convergent (JWT + Refresh + OAuth Google/Microsoft + 2FA) — aucune contradiction, mais point lourd à ne pas sous-estimer en Phase 1.
7. **PDF sources dégradées.** Le plan de prophylaxie fourni est explicitement une reconstitution documentaire à valider par un vétérinaire avant toute utilisation en production — il servira de **données de référence paramétrables** (table `vaccination_plans`), jamais codées en dur, et un avertissement doit apparaître dans l'UI avant application.

Aucune de ces ambiguïtés ne bloque le démarrage de la Phase 0 (fondations techniques) ; elles devront être tranchées avant les Phases métier concernées (1 pour les rôles, 3 pour le cycle chair, 6 pour V4, 8 pour V6).

---

## C. Analyse du logo et palette UI officielle

Logo : cercle beige/crème avec bordure vert foncé et motifs géométriques terre/ocre inspirés de tissus africains ; scène centrale (arbre, ferme, silo à eau, soleil orange, coq blanc/noir, poule grise/noire, poussin jaune, œufs) ; typographie noire épaisse « DONDY », sous-titre ocre « ÉLEVAGE », baseline verte « LE GOÛT DE NOTRE PAYS ».

Tonalité : rustique, chaleureuse, ancrée dans le terroir centrafricain, contraste fort noir/crème avec accents verts et terracotta. Directement transposable en palette UI sobre et professionnelle sans dénaturer l'identité.

| Token | Valeur | Usage |
|---|---|---|
| `primary` | `#2D4A2E` (vert forêt du bord/toit) | Actions principales, sidebar, liens actifs |
| `primary-foreground` | `#F5F0E1` | Texte sur fond primary |
| `secondary` | `#8B4513` / `#A0522D` (terracotta des motifs) | Boutons secondaires, badges catégories |
| `accent` | `#E8891D` (orange du soleil) | Highlights, CTA ponctuels, indicateurs positifs de progression |
| `background` | `#FAF7EF` (crème du fond logo) | Fond général clair |
| `foreground` | `#1A1A1A` (noir du texte DONDY) | Texte principal |
| `muted` | `#E8E1D0` | Fonds de cartes secondaires, séparateurs |
| `border` | `#D8CFB8` | Bordures, inputs |
| `success` | `#3F7A3E` (vert proche du primary, plus clair) | Stock normal, statut OK |
| `warning` | `#E8891D` (orange) | Stock faible, alerte ATTENTION |
| `destructive` | `#B03A2E` (rouge terre) | Rupture, alerte CRITIQUE, suppression |
| `info` | `#4A6C8C` (bleu neutre, hors logo mais nécessaire pour équilibrer la palette) | Alertes INFO, notifications neutres |

Recommandation : thème clair par défaut (cohérent avec le fond crème du logo) ; un mode sombre optionnel devra recolorer `background`/`foreground` sans toucher `primary`/`accent`, pour préserver l'identité de marque.

---

## D. Architecture technique

**Contexte** : SaaS mono-ferme aujourd'hui, multi-tenant demain (`farmId` sur toutes les tables métier), utilisé depuis Samba (RCA, connectivité limitée) et depuis la France, sur mobile en priorité.

**Architecture** : monolithe modulaire NestJS (Back) + Next.js PWA (Front), MySQL/Prisma, Redis (cache + jobs), stockage documentaire séparé. Pas de microservices à ce stade — chaque domaine métier est un module NestJS isolé, prêt à être extrait plus tard si nécessaire.

**Composants** :
- **Front** : Next.js (App Router) + TypeScript + Tailwind + Shadcn UI + React Query + React Hook Form + Zod. Mobile-first, sidebar desktop / bottom-nav mobile.
- **Back** : NestJS modulaire par domaine (Auth, Users, Roles, Farms, Buildings, Flocks/Poultry, DailyMonitoring, Mortality, Weighings, Feed, Water, Health, EggProduction, Breeding/Hatchery, Inventory, Purchases, Suppliers, Customers, Sales, Finance, Treasury, Assets, Depreciation, Maintenance, Infrastructure (solar/water/network), IoT, Tasks, Alerts, Notifications, Reports, Dashboards, AuditLogs, Settings).
- **BDD** : MySQL + Prisma, migrations versionnées, soft delete (`deletedAt`) sur données financières/sanitaires/audit.
- **Cache/Jobs** : Redis pour cache API et files d'attente (génération d'alertes, calculs planifiés, notifications).
- **Auth** : JWT access court + refresh token, OAuth Google/Microsoft, 2FA, RBAC vérifié côté API systématiquement (jamais uniquement Front).
- **API** : REST versionnée `/api/v1/...`, DTO + validation, pagination/tri/filtre standard, gestion d'erreurs centralisée, jamais de modèle Prisma exposé directement.
- **Infra** : Docker Compose (web, api, mysql, redis, nginx), environnements dev/staging/prod séparés, secrets uniquement via variables d'environnement.
- **CI/CD** : GitHub Actions (install → lint → typecheck → tests → build → image Docker → déploiement conditionnel au succès du pipeline).

**Flux** : Front (React Query) → API REST versionnée → Services métier NestJS → Prisma → MySQL, avec Redis en cache/jobs asynchrones (alertes, prévisions) et un module `AuditLogs` invoqué en middleware/interceptor sur toute action sensible.

**Sécurité** : voir `SECURITE.md` (déjà respecté par la conception ci-dessus) — RBAC serveur, rate limiting, CORS, headers sécurisés, anti-XSS/injections, CSRF si applicable, HTTPS, JWT sécurisé, audit logs, sauvegardes.

**Déploiement** : Docker Compose orchestrant Front/API/MySQL/Nginx, volumes persistants, redémarrage automatique, jamais d'identifiants prod dans le dépôt.

**Tests** : unitaires, intégration, API, RBAC, auth, calculs métier — priorité finances/stocks/mortalité/ventes/RBAC.

**Risques** : (1) confusion PostgreSQL/MySQL entre cahier des charges et fichiers projet — tranché en faveur de MySQL, à faire confirmer ; (2) connectivité Samba → nécessite dès Phase 1 une discipline stricte de pagination/cache pour éviter une dette de performance difficile à rattraper plus tard ; (3) RBAC à 8-9 rôles doit être conçu data-driven dès le départ pour éviter une refonte lourde en Phase métier.

---

## E. Arborescence proposée

```text
dondy-elevage/
  apps/
    web/                      # Next.js PWA
      src/
        app/                  # routes (App Router)
        components/           # composants réutilisables (UI + métier)
        features/             # un dossier par domaine métier (flocks, sales, stocks...)
        lib/                  # api client, hooks React Query, utils
        styles/                # tokens Tailwind (palette DONDY)
    api/                       # NestJS
      src/
        modules/
          auth/ users/ roles/ farms/ buildings/
          flocks/ daily-monitoring/ mortality/ weighings/ feed/ health/
          egg-production/ breeding/ hatchery/
          water-sales/
          inventory/ purchases/ suppliers/
          customers/ sales/
          finance/ treasury/
          assets/ depreciation/ maintenance/ infrastructure/ iot/
          tasks/ alerts/ notifications/
          reports/ dashboards/
          audit-logs/ settings/
        common/                # guards, interceptors, decorators, filters
        prisma/                # schema.prisma, migrations
  packages/
    shared-types/               # types/DTO partagés front/back
    ui/                         # design system Shadcn étendu (tokens DONDY)
  docker/
    docker-compose.dev.yml
    docker-compose.prod.yml
    nginx/
  docs/
    cahiers-des-charges/
    architecture/
  .github/
    workflows/
      ci.yml
      deploy.yml
  .env.example
```

---

## F. Modèle de données initial (Phase 0 — socle uniquement)

Entités socle nécessaires dès la Phase 0/1, communes à toutes les versions :

| Table | Champs clés | Relations |
|---|---|---|
| `farms` | id, name, country, locality, currency, timezone, settings(json) | 1—N vers toutes les tables métier via `farmId` |
| `users` | id, farmId, email, passwordHash, name, status, twoFactorEnabled | N—N `roles` via `user_roles` |
| `roles` | id, farmId?, name, isSystem | N—N `permissions` via `role_permissions` |
| `permissions` | id, code, description | — |
| `refresh_tokens` | id, userId, tokenHash, expiresAt, revokedAt | N—1 `users` |
| `oauth_accounts` | id, userId, provider, providerAccountId | N—1 `users` |
| `buildings` | id, farmId, name, type, capacity | 1—N vers `flocks`, `assets` |
| `suppliers` | id, farmId, name, contact, category | 1—N `purchases` |
| `customers` | id, farmId, code, name, type, phone | 1—N `sales` |
| `documents` | id, farmId, entityType, entityId, url, type | polymorphe |
| `alerts` | id, farmId, type, severity, entityType, entityId, status, scheduledAt, triggeredAt | polymorphe |
| `notifications` | id, farmId, userId, channel, payload, readAt | N—1 `users` |
| `audit_logs` | id, farmId, userId, entityType, entityId, action, oldValues(json), newValues(json), ipAddress, createdAt | append-only |
| `settings` | id, farmId, key, value(json) | paramétrage sans redéploiement |

Conventions systématiques (conformes à `BASE_DE-DONNEES.md`) : `id`, `farmId`, `createdAt`, `updatedAt`, `createdBy` si pertinent, `deletedAt` pour soft delete sur finances/santé/audit. Index sur `farmId` + clés de recherche fréquentes. Isolation stricte multi-tenant vérifiée au niveau service (jamais laissée à la seule responsabilité de la requête Front).

Les entités métier détaillées (broiler_batches, layer_batches, breeder_batches, incubation_batches, water_points, items/stock_movements, purchase_orders, sales/sale_items, expenses, assets/depreciation_schedules, maintenance_tasks, iot_sensors, tasks, etc.) sont déjà largement spécifiées dans les cahiers des charges (§16 V1, §12/18 V5, §18 V6) et seront implémentées progressivement, module par module, à partir de la Phase 3.

---

## G. Roadmap

| Phase | Contenu | Réf. cahier des charges |
|---|---|---|
| **Phase 0** | Fondations techniques (voir GO ci-dessous) | Transverse |
| **Phase 1** | Auth, Users, Roles/RBAC unifié, Farms, Buildings | UTILISATEURS_ET_AUTORISATIONS.md, V5 §11 |
| **Phase 2** | Suppliers, Customers, Documents, Alerts (moteur), Notifications, AuditLogs | ALERTES.md, JOURNALISATION_ET_AUDIT.md |
| **Phase 3** | Module Chair complet (bandes, suivi quotidien, mortalité, pesées, alertes J1-J45, santé, ventes, clôture) | V1 intégral |
| **Phase 4** | Module Pondeuses (lots, suivi, stock œufs, ventes) | V5 §5, MODULE_PONTE.md |
| **Phase 5** | Module Reproduction/Couvoir (lots reproducteurs, incubation, mirage, éclosion, filiation) | V5 §6 |
| **Phase 6** | Module Eau — vente (points d'eau, relevés, clients, encaissement) | V5 §7 |
| **Phase 7** | Stocks/Achats/Fournisseurs + mouvements automatiques inter-modules | V5 §8, STOCKS.md, ACHATS_ET_FOURNISSEURS.md |
| **Phase 8** | Finances/Trésorerie + rentabilité analytique consolidée | V5 §8.7-8.8, FINANCES.md |
| **Phase 9** | Tableau de bord global + rapports/exports | V5 §9/§14, TABLEAU_DE_BORD.md |
| **Phase 10** | Patrimoine & amortissements, Maintenance | V6 §3, §7 |
| **Phase 11** | Infrastructures autonomes (solaire, forage, Starlink) + IoT + QR Codes | V6 §4-9 |
| **Phase 12** | Planning opérationnel, Prévisions, IA/Assistant DONDY | V6 §10-12 |
| **Phase 13** | Offline/synchronisation, PWA avancée, durcissement sécurité/production | V6 §14, PERFORMANCE_ET_CONNECTIVITE.md |

Chaque phase se termine par le livrable standard (résumé, migrations, tests, vérifications manuelles, risques, prochaine étape).

---

# GO CLAUDE CODE — PHASE 0

```
CONTEXTE
Tu travailles sur DONDY ELEVAGE, un SaaS de gestion de ferme avicole (Samba,
République centrafricaine). C'est le tout premier commit du projet : aucune
base de code n'existe encore (ou vérifie et réutilise l'existant si le
repository n'est pas vide).

OBJECTIF DE CETTE MISSION (PHASE 0 — FONDATIONS UNIQUEMENT)
Mettre en place l'ossature technique du projet, sans implémenter de
fonctionnalité métier. Ne pas coder les modules Flocks, Sales, Stocks, etc.
à ce stade.

STACK IMPOSÉE (ne pas modifier sans justification technique majeure)
- Front: Next.js (App Router) + TypeScript + Tailwind CSS + Shadcn UI +
  React Query + React Hook Form + Zod
- Back: Node.js + NestJS + TypeScript
- BDD: MySQL
- ORM: Prisma
- Auth (à préparer seulement, pas à finaliser en Phase 0): JWT + Refresh
  Token + OAuth Google/Microsoft + 2FA
- Infra: Docker, Docker Compose, Nginx
- CI/CD: GitHub Actions

STRUCTURE DE REPO CIBLE
dondy-elevage/
  apps/web/    (Next.js)
  apps/api/    (NestJS)
  packages/shared-types/
  packages/ui/
  docker/
  docs/
  .github/workflows/

TÂCHES ATTENDUES
1. Analyser le repository existant avant toute action ; ne rien supprimer
   sans justification explicite dans ton résumé final.
2. Initialiser la structure de dossiers ci-dessus (monorepo, npm/pnpm
   workspaces — choisis un outil simple et justifie-le brièvement).
3. Configurer apps/web en Next.js + TypeScript strict.
4. Configurer apps/api en NestJS + TypeScript strict, organisé en modules
   vides mais présents pour : auth, users, roles, farms, buildings (les
   autres modules métier seront ajoutés dans les phases suivantes, ne les
   crée pas maintenant).
5. Installer et configurer Tailwind CSS + Shadcn UI dans apps/web, avec un
   fichier de design tokens dédié reprenant la palette officielle DONDY
   ELEVAGE :
   primary #2D4A2E, secondary #A0522D, accent #E8891D, background #FAF7EF,
   foreground #1A1A1A, muted #E8E1D0, border #D8CFB8, success #3F7A3E,
   warning #E8891D, destructive #B03A2E, info #4A6C8C.
6. Configurer React Query (provider global) et React Hook Form + Zod
   (exemple minimal de formulaire type, sans logique métier réelle).
7. Configurer Prisma avec MySQL : schema.prisma initial contenant
   uniquement les tables socle suivantes, avec farmId, createdAt, updatedAt,
   createdBy (si pertinent), deletedAt (soft delete) :
   farms, users, roles, permissions, user_roles, role_permissions,
   refresh_tokens, oauth_accounts, buildings, audit_logs, settings.
   Créer la première migration versionnée.
8. Préparer Docker : Dockerfile pour apps/web et apps/api, plus
   docker-compose.dev.yml orchestrant web, api, mysql, redis, nginx (config
   nginx minimale de reverse proxy). Ne jamais committer de secret ; créer
   .env.example avec toutes les variables nécessaires (sans valeurs
   sensibles réelles).
9. Mettre en place ESLint + Prettier (config partagée front/back).
10. Créer les workflows GitHub Actions (.github/workflows/ci.yml) exécutant
    au minimum : install → lint → typecheck → tests → build. Le pipeline
    doit échouer si une étape échoue.
11. Mettre en place la structure de tests (Jest/Vitest côté web et api),
    avec un test trivial de chaque côté pour valider la configuration.
12. Créer le layout applicatif de base dans apps/web : sidebar desktop /
    navigation mobile, topbar, zone de contenu — style sobre reprenant la
    palette DONDY ELEVAGE, sans écran métier réel (juste la coquille de
    layout + une page d'accueil minimale).
13. Documenter dans docs/architecture/ une courte note (README.md)
    récapitulant les choix techniques de cette Phase 0.

RÈGLES MÉTIER / CONTRAINTES
- Aucune fonctionnalité métier (bandes, ventes, stocks...) ne doit être
  codée à ce stade.
- Toute table doit inclure farmId pour garantir l'isolation multi-tenant
  future, même si une seule ferme existe aujourd'hui.
- RBAC : concevoir roles/permissions comme données paramétrables (tables),
  pas comme enum figé dans le code.

CONTRAINTES DE SÉCURITÉ
- Aucun secret en dur dans le code ni dans le dépôt Git.
- Toutes les valeurs sensibles passent par des variables d'environnement
  (.env, non committé).
- Ne pas exposer les modèles Prisma directement via l'API (même vide à ce
  stade, respecte cette règle dans la structure des contrôleurs/DTO).

TESTS ATTENDUS
- Un test unitaire trivial côté apps/api (ex: service de santé /health).
- Un test trivial côté apps/web (ex: rendu du layout).
- Le pipeline CI doit exécuter ces tests avec succès.

COMPATIBILITÉ ET PÉRIMÈTRE
- Si un repository existant est détecté, analyse-le entièrement avant
  toute modification et conserve tout ce qui est réutilisable.
- N'effectue aucune modification hors du périmètre de cette Phase 0.
- Procède par commits atomiques et lisibles.

LIVRABLE ATTENDU EN FIN DE MISSION
1. Résumé du travail effectué (fichiers créés / modifiés).
2. Liste des migrations Prisma ajoutées.
3. Tests exécutés et résultats.
4. Commandes exactes à exécuter pour vérifier manuellement (install, dev,
   build, test, docker compose up).
5. Risques ou dette technique identifiés.
6. Proposition de la prochaine étape (Phase 1 uniquement, pas plus).
```

---

**Statut** : synthèse et architecture validées à ce stade documentaire ; le point B.1 (MySQL vs PostgreSQL) et B.5 (référentiel de rôles unifié) sont à confirmer explicitement avant la Phase 1. Le prompt GO CLAUDE CODE — PHASE 0 ci-dessus est directement copiable dans Claude Code.
