'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ShoppingCart, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { EntityAlertsWidget } from '@/components/shared/entity-alerts-widget';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { PERMISSIONS, type PurchaseOrderItemWithComputed, type SupplierPayment } from '@dondy-elevage/shared-types';
import { usePurchaseOrder, useGoodsReceipts, useUpdatePurchaseOrder } from '@/features/purchase-orders/hooks';
import { purchaseOrderStatusConfig } from '@/features/purchase-orders/components/purchase-order-table';
import { ReceiptsTable } from '@/features/purchase-orders/components/receipts-table';
import { useSupplierPayments, useDeleteSupplierPayment } from '@/features/supplier-payments/hooks';
import { SupplierPaymentTable } from '@/features/supplier-payments/components/supplier-payment-table';
import { useSuppliers } from '@/features/suppliers/hooks';
import { useItems } from '@/features/items/hooks';

export function PurchaseOrderDetailView({ orderId }: { orderId: string }) {
  const { data: order, isLoading } = usePurchaseOrder(orderId);
  const { data: suppliers } = useSuppliers();
  const { data: items } = useItems();
  const { data: receipts, isLoading: receiptsLoading } = useGoodsReceipts(orderId);
  const { data: payments, isLoading: paymentsLoading } = useSupplierPayments(orderId);
  const confirmMutation = useUpdatePurchaseOrder(orderId);
  const deletePaymentMutation = useDeleteSupplierPayment(orderId);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<SupplierPayment | null>(null);

  if (isLoading || !order) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const supplierName = suppliers?.find((s) => s.id === order.supplierId)?.name ?? '—';
  const itemNamesById = new Map((items ?? []).map((i) => [i.id, i.name]));

  // Boutons calqués sur les gardes réelles (Confirmer : vraie garde
  // serveur 409) ou une décision UX documentée (Réceptionner : le
  // serveur accepte techniquement BROUILLON, mais le cycle documenté —
  // docs/reference/ACHATS_ET_FOURNISSEURS.md — n'a de sens qu'après
  // confirmation ; voir DETTE_TECHNIQUE.md Phase 14).
  const canConfirm = order.status === 'BROUILLON';
  const canReceive = order.status === 'COMMANDE' || order.status === 'PARTIELLEMENT_RECU';
  const canPay = order.status !== 'ANNULE' && order.balanceFcfa > 0;

  async function handleConfirm() {
    try {
      await confirmMutation.mutateAsync({ status: 'COMMANDE' });
      toast.success('Commande confirmée.');
    } catch {
      toast.error('Échec de la confirmation.');
    } finally {
      setConfirmDialogOpen(false);
    }
  }

  async function handleDeletePayment() {
    if (!paymentToDelete) return;
    try {
      await deletePaymentMutation.mutateAsync(paymentToDelete.id);
      toast.success('Paiement supprimé.');
    } catch {
      toast.error('Échec de la suppression.');
    } finally {
      setPaymentToDelete(null);
    }
  }

  const itemColumns: DataTableColumn<PurchaseOrderItemWithComputed>[] = [
    { key: 'item', header: 'Article', render: (l) => itemNamesById.get(l.itemId) ?? l.itemId },
    { key: 'ordered', header: 'Commandé', render: (l) => Number(l.orderedQuantity).toLocaleString('fr-FR') },
    { key: 'received', header: 'Reçu', render: (l) => l.receivedQuantity.toLocaleString('fr-FR') },
    {
      key: 'discrepancy',
      header: 'Écart',
      render: (l) =>
        l.discrepancy === 0 ? (
          '—'
        ) : (
          <span className={l.discrepancy < 0 ? 'text-warning' : 'text-info'}>
            {l.discrepancy > 0 ? '+' : ''}
            {l.discrepancy.toLocaleString('fr-FR')}
          </span>
        ),
    },
    { key: 'unitPrice', header: 'Prix unitaire', render: (l) => `${l.unitPriceFcfa.toLocaleString('fr-FR')} FCFA` },
    { key: 'lineAmount', header: 'Montant', render: (l) => `${l.lineAmountFcfa.toLocaleString('fr-FR')} FCFA` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={order.code}
        description={`${supplierName} · commandé le ${new Date(order.date).toLocaleDateString('fr-FR')}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={purchaseOrderStatusConfig[order.status].label} tone={purchaseOrderStatusConfig[order.status].tone} />
            <Can permission={PERMISSIONS.PURCHASE_ORDERS_UPDATE}>
              {canConfirm ? (
                <Button variant="outline" onClick={() => setConfirmDialogOpen(true)}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Confirmer la commande
                </Button>
              ) : null}
            </Can>
            <Can permission={PERMISSIONS.GOODS_RECEIPTS_CREATE}>
              {canReceive ? (
                <Button variant="outline" nativeButton={false} render={<Link href={`/achats/${orderId}/receptionner`} />}>
                  <Truck className="h-4 w-4" aria-hidden="true" />
                  Réceptionner
                </Button>
              ) : null}
            </Can>
            <Can permission={PERMISSIONS.SUPPLIER_PAYMENTS_CREATE}>
              {canPay ? (
                <Button nativeButton={false} render={<Link href={`/achats/${orderId}/payer`} />}>
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Payer
                </Button>
              ) : null}
            </Can>
          </div>
        }
      />

      <EntityAlertsWidget entityId={orderId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Montant total" value={order.totalAmountFcfa.toLocaleString('fr-FR')} unit="FCFA" />
        <KpiCard label="Déjà payé" value={order.paidAmountFcfa.toLocaleString('fr-FR')} unit="FCFA" />
        <KpiCard
          label="Solde restant"
          value={order.balanceFcfa.toLocaleString('fr-FR')}
          unit="FCFA"
          tone={order.balanceFcfa > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold text-primary">Lignes</h2>
        <DataTable columns={itemColumns} data={order.items} isLoading={false} getRowKey={(l) => l.id} />
      </div>

      <Tabs defaultValue="receptions">
        <TabsList>
          <TabsTrigger value="receptions">Réceptions</TabsTrigger>
          <TabsTrigger value="paiements">Paiements</TabsTrigger>
        </TabsList>

        <TabsContent value="receptions">
          <Can permission={PERMISSIONS.GOODS_RECEIPTS_READ} fallback={<PermissionFallback />}>
            <ReceiptsTable data={receipts} isLoading={receiptsLoading} />
          </Can>
        </TabsContent>

        <TabsContent value="paiements">
          <Can permission={PERMISSIONS.SUPPLIER_PAYMENTS_READ} fallback={<PermissionFallback />}>
            <SupplierPaymentTable
              data={payments}
              isLoading={paymentsLoading}
              rowActions={(payment) => (
                <Can permission={PERMISSIONS.SUPPLIER_PAYMENTS_DELETE}>
                  <Button variant="outline" size="icon" onClick={() => setPaymentToDelete(payment)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Can>
              )}
            />
          </Can>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handleConfirm}
        title="Confirmer cette commande ?"
        description="Le statut passera de Brouillon à Commandé."
        confirmLabel="Confirmer"
        destructive={false}
      />
      <ConfirmDialog
        open={!!paymentToDelete}
        onOpenChange={(open) => !open && setPaymentToDelete(null)}
        onConfirm={handleDeletePayment}
        title="Supprimer ce paiement ?"
        description={paymentToDelete ? `${paymentToDelete.amountFcfa.toLocaleString('fr-FR')} FCFA seront retirés du solde payé.` : undefined}
        confirmLabel="Supprimer"
      />
    </div>
  );
}

function PermissionFallback() {
  return <p className="text-sm text-muted-foreground">Non disponible avec votre rôle actuel.</p>;
}
