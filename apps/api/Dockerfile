# Build context attendu : la racine du monorepo (voir docker-compose.dev.yml)
# car npm workspaces exige le package.json + package-lock.json racine pour
# résoudre correctement les dépendances de apps/api.

FROM node:20-alpine AS base
WORKDIR /repo
# python3/make/g++ : requis par node-gyp pour compiler argon2 depuis les
# sources (aucun binaire precompile musl/Alpine disponible pour ce paquet).
RUN apk add --no-cache python3 make g++

# ---- deps : installation via le lockfile racine (npm workspaces) ----
FROM base AS deps
# Placeholder uniquement : le postinstall de apps/api ("prisma generate")
# a besoin d'une DATABASE_URL syntaxiquement valide pour charger
# prisma.config.ts, mais ne se connecte jamais réellement à une base ici.
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
FROM deps AS dev
WORKDIR /repo
# @dondy-elevage/shared-types (TS compilé en CommonJS, voir son
# package.json) doit être (re)construit à chaque démarrage : son dossier
# `src` n'arrive qu'au runtime via le bind-mount du monorepo complet
# (docker-compose.dev.yml), donc jamais présent au moment du `npm ci`
# ci-dessus — seul son package.json l'est, pour ne pas invalider le cache
# Docker de cette étape à chaque changement de code source.
EXPOSE 3000
CMD ["sh", "-c", "npm run build --workspace=packages/shared-types && cd apps/api && npm run start:dev"]

# ---- builder : build de production (client Prisma déjà généré via deps) ----
FROM deps AS builder
COPY . .
RUN npm run build --workspace=packages/shared-types && npm run build --workspace=apps/api

# ---- runner : image de production ----
FROM node:20-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/prisma ./apps/api/prisma
# @dondy-elevage/shared-types : dépendance workspace (node_modules n'en
# contient qu'un lien symbolique) — déjà compilé en CommonJS ci-dessus
# (stage builder), copié tel quel pour la même raison que apps/api/dist.
COPY --from=builder /repo/packages/shared-types ./packages/shared-types
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
