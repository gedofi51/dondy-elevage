'use client';

/**
 * Exemple minimal React Hook Form + Zod, sans logique métier réelle.
 * Sert de gabarit pour les formulaires des phases suivantes (auth, users...).
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const exampleFormSchema = z.object({
  name: z.string().min(2, '2 caractères minimum'),
  email: z.string().email('Adresse email invalide'),
});

type ExampleFormValues = z.infer<typeof exampleFormSchema>;

export function ExampleForm() {
  const [submitted, setSubmitted] = useState<ExampleFormValues | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExampleFormValues>({
    resolver: zodResolver(exampleFormSchema),
  });

  return (
    <form
      onSubmit={handleSubmit((values) => setSubmitted(values))}
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-card p-6"
      noValidate
    >
      <div className="grid gap-1.5">
        <Label htmlFor="example-name">Nom</Label>
        <Input id="example-name" placeholder="Jean Dondy" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="example-email">Email</Label>
        <Input
          id="example-email"
          type="email"
          placeholder="jean@dondy-elevage.cf"
          {...register('email')}
        />
        {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
      </div>

      <Button type="submit">Valider (exemple)</Button>

      {submitted ? (
        <p className="text-sm text-success">
          Formulaire valide : {submitted.name} ({submitted.email})
        </p>
      ) : null}
    </form>
  );
}
