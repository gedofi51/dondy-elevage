'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, ApiError } from '@/lib/api/client';
import { resetPasswordSchema, type ResetPasswordFormValues } from '../schemas';

interface SetPasswordFormProps {
  token: string;
  mode: 'activate' | 'reset';
}

const config = {
  activate: {
    endpoint: '/auth/activer-compte',
    title: 'Activation du compte',
    description: 'Choisissez votre mot de passe pour activer votre compte.',
    submitLabel: 'Activer le compte',
  },
  reset: {
    endpoint: '/auth/reinitialiser-mot-de-passe',
    title: 'Réinitialisation du mot de passe',
    description: 'Choisissez un nouveau mot de passe.',
    submitLabel: 'Réinitialiser',
  },
} as const;

/** Partagé entre activer-compte et réinitialiser-mot-de-passe : même
 * forme (token + mot de passe + confirmation), seuls l'endpoint et les
 * libellés diffèrent (ActivateAccountDto/ResetPasswordDto côté API). */
export function SetPasswordForm({ token, mode }: SetPasswordFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });
  const { endpoint, title, description, submitLabel } = config[mode];

  async function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null);
    try {
      await apiFetch(endpoint, null, {
        method: 'POST',
        body: { token, password: values.password },
      });
      router.push('/connexion');
    } catch (err) {
      setServerError(err instanceof ApiError ? extractMessage(err.body) : 'Une erreur est survenue.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      noValidate
    >
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="set-password">Mot de passe</Label>
        <Input id="set-password" type="password" autoComplete="new-password" {...register('password')} />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="set-password-confirm">Confirmer le mot de passe</Label>
        <Input
          id="set-password-confirm"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword ? (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Envoi…' : submitLabel}
      </Button>
    </form>
  );
}

function extractMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(' ');
  }
  return 'Une erreur est survenue.';
}
