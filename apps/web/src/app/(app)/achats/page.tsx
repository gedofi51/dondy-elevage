'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { usePurchaseOrders } from '@/features/purchase-orders/hooks';
import { PurchaseOrderTable } from '@/features/purchase-orders/components/purchase-order-table';

const ACTIVE_STATUSES = new Set(['BROUILLON', 'COMMANDE', 'PARTIELLEMENT_RECU']);

export default function PurchaseOrdersListPage() {
  const { data, isLoading } = usePurchaseOrders();
  const [filter, setFilter] = useState<'actifs' | 'tous'>('actifs');

  // GET /purchase-orders n'a aucun filtre/pagination serveur (même gap
  // que les autres listes du projet, voir DETTE_TECHNIQUE.md).
  const filtered = filter === 'actifs' ? data?.filter((o) => ACTIVE_STATUSES.has(o.status)) : data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Achats"
        description="Commandes fournisseurs, de la création au paiement."
        action={
          <Can permission={PERMISSIONS.PURCHASE_ORDERS_CREATE}>
            <Button nativeButton={false} render={<Link href="/achats/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouvelle commande
            </Button>
          </Can>
        }
      />

      <div className="flex gap-2">
        <Button
          variant={filter === 'actifs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('actifs')}
        >
          Actifs
        </Button>
        <Button
          variant={filter === 'tous' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('tous')}
        >
          Tous
        </Button>
      </div>

      <PurchaseOrderTable data={filtered} isLoading={isLoading} />
    </div>
  );
}
