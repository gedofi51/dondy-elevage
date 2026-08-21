'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SetPasswordForm } from '@/features/auth/components/set-password-form';

function ReinitialiserMotDePasseContent() {
  const token = useSearchParams().get('token');

  if (!token) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Lien de réinitialisation invalide ou incomplet.
      </p>
    );
  }

  return <SetPasswordForm token={token} mode="reset" />;
}

export default function ReinitialiserMotDePassePage() {
  return (
    <Suspense fallback={null}>
      <ReinitialiserMotDePasseContent />
    </Suspense>
  );
}
