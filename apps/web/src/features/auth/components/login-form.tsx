'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { loginSchema, type LoginFormValues } from '../schemas';

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const result = await login(values.email, values.password);
      if (result.requiresTwoFactor) {
        router.push(`/2fa?challenge=${encodeURIComponent(result.challengeToken!)}`);
      } else {
        router.push('/');
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Échec de connexion.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
      noValidate
    >
      <div>
        <h1 className="text-lg font-semibold text-foreground">Connexion</h1>
        <p className="mt-1 text-sm text-muted-foreground">Accédez à votre espace DONDY ELEVAGE.</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" autoComplete="username" {...register('email')} />
        {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="login-password">Mot de passe</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Connexion…' : 'Se connecter'}
      </Button>

      <Link href="/mot-de-passe-oublie" className="text-center text-sm text-primary hover:underline">
        Mot de passe oublié ?
      </Link>
    </form>
  );
}
