# Build context attendu : la racine du monorepo (voir docker-compose.dev.yml)
# car npm workspaces exige le package.json + package-lock.json racine pour
# résoudre correctement les dépendances de apps/web.

FROM node:20-alpine AS base
WORKDIR /repo

# ---- deps : installation via le lockfile racine (npm workspaces) ----
FROM base AS deps
# Placeholder uniquement : un "npm ci" à la racine déclenche le postinstall
# de TOUS les workspaces, y compris "prisma generate" côté apps/api — ce
# schéma et cette DATABASE_URL syntaxique sont donc nécessaires même dans
# l'image web (voir apps/api/Dockerfile pour le détail de ce mécanisme).
ENV DATABASE_URL="mysql://user:password@localhost:3306/placeholder"
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

# ---- dev : hot-reload via volume monté par docker-compose.dev.yml ----
# Lancé depuis la racine du repo (pas depuis apps/web) : avec Turbopack, un
# `npm run dev` invoqué directement depuis apps/web fait échouer la
# résolution CSS des paquets hoistés à la racine (ex. `@import "tw-animate-css"`
# introuvable) alors que la résolution Node.js classique, elle, fonctionne.
FROM deps AS dev
WORKDIR /repo
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=apps/web"]

# ---- builder : build de production (output standalone) ----
FROM deps AS builder
COPY . .
RUN npm run build --workspace=apps/web

# ---- runner : image de production minimale ----
FROM node:20-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=builder /repo/apps/web/public ./apps/web/public
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
