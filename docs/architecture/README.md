# DONDY ELEVAGE — Phase 0 : fondations techniques

Récapitulatif des choix techniques de la Phase 0 (ossature uniquement, aucune
fonctionnalité métier). Référence complète : [`DONDY_ELEVAGE_GO_PHASE0.md`](./DONDY_ELEVAGE_GO_PHASE0.md).

## Monorepo

**npm workspaces** (`apps/*`, `packages/*`) plutôt que pnpm : pnpm n'était pas
installé sur la machine de développement et npm (déjà présent, v11) gère
nativement les workspaces — suffisant pour 2 apps + 2 packages, sans
dépendance globale supplémentaire à installer. `package.json` racine expose
des scripts agrégés (`build`, `lint`, `typecheck`, `test`) qui enchaînent
`apps/web` puis `apps/api`.

`packages/shared-types` et `packages/ui` existent en stubs vides (juste un
`package.json` + `src/index.ts` exportant `{}`) : la structure cible est en
place, le contenu réel arrivera quand plusieurs consommateurs en auront
réellement besoin (types partagés dès la Phase 1 pour `shared-types` ; `ui`
seulement si une app mobile ou un second front apparaît un jour).

## apps/web — Next.js

- Next.js 16.3.1 (App Router, Turbopack), React 19, TypeScript strict
  (`strict: true` + `noUncheckedIndexedAccess: true`).
- Tailwind CSS v4 (config CSS-first, pas de `tailwind.config.js`) + shadcn/ui
  (preset `base-nova`, bibliothèque `@base-ui/react`).
- **Tokens DONDY ELEVAGE** : `src/styles/tokens.css`, seule source de vérité
  de la palette officielle (`--dondy-*`), remappée sur les variables
  sémantiques attendues par shadcn (`--primary`, `--secondary`, ...) dans
  `:root`. Thème clair uniquement pour l'instant — le mode sombre est
  explicitement différé (voir section C du document de synthèse), le bloc
  `.dark` reprend donc les mêmes valeurs en attendant une vraie conception.
  `success`/`warning`/`info` ajoutés comme tokens de premier niveau
  (au-delà du jeu shadcn par défaut) car explicitement requis par CLAUDE.md.
- **React Query** : provider global (`components/providers/query-provider.tsx`),
  `staleTime` volontairement généreux (60s) et `refetchOnWindowFocus: false`
  — connectivité Samba limitée, éviter les requêtes superflues.
- **React Hook Form + Zod** : exemple minimal et générique
  (`components/examples/example-form.tsx`, affiché sur la page d'accueil),
  sans logique métier — gabarit pour les formulaires réels à partir de la
  Phase 1.
- **Layout applicatif** (`components/layout/`) : sidebar desktop (`<aside>`,
  masquée sous `md`) + navigation basse mobile (`<nav>` fixe, masquée à
  partir de `md`), topbar avec emplacement compte (désactivé, auth pas
  encore finalisée). Un seul lien de nav pour l'instant ("Tableau de bord") :
  les modules métier rejoindront `components/layout/nav-items.ts` phase par
  phase. Appliqué globalement dans `app/layout.tsx` — à répartir en groupes
  de routes (`(app)`/`(auth)`) dès que des pages sans navigation (connexion...)
  arrivent en Phase 1.
- **Tests** : Vitest + Testing Library (`pool: 'threads'` — le pool `forks`
  par défaut expirait systématiquement sur cette machine Windows). Un test
  trivial (`app-shell.test.tsx`) vérifie le rendu de la navigation et du
  contenu.

## apps/api — NestJS

- NestJS 11, TypeScript strict (le tsconfig généré par `nest new` n'active
  **pas** `strict` par défaut — corrigé explicitement, conformément à
  CLAUDE.md : "TypeScript strict partout, éviter `any`"). Idem côté ESLint :
  `@typescript-eslint/no-explicit-any` remonté de `off` (défaut Nest) à
  `error`.
- Modules socle créés **vides** (juste la classe `@Module({})`, aucun
  contrôleur/service) : `auth`, `users`, `roles`, `farms`, `buildings` — le
  contenu métier arrive phase par phase, à partir de la Phase 1 pour `auth`.
- `main.ts` : préfixe global `/api/v1`, `ValidationPipe` global
  (`whitelist`, `forbidNonWhitelisted`, `transform`), CORS piloté par
  `CORS_ORIGINS` (liste blanche, jamais `*`).
- `common/health/` : `GET /api/v1/health`, seul endpoint réel de cette phase
  — sert aussi de test unitaire trivial (`health.controller.spec.ts`).

## Prisma + MySQL

**Prisma 7** a changé de modèle de configuration par rapport aux versions
précédentes — point non anticipé au moment de la rédaction du document de
synthèse, découvert en configurant le schéma :

- L'URL de connexion n'est plus dans `datasource { url = ... }` mais dans
  `prisma.config.ts` (utilisé par le CLI/Migrate uniquement).
- **Un driver adapter est obligatoire** pour `PrismaClient` à l'exécution —
  plus de moteur de requêtes intégré. Pour MySQL : `@prisma/adapter-mariadb`
  + le driver `mariadb`, tous deux ajoutés aux dépendances.
- `src/prisma/prisma.service.ts` instancie `PrismaClient` avec l'adapter
  (`new PrismaMariaDb(DATABASE_URL)`), `$connect()`/`$disconnect()` sur les
  hooks de cycle de vie Nest. `PrismaModule` est `@Global()` pour éviter de
  le réimporter dans chaque module métier futur.
- `postinstall: prisma generate` ajouté à `apps/api/package.json` : le
  client généré (dans `node_modules/@prisma/client`, mutualisé par les
  workspaces) doit exister avant tout `typecheck`/`build`. Nécessite une
  `DATABASE_URL` syntaxiquement valide au moment du `npm ci` (voir CI
  ci-dessous) — `prisma generate` ne se connecte jamais réellement à une
  base, mais échoue si la variable est totalement absente.

**Schéma socle** (`apps/api/prisma/schema.prisma`) : les 11 tables listées
en section F du document de synthèse — `farms`, `users`, `roles`,
`permissions`, `user_roles`, `role_permissions`, `refresh_tokens`,
`oauth_accounts`, `buildings`, `audit_logs`, `settings`. RBAC piloté par
données (`roles`/`permissions` en tables, pas d'enum figé) ; `Role.farmId`
nullable (rôle système global vs rôle propre à une ferme) ; `deletedAt`
réservé aux tables finances/santé/audit (ici : `audit_logs` uniquement,
usage administratif exceptionnel, jamais utilisé par le flux applicatif
normal — les tables restantes de ce socle ne rentrent dans aucune de ces
trois catégories).

## Docker

Ports hôte volontairement décalés pour cohabiter avec `donexskill-app`,
déjà présent sur cette machine : MySQL 3307, Redis 6380, API 3011, Web 3001
**(3002 sur cette machine précise, voir ci-dessous)**, Nginx 8080/8443 (voir
CLAUDE.md).

- `apps/web/Dockerfile` et `apps/api/Dockerfile` : multi-stage
  (`deps` → `dev` / `builder` → `runner`), **contexte de build = racine du
  repo** (pas le dossier de l'app) — obligatoire avec npm workspaces, qui a
  besoin du lockfile racine pour résoudre les dépendances. `apps/web` utilise
  `output: 'standalone'` pour une image de production minimale. Les deux
  `deps` stages copient aussi `apps/api/prisma/` + `apps/api/prisma.config.ts`
  et déclarent une `DATABASE_URL` placeholder : un `npm ci` à la racine
  déclenche le `postinstall` de **tous** les workspaces, y compris
  `prisma generate` côté `apps/api` — sans ces fichiers présents à ce stade,
  `npm ci` échoue même dans l'image `web`.
- `docker/docker-compose.dev.yml` : `mysql`, `redis`, `api`, `web` (cible
  `dev`, hot-reload via volume), `nginx` (reverse proxy minimal, `/api/` →
  `api:3000`, `/` → `web:3000`). Volumes nommés dédiés pour isoler de l'hôte
  Windows : `node_modules` racine (`api_node_modules`/`web_node_modules`),
  `node_modules` imbriqué propre à chaque workspace
  (`api_app_node_modules`/`web_app_node_modules` — npm workspaces peut
  placer certains paquets directement dans `apps/*/node_modules` plutôt que
  de les hoister, voir Risques), et le cache Turbopack de `apps/web/.next`
  (verrou de fichier en échec "Permission denied" sur bind-mount Windows
  sinon).
- Le fichier `.env` vit à la racine du repo, **pas** dans `docker/` — invoquer
  Compose avec `--env-file .env` (ou `--env-file ../.env` depuis `docker/`)
  sinon les variables `${...}` du compose file ne sont pas résolues ;
  `env_file:` seul ne suffit pas, il n'alimente que l'environnement du
  conteneur, pas les substitutions du fichier YAML lui-même.
- `.env.example` (racine) documente une variable ambiguë à ne pas confondre :
  `DATABASE_URL` diffère selon le contexte d'exécution — `mysql:3306` (nom
  de service, réseau Docker interne) pour les conteneurs `api`/`web`,
  `localhost:3307` (port hôte publié) pour un `apps/api` lancé directement
  sur la machine hôte (`apps/api/.env`). Les deux fichiers doivent rester
  synchronisés manuellement (voir Risques, migration Prisma).
- **`WEB_HOST_PORT` réellement à 3002 sur cette machine** (`.env`, pas
  `.env.example` qui garde 3001 comme valeur canonique documentée dans
  CLAUDE.md) : le port 3001 était déjà occupé par un processus `node.exe`
  natif préexistant, sans rapport avec ce projet ni avec Docker — non arrêté
  volontairement (pas d'action destructive sur un processus non identifié).
  `WEB_HOST_PORT` dans `.env` est le seul override nécessaire si ce port
  redevient libre sur une autre machine.
- **Vérifié en conditions réelles** : `mysql` (`healthy`), `redis`, `api`
  (`GET /api/v1/health` → `200` en direct sur `:3011` **et** via Nginx sur
  `:8080/api/v1/health`) fonctionnent tous les trois de bout en bout dans le
  compose complet. **`web` reste bloqué** — voir le blocage documenté
  ci-dessous, non résolu à ce jour.

### Blocage non résolu — `web` (conteneur) : résolution CSS de `tw-animate-css` échoue

**Symptôme** : le conteneur `web` (cible `dev`, `next dev` via Turbopack)
répond `500` sur `/` à chaque requête, avec l'erreur
`CssSyntaxError: tailwindcss: .../globals.css:1:1: Can't resolve 'tw-animate-css' in '/repo/apps/web/src/app'`
(import `@import "tw-animate-css";`, ligne 1 de `globals.css`). `api` et
`nginx` fonctionnent normalément dans le même `docker compose up` — le
blocage est strictement local à `web`.

**Le même code, sur la même machine, fonctionne sur l'hôte** (hors Docker) :
`npm run dev --workspace=apps/web` depuis la racine, testé à froid (process
tué, cache `.next` vidé, nouveau port) → `200`, page rendue correctement.

**Causes écartées, une par une, avec preuve** :
1. Client Prisma non généré côté `api` — cause réelle mais **distincte**,
   déjà corrigée (COPY du schéma dans le stage `deps`, voir ci-dessus) ;
   sans rapport avec `web`, `api` répond `200` de manière stable depuis.
2. `apps/web/node_modules` et `apps/api/node_modules` résiduels sur l'hôte
   (créés par les scaffolds initiaux `create-next-app`/`nest new`, avant le
   rattachement aux workspaces) — supprimés, confirmés absents après un
   `npm install` propre à la racine.
3. Lockfile "vicié" par des installs incrémentaux successifs — écarté par
   régénération complète (`rm -rf node_modules package-lock.json && npm
   install`) : le même sous-ensemble de paquets (`@hookform`, `@types`,
   `ajv`...) se retrouve à nouveau imbriqué dans `apps/web/node_modules`
   après coup — décision de hoisting **déterministe** de npm (liée aux
   contraintes de peer dependencies), pas un artefact d'ordre d'installation.
4. Volumes Docker non isolés/pas régénérés — écarté : volumes nommés
   supprimés et recréés à chaque tentative, contenu vérifié par
   `docker exec` à chaque fois (paquet présent à la racine `/repo/node_modules`,
   absent-mais-non-requis du dossier imbriqué).
5. Style d'invocation (`cd apps/web && npm run dev` vs `npm run dev
   --workspace=apps/web` depuis `/repo`) — changé dans le Dockerfile
   (`WORKDIR /repo` + `CMD npm run dev --workspace=apps/web`), aucun effet.
6. Réinstallation ciblée de `tw-animate-css` directement dans
   `apps/web/package.json`/`--workspace=apps/web` pour forcer sa présence
   locale (au lieu de compter sur le hoisting implicite) — **écarté** : npm
   ne duplique jamais un paquet qui n'a aucun conflit de version ailleurs
   dans l'arbre, quelle que soit la manière dont l'install est invoquée ; il
   est hoisté proprement à la racine à chaque fois, jamais imbriqué dans
   `apps/web/node_modules`. Cette piste ne peut donc pas aboutir via les
   mécanismes standards de npm.

**Différence confirmée, cause exacte non identifiée** : à arborescence
`node_modules` strictement identique (vérifié fichier par fichier via
`docker exec`), même version de Next.js/Turbopack, même code — l'hôte
Windows résout `tw-animate-css` sans problème, le conteneur Linux échoue
systématiquement.

7. **`turbopack.root` (`next.config.ts`), tentative ciblée unique** — fixe
   explicitement la racine de résolution Turbopack sur la racine du
   monorepo plutôt que de dépendre de sa détection automatique. Typecheck
   propre, image rebuildée, conteneur recréé, retesté une seule fois comme
   convenu : **échec identique**, erreur strictement inchangée. Écarté.
   Config conservée dans `next.config.ts` (harmless, correcte en soi pour un
   monorepo) mais ne résout pas ce blocage précis.

**Cause exacte non identifiée après 7 hypothèses écartées.** Hypothèse
restante, non testée : comportement du résolveur CSS Turbopack/Lightning
CSS spécifique au filesystem bind-mount/volumes de Docker Desktop sur
Windows (WSL2), indépendant de la configuration applicative.

**Décision (porteur de projet)** : contournement accepté plutôt que
poursuite du diagnostic — voir "Mode de développement hybride Windows" dans
`CLAUDE.md`. `web` tourne en natif sur l'hôte (`npm run dev
--workspace=apps/web`), `mysql`/`redis`/`api`/`nginx` restent orchestrés via
`docker-compose.dev.yml` (le service `web` y reste défini, pour Linux/macOS
où ce bug n'est a priori pas reproduit — à ne pas retirer de la config).
Réévaluer si le bug est corrigé en amont dans Next.js/Turbopack.

## ESLint + Prettier

Prettier **partagé** via un unique `.prettierrc.json` à la racine (Prettier
remonte l'arborescence pour le trouver, donc un seul fichier suffit pour les
deux apps — le `.prettierrc` généré par `nest new` dans `apps/api` a été
supprimé pour éviter un doublon qui l'aurait masqué). ESLint reste
volontairement **par app** (`eslint-config-next` côté web, `typescript-eslint`
+ `eslint-plugin-prettier` côté api) : les règles Next n'ont pas de sens
côté Nest et inversement — ce qui est réellement partagé, c'est le style de
formatage, pas les règles de lint framework-spécifiques.

## CI (`.github/workflows/ci.yml`)

`install → lint → typecheck → test → build`, un job unique, échec bloquant à
chaque étape. `DATABASE_URL` placeholder au niveau du job (nécessaire pour
que `prisma generate`, déclenché par le `postinstall` pendant `npm ci`,
puisse charger `prisma.config.ts` — voir ci-dessus) : **aucune base n'est
provisionnée dans ce pipeline**, seuls les tests unitaires (sans connexion
réelle à Prisma) sont exécutés à ce stade.

## Risques / dette technique

- **Migration initiale appliquée** (`20260818021737_init`) — les 11 tables
  socle sont créées dans `dondy_elevage` (vérifié par `SHOW TABLES`). Deux
  pièges rencontrés en l'appliquant, résolus et à connaître pour toute
  future recréation de la base locale :
  - **Mot de passe désynchronisé** entre `apps/api/.env` (`DATABASE_URL`,
    utilisé par le CLI Prisma côté hôte) et `.env` racine (`MYSQL_PASSWORD`,
    utilisé pour initialiser le conteneur) — les deux avaient été renseignés
    séparément à des moments différents avec des valeurs différentes.
    Corrigé (les deux fichiers utilisent maintenant `change_me_dev_password`).
    **À vérifier systématiquement en cas d'échec `P1000`** : ces deux
    fichiers doivent rester synchronisés manuellement (aucune valeur
    partagée automatiquement entre eux).
  - **Shadow database** : `prisma migrate dev` a besoin de créer une base
    temporaire pour calculer le diff. `dondy_user` n'a par défaut que les
    privilèges sur `dondy_elevage` (comportement standard de l'image MySQL
    officielle avec `MYSQL_USER`/`MYSQL_PASSWORD`) — `CREATE`/`DROP`
    globaux ont dû être accordés explicitement :
    ```bash
    docker exec dondy-elevage-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
      "GRANT CREATE, DROP, ALTER, INDEX, REFERENCES ON *.* TO 'dondy_user'@'%'; FLUSH PRIVILEGES;"
    ```
    Nécessaire une seule fois par volume MySQL local (perdu si le volume
    `docker_mysql_data` est recréé, ex. après un `docker compose down -v`).
- **Vulnérabilité `npm audit` connue et acceptée** : `deepmerge-ts < 8.0.0`
  (dépendance transitive de `@prisma/config`, donc du CLI `prisma`
  uniquement — pas de `@prisma/client`, jamais livré en production).
  Stack-exhaustion sur un graphe récursif fourni en entrée du CLI — non
  accessible depuis une requête réseau. Aucune version stable de Prisma 7 ne
  corrige ça à ce jour (`7.9.1` = dernière stable ; `7.10.x` = pré-releases
  dev only ; `8.0.0-rc` = release candidate). `npm audit fix --force`
  proposerait un retour à Prisma 6.x, jugé disproportionné pour une
  vulnérabilité CLI-only sans correctif stable disponible plus haut. À
  réévaluer à la prochaine version stable de Prisma.
- **Conteneur `web` non fonctionnel sur Windows** (`500`, résolution CSS de
  `tw-animate-css` en échec) — cause exacte non identifiée après 7
  hypothèses écartées, voir section "Blocage non résolu" ci-dessus.
  Contournement accepté : `web` en natif sur l'hôte, voir "Mode de
  développement hybride Windows" dans `CLAUDE.md`. `mysql`/`redis`/`api`/
  `nginx` fonctionnent normalement ensemble en Docker, vérifié en conditions
  réelles (`GET /api/v1/health` → `200` en direct et via Nginx).
- **Mode sombre non conçu** — différé sciemment (voir section C du document
  de synthèse), le bloc `.dark` de `tokens.css` est un placeholder identique
  au thème clair.
- **RBAC : tables prêtes, aucune donnée** — pas de rôles/permissions seedés
  (attendu, Phase 1 : "unifier en RBAC piloté par données").
- **Auth non implémentée** (attendu — Phase 0 prépare seulement JWT/OAuth,
  ne les finalise pas).

## Vérification manuelle

```bash
npm install                          # à la racine, installe tous les workspaces
npm run lint                         # web + api
npm run typecheck                    # web + api
npm run test                         # web (Vitest) + api (Jest, unitaires)
npm run build                        # web + api
npm run dev:web                      # apps/web sur :3000 (ou -- -p <port>)
npm run dev:api                      # apps/api sur :3000 (voir apps/api/.env)

# Mode hybride Windows (voir CLAUDE.md) : web en natif, reste en Docker.
cd docker && docker compose --env-file ../.env -f docker-compose.dev.yml up -d mysql redis api nginx
npm run dev:web                      # depuis la racine, dans un second terminal

# Compose complet (web inclus) — fonctionne sur Linux/macOS, PAS sur Windows
# à ce jour (voir "Blocage non résolu") :
cd docker && docker compose --env-file ../.env -f docker-compose.dev.yml up -d

# Première migration (déjà appliquée sur la base locale actuelle — commande
# nécessaire seulement après une base neuve/recréée, voir Risques pour le
# GRANT shadow-db requis dans ce cas) :
cd apps/api && npx prisma migrate dev --name init
```

## Prochaine étape proposée

**Phase 1** — Auth, Users, Roles/RBAC unifié, Farms, Buildings (voir
`DONDY_ELEVAGE_GO_PHASE0.md`, section G). Préalables techniques de la
Phase 0 désormais tous couverts (migration appliquée, `mysql`/`redis`/`api`/
`nginx` vérifiés ensemble en Docker, contournement documenté pour `web` sur
Windows) — rien ne bloque plus le démarrage de la Phase 1.
