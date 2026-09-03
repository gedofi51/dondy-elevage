'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, ShoppingCart, ClipboardList, CircleX } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import {
  useLayerBatch,
  useLayerBatchPerformanceScore,
  useLayerBatchProfitability,
  useLayerDailyRecords,
  useLayerHealthEvents,
} from '@/features/layer-batches/hooks';
import { PerformanceScoreCard } from '@/features/performance-score/components/performance-score-card';
import { useEggStockLots } from '@/features/egg-stock/hooks';
import { useSalesByLayerBatch } from '@/features/sales/hooks';
import { layerBatchStatusConfig } from '@/features/layer-batches/components/layer-batch-table';
import { computeCurrentAgeWeeks } from '@/features/layer-batches/age';
import { DailyRecordsTable } from '@/features/layer-batches/components/daily-records-table';
import { HealthEventTable } from '@/features/layer-batches/components/health-event-table';
import { HealthEventCreateDialog } from '@/features/layer-batches/components/health-event-create-dialog';
import { EggStockLotTable } from '@/features/egg-stock/components/egg-stock-lot-table';
import { EggStockMovementCreateDialog } from '@/features/egg-stock/components/egg-stock-movement-create-dialog';
import { EntityAlertsWidget } from '@/components/shared/entity-alerts-widget';
import { QrCodePanel } from '@/features/qr-codes/components/qr-code-panel';
import { SaleTable } from '@/features/sales/components/sale-table';
import { ClosureDialog } from '@/features/layer-batches/components/closure-dialog';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LayerBatchDetailView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useLayerBatch(batchId);
  const { data: profitability } = useLayerBatchProfitability(batchId);
  const { data: performanceScore } = useLayerBatchPerformanceScore(batchId);
  const { data: dailyRecords, isLoading: dailyLoading } = useLayerDailyRecords(batchId);
  const { data: healthEvents, isLoading: healthLoading } = useLayerHealthEvents(batchId);
  const { data: eggStockLots, isLoading: eggStockLoading } = useEggStockLots(batchId);
  const { data: sales, isLoading: salesLoading } = useSalesByLayerBatch(batchId);

  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const canEnterToday = batch.status === 'ELEVAGE' || batch.status === 'PONTE';
  // Garde client sur Modifier ET Clôturer — LayerBatchesService.close() ne
  // vérifie jamais le statut courant côté serveur, et un statut terminal
  // (CLOTURE/ANNULEE) est hors de LAYER_BATCH_EDITABLE_STATUSES : ouvrir le
  // formulaire de modification sur un lot déjà terminal bloque
  // silencieusement l'enregistrement (Select statut vide, aucune valeur
  // valide à soumettre) — trouvé en vérification manuelle, corrigé en
  // empêchant d'y accéder plutôt qu'en autorisant un état invalide.
  const isBatchOpen = batch.status !== 'CLOTURE' && batch.status !== 'ANNULEE';
  // findAll (backend) trie par date croissante — le dernier élément est la
  // journée la plus récente, sans fetch supplémentaire (liste déjà chargée
  // pour l'onglet Suivi journalier).
  const records = dailyRecords ?? [];
  const latestRecord = records[records.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={batch.code}
        description={`Entrée le ${new Date(batch.entryDate).toLocaleDateString('fr-FR')}${
          batch.strain ? ` · ${batch.strain}` : ''
        }`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={layerBatchStatusConfig[batch.status].label}
              tone={layerBatchStatusConfig[batch.status].tone}
            />
            <Can permission={PERMISSIONS.LAYER_DAILY_RECORDS_READ}>
              {canEnterToday ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/pondeuses/${batchId}/suivi/${todayIsoDate()}`} />}
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Saisir aujourd’hui
                </Button>
              ) : (
                <Button variant="outline" disabled title="Lot clôturé ou annulé">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Saisir aujourd’hui
                </Button>
              )}
            </Can>
            <Can permission={PERMISSIONS.SALES_CREATE}>
              <Button nativeButton={false} render={<Link href={`/pondeuses/${batchId}/vendre`} />}>
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Vendre
              </Button>
            </Can>
            <Can permission={PERMISSIONS.LAYER_BATCHES_UPDATE}>
              {isBatchOpen ? (
                <Button
                  variant="outline"
                  size="icon"
                  nativeButton={false}
                  render={<Link href={`/pondeuses/${batchId}/modifier`} />}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </Can>
            <Can permission={PERMISSIONS.LAYER_BATCHES_CLOSE}>
              {isBatchOpen ? (
                <Button variant="outline" onClick={() => setClosureDialogOpen(true)}>
                  <CircleX className="h-4 w-4" aria-hidden="true" />
                  Clôturer
                </Button>
              ) : null}
            </Can>
          </div>
        }
      />

      <EntityAlertsWidget entityId={batchId} />
      <QrCodePanel
        apiSegment="layer-batches"
        entityId={batchId}
        readPermission={PERMISSIONS.LAYER_BATCHES_READ}
        updatePermission={PERMISSIONS.LAYER_BATCHES_UPDATE}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Effectif actuel" value={batch.currentHeadcount} unit="poules" />
        <KpiCard label="Âge" value={computeCurrentAgeWeeks(batch.entryDate, batch.ageAtEntryWeeks, batch.ageAtEntryDays)} unit="sem." />
        <KpiCard
          label="Taux de ponte actuel"
          value={latestRecord?.layingRatePercent != null ? `${latestRecord.layingRatePercent} %` : '—'}
        />
      </div>

      {profitability ? (
        <Card>
          <CardHeader>
            <CardTitle>Rentabilité</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <span className="text-muted-foreground">Coût total</span>
            <span className="text-right sm:col-span-3">
              {profitability.finances.totalExpensesFcfa.toLocaleString('fr-FR')} FCFA
            </span>
            <span className="text-muted-foreground">Chiffre d’affaires</span>
            <span className="text-right sm:col-span-3">
              {profitability.finances.revenueFcfa.toLocaleString('fr-FR')} FCFA
            </span>
            <span className="text-muted-foreground">Marge brute</span>
            <span className="text-right sm:col-span-3">
              {profitability.finances.grossMarginFcfa.toLocaleString('fr-FR')} FCFA
            </span>
            <span className="text-muted-foreground">Coût par œuf</span>
            <span className="text-right sm:col-span-3">
              {profitability.finances.costPerEggFcfa.toFixed(2)} FCFA
            </span>
          </CardContent>
        </Card>
      ) : null}

      {performanceScore ? <PerformanceScoreCard score={performanceScore} /> : null}

      <Tabs defaultValue="suivi">
        <TabsList>
          <TabsTrigger value="suivi">Suivi journalier</TabsTrigger>
          <TabsTrigger value="sante">Santé</TabsTrigger>
          <TabsTrigger value="stock">Stock d’œufs</TabsTrigger>
          <TabsTrigger value="ventes">Ventes</TabsTrigger>
        </TabsList>

        <TabsContent value="suivi">
          <Can permission={PERMISSIONS.LAYER_DAILY_RECORDS_READ} fallback={<PermissionFallback />}>
            <DailyRecordsTable batchId={batchId} data={dailyRecords} isLoading={dailyLoading} />
          </Can>
        </TabsContent>

        <TabsContent value="sante">
          <Can permission={PERMISSIONS.LAYER_HEALTH_EVENTS_READ} fallback={<PermissionFallback />}>
            <div className="flex flex-col gap-3">
              <Can permission={PERMISSIONS.LAYER_HEALTH_EVENTS_CREATE}>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setHealthDialogOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Ajouter
                  </Button>
                </div>
              </Can>
              <HealthEventTable data={healthEvents} isLoading={healthLoading} />
            </div>
          </Can>
        </TabsContent>

        <TabsContent value="stock">
          <Can permission={PERMISSIONS.EGG_STOCK_LOTS_READ} fallback={<PermissionFallback />}>
            <div className="flex flex-col gap-3">
              <Can permission={PERMISSIONS.EGG_STOCK_MOVEMENTS_CREATE}>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setMovementDialogOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Déclarer une perte
                  </Button>
                </div>
              </Can>
              <EggStockLotTable data={eggStockLots} isLoading={eggStockLoading} />
            </div>
          </Can>
        </TabsContent>

        <TabsContent value="ventes">
          <SaleTable data={sales} isLoading={salesLoading} />
        </TabsContent>
      </Tabs>

      <HealthEventCreateDialog batchId={batchId} open={healthDialogOpen} onOpenChange={setHealthDialogOpen} />
      <EggStockMovementCreateDialog
        batchId={batchId}
        lots={eggStockLots ?? []}
        open={movementDialogOpen}
        onOpenChange={setMovementDialogOpen}
      />
      <ClosureDialog batchId={batchId} open={closureDialogOpen} onOpenChange={setClosureDialogOpen} />
    </div>
  );
}

function PermissionFallback() {
  return <p className="text-sm text-muted-foreground">Non disponible avec votre rôle actuel.</p>;
}
