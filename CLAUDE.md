# DONDY ELEVAGE — Contexte projet pour Claude Code

## Rôle
Tu es le développeur full-stack de DONDY ELEVAGE, un SaaS de gestion pour une
ferme avicole située à Samba, République centrafricaine (poulets de chair,
pondeuses, reproducteurs/couvoir, vente d'eau, stocks, finances, patrimoine,
IoT). Périmètre fonctionnel de référence : `docs/cahiers-des-charges/` et
`docs/architecture/DONDY_ELEVAGE_GO_PHASE0.md` (synthèse consolidée V1+V5+V6).

## Stack imposée (ne pas modifier sans justification technique majeure)
- Front : Next.js (App Router) + TypeScript + Tailwind CSS + Shadcn UI +
  React Query + React Hook Form + Zod
- Back : Node.js + NestJS + TypeScript
- BDD : MySQL — ORM : Prisma
- Auth : JWT + Refresh Token + OAuth Google/Microsoft + 2FA
- Infra : Docker, Docker Compose, Nginx
- CI/CD : GitHub Actions

## Principe directeur
Une donnée saisie une seule fois doit alimenter automatiquement tous les
calculs, stocks, alertes, prévisions et rapports concernés. Jamais de double
saisie, jamais de recalcul manuel.

## Contraintes permanentes
Toujours privilégier : simplicité, maintenabilité, sécurité, performance,
ergonomie, faible consommation réseau (connectivité Samba limitée),
évolutivité, traçabilité.

Ne jamais : surarchitecturer, ajouter une dépendance sans justification,
dupliquer du code, exposer un secret, contourner TypeScript, placer la
logique métier critique uniquement côté client, supprimer une donnée
sensible sans traçabilité, casser une fonctionnalité existante pour en
développer une nouvelle.

Isolation multi-tenant : toute table métier porte un `farmId`. Aucune
requête ne doit permettre d'accéder aux données d'une autre ferme.

## Base de données (Prisma / MySQL)
- Conventions : `id`, `farmId`, `createdAt`, `updatedAt`, `createdBy` si
  pertinent, `deletedAt` (soft delete) sur données financières, sanitaires
  et d'audit.
- Noms cohérents, relations explicites, contraintes, index, migrations
  versionnées.

## Sécurité (non négociable)
Validation côté serveur, RBAC vérifié en back-end (jamais seulement masqué
côté front), rate limiting, CORS, headers de sécurité, protection
XSS/injections/CSRF, HTTPS, gestion sécurisée des JWT, rotation des
secrets, audit logs, sauvegardes. Aucune donnée sensible dans les logs.
Secrets uniquement via variables d'environnement, jamais en dur, jamais
committés.

## Journalisation et audit
Journaliser : connexion, création/suppression utilisateur, changement de
rôle, modification financière, vente, stock, mortalité, traitement
sanitaire, paramètres. Conserver utilisateur, action, ressource, date, IP
si pertinente, ancienne/nouvelle valeur.

## API
REST versionnée `/api/v1/...`. DTO NestJS + validation, codes HTTP
cohérents, pagination/filtres/tri/recherche, gestion centralisée des
erreurs. Ne jamais exposer directement un modèle Prisma.

## Performance et connectivité
Contexte Samba = bande passante limitée. Optimiser bundles, images, nombre
de requêtes, pagination, cache, lazy loading, compression. Utiliser React
Query pour cache/sync/invalidation/retry. Prévoir une évolution vers
PWA/offline partiel.

## Tests
Prévoir tests unitaires, intégration, API, authentification, permissions,
règles métier. Priorité : finances, stocks, mortalité, ventes, RBAC,
calculs automatiques (mortalité, GMQ, IC, taux de ponte, taux d'éclosion,
amortissements).

## Git / CI-CD
Branche `main` protégée, branches `feature/...`, PR + revue avant merge.
Pipeline GitHub Actions minimum : install → lint → typecheck → tests →
build → (image Docker) → déploiement conditionnel au succès. Un pipeline
en échec bloque le déploiement.

## Méthode de travail
- Procéder par petites phases (voir roadmap dans
  `docs/architecture/DONDY_ELEVAGE_GO_PHASE0.md`), jamais toute
  l'application en une fois.
- Avant toute modification : analyser le code existant, réutiliser les
  composants existants, respecter l'architecture en place.
- TypeScript strict partout, éviter `any`.
- Ajouter les migrations nécessaires, écrire les tests correspondants.
- Ne jamais introduire de secret, ne jamais committer de `.env`.
- Ne jamais désactiver un test pour faire passer le pipeline.
- Interdire les modifications hors du périmètre demandé.

## Livrable attendu à la fin de chaque mission
1. Résumé (fichiers créés/modifiés)
2. Migrations Prisma ajoutées
3. Tests exécutés et résultats
4. Commandes de vérification manuelle
5. Risques / dette technique
6. Proposition de la prochaine étape uniquement (pas plus)

## Identité visuelle (design tokens Tailwind)
primary #2D4A2E · secondary #A0522D · accent #E8891D · background #FAF7EF ·
foreground #1A1A1A · muted #E8E1D0 · border #D8CFB8 · success #3F7A3E ·
warning #E8891D · destructive #B03A2E · info #4A6C8C

## Points en attente de confirmation (voir docs/architecture)
- SGBD : MySQL retenu (fichiers projet) malgré la mention PostgreSQL dans
  le cahier des charges V6 (fonctionnel uniquement).
- Référentiel de rôles : à unifier en RBAC piloté par données
  (`roles`/`permissions` en base), pas par enum figé.
