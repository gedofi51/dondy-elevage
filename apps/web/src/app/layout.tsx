import type { Metadata } from 'next';
import { Geist_Mono, Instrument_Sans, Newsreader } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

// Polices variables (voir docs/architecture/DESIGN_SYSTEM.md) : pas de
// `weight` fixé — tenté en plage ("400 600"/"400 700") pour ne charger
// que les poids réellement utilisés, mais next/font/google la refuse
// pour ces deux polices ("Unknown weight ... Available weights: 400,
// 500, 600, 700, variable" — la syntaxe plage documentée ne s'applique
// qu'aux polices variables continues type Inter, pas à des paliers
// discrets) ; seul `weight: 'variable'` ou son omission (équivalente,
// c'est la valeur par défaut) fonctionnent ici — un seul fichier
// couvrant tous les poids, plus léger que des instances statiques par
// poids. `axes` non précisé donc seul `wght` est chargé (exclut l'axe
// optique `opsz` de Newsreader, inutile ici) ; `subsets: ['latin']`
// seul — contexte bande passante limitée (Samba,
// PERFORMANCE_ET_CONNECTIVITE.md). Poids mesurés après build :
// docs/architecture/DESIGN_SYSTEM.md.
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  display: 'swap',
});

const instrumentSans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DONDY ELEVAGE',
  description: 'Gestion de ferme avicole — Samba, République centrafricaine',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="fr"
      className={`${newsreader.variable} ${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Découpé en groupes de routes (app)/(auth) en Phase 9 — le
            chrome applicatif (AppShell) vit désormais dans (app)/layout.tsx,
            pas ici : les pages (auth) (connexion...) n'en ont pas besoin. */}
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
