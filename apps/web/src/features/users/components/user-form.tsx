'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { PublicUser, Role } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRoles } from '@/features/roles/hooks';
import { useCreateUser, useUpdateUser } from '../hooks';
import {
  createUserSchema,
  editableUserStatusOptions,
  updateUserSchema,
  userStatusLabels,
  type CreateUserFormInput,
  type CreateUserFormValues,
  type UpdateUserFormInput,
  type UpdateUserFormValues,
} from '../schemas';

/** Sélection de rôle(s) — cases à cocher, pas un menu déroulant simple :
 * `roleIds` est un tableau côté API (ArrayMinSize(1), pas un maximum de
 * 1) — un utilisateur peut légitimement cumuler plusieurs rôles, reflété
 * tel quel plutôt que restreint arbitrairement à un choix unique. */
function RoleCheckboxGroup({
  roles,
  value,
  onChange,
  error,
}: {
  roles: Role[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  return (
    <div className="grid gap-1.5">
      <Label>Rôle(s)</Label>
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <label
            key={role.id}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <Checkbox checked={value.includes(role.id)} onCheckedChange={() => toggle(role.id)} />
            {role.name}
          </label>
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function UserForm({ user }: { user?: PublicUser }) {
  return user ? <EditUserForm user={user} /> : <CreateUserForm />;
}

/**
 * Création = invitation par email (voir CreateUserInput, shared-types) —
 * aucun champ mot de passe ici, jamais saisi par l'administrateur.
 */
function CreateUserForm() {
  const router = useRouter();
  const { data: roles } = useRoles();
  const createMutation = useCreateUser();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormInput, unknown, CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '', name: '', roleIds: [] },
  });

  async function onSubmit(values: CreateUserFormValues) {
    try {
      await createMutation.mutateAsync(values);
      toast.success('Invitation envoyée — l’utilisateur définira son mot de passe en cliquant sur le lien reçu par email.');
      router.push('/utilisateurs');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la création — vérifiez les champs.')
          : 'Échec de la création — vérifiez les champs.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <p className="text-xs text-muted-foreground">
        Aucun mot de passe à saisir : un email d’invitation est envoyé à l’adresse indiquée,
        l’utilisateur définit lui-même son mot de passe en l’ouvrant.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="user-name">Nom</Label>
          <Input id="user-name" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="user-email">Email</Label>
          <Input id="user-email" type="email" autoComplete="off" {...register('email')} />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>
      </div>

      <Controller
        name="roleIds"
        control={control}
        render={({ field }) => (
          <RoleCheckboxGroup
            roles={roles ?? []}
            value={field.value}
            onChange={field.onChange}
            error={errors.roleIds?.message}
          />
        )}
      />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Envoi…' : 'Envoyer l’invitation'}
      </Button>
    </form>
  );
}

function EditUserForm({ user }: { user: PublicUser }) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const isSelf = currentUser?.sub === user.id;
  const { data: roles } = useRoles();
  const updateMutation = useUpdateUser(user.id);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserFormInput, unknown, UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user.name,
      status: user.status,
      roleIds: user.userRoles.map((ur) => ur.role.id),
    },
  });

  async function onSubmit(values: UpdateUserFormValues) {
    try {
      await updateMutation.mutateAsync(values);
      toast.success('Utilisateur modifié.');
      router.push('/utilisateurs');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement — vérifiez les champs.')
          : 'Échec de l’enregistrement — vérifiez les champs.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="user-name">Nom</Label>
          <Input id="user-name" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label>Email</Label>
          <Input value={user.email} disabled />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="user-status">Statut</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
              <SelectTrigger id="user-status">
                <SelectValue>{(value: (typeof editableUserStatusOptions)[number]) => userStatusLabels[value]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {editableUserStatusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {userStatusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {isSelf ? (
          <p className="text-xs text-muted-foreground">
            Vous ne pouvez pas modifier le statut de votre propre compte.
          </p>
        ) : null}
      </div>

      <Controller
        name="roleIds"
        control={control}
        render={({ field }) => (
          <RoleCheckboxGroup
            roles={roles ?? []}
            value={field.value}
            onChange={field.onChange}
            error={errors.roleIds?.message}
          />
        )}
      />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
