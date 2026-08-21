'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { twoFactorSchema, type TwoFactorFormValues } from '../schemas';

export function TwoFactorForm({ challengeToken }: { challengeToken: string }) {
  const { verifyTwoFactor } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TwoFactorFormValues>({ resolver: zodResolver(twoFactorSchema) });

  async function onSubmit(values: TwoFactorFormValues) {
    setServerError(null);
    try {
      await verifyTwoFactor(challengeToken, values.code);
      router.push('/');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Code invalide.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      noValidate
    >
      <div>
        <h1 className="text-lg font-semibold text-foreground">Vérification en deux étapes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saisissez le code à 6 chiffres de votre application d&apos;authentification.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="2fa-code">Code</Label>
        <Input
          id="2fa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          {...register('code')}
        />
        {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
      </div>

      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Vérification…' : 'Valider'}
      </Button>
    </form>
  );
}
