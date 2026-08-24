'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBatchLineageByChild } from '../hooks';
import { useIncubationBatch } from '@/features/incubation-batches/hooks';
import { useBreederBatch } from '@/features/breeder-batches/hooks';

/** Filiation "aval" — remonte d'un lot orienté (bande de chair née d'une
 * orientation, ou lot de poussins) jusqu'à son lot reproducteur d'origine.
 * Aucun endpoint agrégé côté API (voir DETTE_TECHNIQUE.md Phase 13) : 3 GET
 * orchestrés ici (batch-lineage → incubation-batches → breeder-batches).
 * Ne rend rien tant que la ligne de filiation n'est pas trouvée (silencieux,
 * pas d'état d'erreur — un lot sans origine orientée n'est pas une erreur). */
export function OriginCard({
  childType,
  childId,
}: {
  childType: 'broiler_batch' | 'chick_batch';
  childId: string;
}) {
  const { data: lineageRows } = useBatchLineageByChild(childType, childId);
  const lineage = lineageRows?.[0];
  const { data: incubationBatch } = useIncubationBatch(lineage?.incubationBatchId ?? '');
  const { data: breederBatch } = useBreederBatch(incubationBatch?.breederBatchId ?? '');

  if (!lineage) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Origine</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 text-sm">
        {breederBatch ? (
          <Link href={`/reproducteurs/${breederBatch.id}`} className="font-medium text-primary hover:underline">
            {breederBatch.code}
          </Link>
        ) : (
          <span className="text-muted-foreground">…</span>
        )}
        <span className="text-muted-foreground">→</span>
        {incubationBatch ? (
          <Link href={`/couvoir/${incubationBatch.id}`} className="font-medium text-primary hover:underline">
            {incubationBatch.code}
          </Link>
        ) : (
          <span className="text-muted-foreground">…</span>
        )}
        <span className="text-muted-foreground">→ ce lot ({lineage.quantity.toLocaleString('fr-FR')} poussins)</span>
      </CardContent>
    </Card>
  );
}
