'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Block } from '@dondy-elevage/shared-types';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateBlock, useUpdateBlock } from '../hooks';
import {
  createBlockSchema,
  updateBlockSchema,
  type CreateBlockFormInput,
  type CreateBlockFormValues,
  type UpdateBlockFormInput,
  type UpdateBlockFormValues,
} from '../schemas';

/** buildingId connu du contexte (fiche du bâtiment déjà ouverte) — jamais
 * dans le schéma Zod, injecté au payload à la soumission (même patron que
 * MaintenancePlanForm/assetId). Non modifiable en édition (absent
 * d'UpdateBlockDto côté API) — voir DETTE_TECHNIQUE.md. */
export function BlockForm({
  buildingId,
  block,
  onSuccess,
}: {
  buildingId: string;
  block?: Block;
  onSuccess?: () => void;
}) {
  return block ? (
    <EditBlockForm block={block} onSuccess={onSuccess} />
  ) : (
    <CreateBlockForm buildingId={buildingId} onSuccess={onSuccess} />
  );
}

function CreateBlockForm({ buildingId, onSuccess }: { buildingId: string; onSuccess?: () => void }) {
  const createMutation = useCreateBlock();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateBlockFormInput, unknown, CreateBlockFormValues>({
    resolver: zodResolver(createBlockSchema),
  });

  async function onSubmit(values: CreateBlockFormValues) {
    try {
      await createMutation.mutateAsync({ buildingId, ...values, code: values.code || undefined });
      toast.success('Bloc créé.');
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la création.')
          : 'Échec de la création.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="block-name">Nom</Label>
        <Input id="block-name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="block-code">Code (optionnel)</Label>
        <Input id="block-code" {...register('code')} />
        {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Créer le bloc'}
      </Button>
    </form>
  );
}

function EditBlockForm({ block, onSuccess }: { block: Block; onSuccess?: () => void }) {
  const updateMutation = useUpdateBlock(block.id);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateBlockFormInput, unknown, UpdateBlockFormValues>({
    resolver: zodResolver(updateBlockSchema),
    defaultValues: { name: block.name, code: block.code ?? '' },
  });

  async function onSubmit(values: UpdateBlockFormValues) {
    try {
      await updateMutation.mutateAsync({ ...values, code: values.code || undefined });
      toast.success('Bloc modifié.');
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de l’enregistrement.')
          : 'Échec de l’enregistrement.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="block-name">Nom</Label>
        <Input id="block-name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="block-code">Code (optionnel)</Label>
        <Input id="block-code" {...register('code')} />
        {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  );
}
