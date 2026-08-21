import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DONDY ELEVAGE',
  description: 'Gestion de ferme avicole — Samba, République centrafricaine',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
