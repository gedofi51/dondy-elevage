'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';

function OauthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { completeOauthCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const requiresTwoFactor = searchParams.get('requiresTwoFactor') === '1';
  const challengeToken = searchParams.get('challengeToken');
  const accessToken = searchParams.get('accessToken');
  const refreshToken = searchParams.get('refreshToken');
  const missingTokens = !requiresTwoFactor && (!accessToken || !refreshToken);

  useEffect(() => {
    if (handled.current || missingTokens) return;
    handled.current = true;

    if (requiresTwoFactor) {
      // Nettoie la barre d'adresse immédiatement (tokens/challenge jamais
      // laissés dans l'historique) avant de poursuivre vers /2fa.
      router.replace(challengeToken ? `/2fa?challenge=${encodeURIComponent(challengeToken)}` : '/connexion');
      return;
    }

    completeOauthCallback(accessToken!, refreshToken!)
      .then(() => router.replace('/'))
      .catch(() => setError('Échec de la connexion via le fournisseur externe.'));
  }, [requiresTwoFactor, challengeToken, accessToken, refreshToken, missingTokens, router, completeOauthCallback]);

  if (missingTokens) {
    return (
      <p className="text-center text-sm text-destructive">
        Connexion via le fournisseur externe incomplète.
      </p>
    );
  }
  if (error) {
    return <p className="text-center text-sm text-destructive">{error}</p>;
  }
  return <p className="text-center text-sm text-muted-foreground">Connexion en cours…</p>;
}

export default function OauthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OauthCallbackContent />
    </Suspense>
  );
}
