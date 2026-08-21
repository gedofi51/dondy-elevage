import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const twoFactorSchema = z.object({
  code: z.string().length(6, 'Le code doit contenir 6 chiffres'),
});
export type TwoFactorFormValues = z.infer<typeof twoFactorSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Adresse email invalide'),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

// Mot de passe : 10 caractères minimum, alignés sur ActivateAccountDto/
// ResetPasswordDto côté API (MinLength(10)) — validation client, l'API
// reste seule autoritaire.
const passwordField = z.string().min(10, 'Le mot de passe doit contenir au moins 10 caractères');

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const activateAccountSchema = resetPasswordSchema;
export type ActivateAccountFormValues = z.infer<typeof activateAccountSchema>;
