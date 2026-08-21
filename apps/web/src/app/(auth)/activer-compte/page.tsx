'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SetPasswordForm } from '@/features/auth/components/set-password-form';

function ActiverCompteContent() {
  const token = useSearchParams().get('token');

  if (!token) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Lien d&apos;activation invalide ou incomplet.
      </p>
    );
  }

  return <SetPasswordForm token={token} mode="activate" />;
}

export default function ActiverComptePage() {
  return (
    <Suspense fallback={null}>
      <ActiverCompteContent />
    </Suspense>
  );
}
