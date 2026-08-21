'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api/client';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../schemas';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordFormValues) {
    // Réponse identique que l'email existe ou non (anti-énumération côté
    // API) — on l'affiche telle quelle, jamais de distinction ici.
    await apiFetch('/auth/mot-de-passe-oublie', null, { method: 'POST', body: values });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-foreground">Si ce compte existe, un email a été envoyé.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      noValidate
    >
      <div>
        <h1 className="text-lg font-semibold text-foreground">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indiquez votre email pour recevoir un lien de réinitialisation.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="forgot-email">Email</Label>
        <Input id="forgot-email" type="email" autoComplete="username" {...register('email')} />
        {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Envoi…' : 'Envoyer le lien'}
      </Button>
    </form>
  );
}
