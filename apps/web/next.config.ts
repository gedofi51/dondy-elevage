import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // @dondy-elevage/shared-types n'a pas d'étape de build (TS brut, voir
  // packages/shared-types/package.json) — nécessaire pour que Turbopack le
  // transpile au lieu de le traiter comme du JS déjà prêt à l'emploi.
  transpilePackages: ['@dondy-elevage/shared-types'],
  turbopack: {
    // Fixe explicitement la racine de résolution Turbopack sur la racine du
    // monorepo, plutôt que de dépendre de sa détection automatique — tentative
    // ciblée pour le blocage de résolution CSS documenté dans
    // docs/architecture/README.md (section "Blocage non résolu").
    root: path.join(import.meta.dirname, '..', '..'),
  },
};

export default nextConfig;
