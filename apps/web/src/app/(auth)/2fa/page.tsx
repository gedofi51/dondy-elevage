'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TwoFactorForm } from '@/features/auth/components/two-factor-form';

function TwoFactorPageContent() {
  const searchParams = useSearchParams();
  const challengeToken = searchParams.get('challenge');

  if (!challengeToken) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Session de connexion introuvable — recommencez la connexion.
      </p>
    );
  }

  return <TwoFactorForm challengeToken={challengeToken} />;
}

export default function TwoFactorPage() {
  return (
    <Suspense fallback={null}>
      <TwoFactorPageContent />
    </Suspense>
  );
}
