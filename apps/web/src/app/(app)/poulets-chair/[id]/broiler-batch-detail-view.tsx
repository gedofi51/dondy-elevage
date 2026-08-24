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
  useBatchProfitability,
  useBroilerBatch,
  useDailyRecords,
  useHealthEvents,
  useMortalities,
} from '@/features/broiler-batches/hooks';
import { useSalesByBatch } from '@/features/sales/hooks';
import { broilerBatchStatusConfig } from '@/features/broiler-batches/components/broiler-batch-table';
import { DailyRecordsTable } from '@/features/broiler-batches/components/daily-records-table';
import { MortalityTable } from '@/features/broiler-batches/components/mortality-table';
import { MortalityCreateDialog } from '@/features/broiler-batches/components/mortality-create-dialog';
import { HealthEventTable } from '@/features/broiler-batches/components/health-event-table';
import { HealthEventCreateDialog } from '@/features/broiler-batches/components/health-event-create-dialog';
import { SaleTable } from '@/features/sales/components/sale-table';
import { ClosureDialog } from '@/features/broiler-batches/components/closure-dialog';
import { computeDayNumber, isDayNumberInCycle } from '@/features/broiler-batches/day-number';
import { OriginCard } from '@/features/batch-lineage/components/origin-card';

export function BroilerBatchDetailView({ batchId }: { batchId: string }) {
  const { data: batch, isLoading } = useBroilerBatch(batchId);
  const { data: profitability } = useBatchProfitability(batchId);
  const { data: dailyRecords, isLoading: dailyLoading } = useDailyRecords(batchId);
  const { data: mortalities, isLoading: mortalityLoading } = useMortalities(batchId);
  const { data: healthEvents, isLoading: healthLoading } = useHealthEvents(batchId);
  const { data: sales, isLoading: salesLoading } = useSalesByBatch(batchId);

  const [mortalityDialogOpen, setMortalityDialogOpen] = useState(false);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const dayNumber = computeDayNumber(batch.arrivalDate);
  const dayInCycle = isDayNumberInCycle(dayNumber);
  // Garde client sur Modifier ET Clôturer — trouvé en vérification manuelle
  // Phase 12 (même défaut latent que sur la fiche Layer, corrigé au même
  // endroit) : un statut terminal (ANNULEE/CLOTUREE) est hors de
  // BROILER_BATCH_EDITABLE_STATUSES, donc ouvrir "Modifier" sur une bande
  // déjà terminale bloquait silencieusement l'enregistrement (Select
  // statut vide, aucune valeur valide à soumettre).
  const isBatchOpen = batch.status !== 'CLOTUREE' && batch.status !== 'ANNULEE';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={batch.code}
        description={`Arrivée le ${new Date(batch.arrivalDate).toLocaleDateString('fr-FR')}${
          batch.breed ? ` · ${batch.breed}` : ''
        }`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={broilerBatchStatusConfig[batch.status].label}
              tone={broilerBatchStatusConfig[batch.status].tone}
            />
            <Can permission={PERMISSIONS.BROILER_DAILY_RECORDS_READ}>
              {dayInCycle ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/poulets-chair/${batchId}/suivi/${dayNumber}`} />}
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Saisir aujourd’hui
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled
                  title={dayNumber < 1 ? 'Bande pas encore démarrée' : 'Cycle terminé — à clôturer'}
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Saisir aujourd’hui
                </Button>
              )}
            </Can>
            <Can permission={PERMISSIONS.SALES_CREATE}>
              <Button nativeButton={false} render={<Link href={`/poulets-chair/${batchId}/vendre`} />}>
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Vendre
              </Button>
            </Can>
            <Can permission={PERMISSIONS.BROILER_BATCHES_UPDATE}>
              {isBatchOpen ? (
                <Button
                  variant="outline"
                  size="icon"
                  nativeButton={false}
                  render={<Link href={`/poulets-chair/${batchId}/modifier`} />}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </Can>
            <Can permission={PERMISSIONS.BROILER_BATCHES_CLOSE}>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Effectif vivant" value={batch.currentHeadcount} unit="sujets" />
        <KpiCard label="Âge" value={dayInCycle ? `J${dayNumber}` : dayNumber < 1 ? '—' : 'J45+'} />
        <KpiCard
          label="Vente prévue"
          value={new Date(batch.plannedSaleDate).toLocaleDateString('fr-FR')}
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
            <span className="text-muted-foreground">IC (indice de consommation)</span>
            <span className="text-right sm:col-span-3">
              {profitability.performance.feedConversionRatio.toFixed(2)}
            </span>
          </CardContent>
        </Card>
      ) : null}

      {/* Filiation "aval" (§6.5, Phase 13) — uniquement pertinent pour une
          bande née d'une orientation de poussins, jamais pour un achat
          externe (évite un fetch batch-lineage inutile dans le cas
          courant). */}
      {batch.origin === 'NAISSANCE_INTERNE' ? (
        <Can permission={PERMISSIONS.BATCH_LINEAGE_READ}>
          <OriginCard childType="broiler_batch" childId={batchId} />
        </Can>
      ) : null}

      <Tabs defaultValue="suivi">
        <TabsList>
          <TabsTrigger value="suivi">Suivi quotidien</TabsTrigger>
          <TabsTrigger value="mortalite">Mortalité</TabsTrigger>
          <TabsTrigger value="sante">Santé</TabsTrigger>
          <TabsTrigger value="ventes">Ventes</TabsTrigger>
        </TabsList>

        <TabsContent value="suivi">
          <Can permission={PERMISSIONS.BROILER_DAILY_RECORDS_READ} fallback={<PermissionFallback />}>
            <DailyRecordsTable batchId={batchId} data={dailyRecords} isLoading={dailyLoading} />
          </Can>
        </TabsContent>

        <TabsContent value="mortalite">
          <Can permission={PERMISSIONS.BROILER_MORTALITY_READ} fallback={<PermissionFallback />}>
            <div className="flex flex-col gap-3">
              <Can permission={PERMISSIONS.BROILER_MORTALITY_CREATE}>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setMortalityDialogOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Déclarer
                  </Button>
                </div>
              </Can>
              <MortalityTable data={mortalities} isLoading={mortalityLoading} />
            </div>
          </Can>
        </TabsContent>

        <TabsContent value="sante">
          <Can permission={PERMISSIONS.BROILER_HEALTH_EVENTS_READ} fallback={<PermissionFallback />}>
            <div className="flex flex-col gap-3">
              <Can permission={PERMISSIONS.BROILER_HEALTH_EVENTS_CREATE}>
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

        <TabsContent value="ventes">
          <SaleTable data={sales} isLoading={salesLoading} />
        </TabsContent>
      </Tabs>

      <MortalityCreateDialog batchId={batchId} open={mortalityDialogOpen} onOpenChange={setMortalityDialogOpen} />
      <HealthEventCreateDialog batchId={batchId} open={healthDialogOpen} onOpenChange={setHealthDialogOpen} />
      <ClosureDialog batchId={batchId} open={closureDialogOpen} onOpenChange={setClosureDialogOpen} />
    </div>
  );
}

function PermissionFallback() {
  return <p className="text-sm text-muted-foreground">Non disponible avec votre rôle actuel.</p>;
}
