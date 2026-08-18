import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    // Fixe explicitement la racine de résolution Turbopack sur la racine du
    // monorepo, plutôt que de dépendre de sa détection automatique — tentative
    // ciblée pour le blocage de résolution CSS documenté dans
    // docs/architecture/README.md (section "Blocage non résolu").
    root: path.join(import.meta.dirname, '..', '..'),
  },
};

export default nextConfig;
