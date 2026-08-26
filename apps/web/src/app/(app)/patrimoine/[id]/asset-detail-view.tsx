'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Plus, RotateCcw, Trash2, Waves, Sun, Wifi, Wrench } from 'lucide-react';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { EntityAlertsWidget } from '@/components/shared/entity-alerts-widget';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useAsset, useDeleteAsset, useDepreciationEntries } from '@/features/assets/hooks';
import { assetCategoryLabels, type AssetCategory } from '@/features/assets/schemas';
import { assetStatusConfig } from '@/features/assets/components/asset-table';
import { DepreciationEntriesTable } from '@/features/assets/components/depreciation-entries-table';
import { ReformAssetDialog } from '@/features/assets/components/reform-asset-dialog';
import {
  useMaintenanceInterventions,
  useMaintenancePlans,
  useMaintenanceTasks,
} from '@/features/maintenance/hooks';
import { MaintenanceTaskTable } from '@/features/maintenance/components/maintenance-task-table';
import { MaintenancePlanCreateDialog } from '@/features/maintenance/components/maintenance-plan-create-dialog';
import { MaintenanceTaskCreateDialog } from '@/features/maintenance/components/maintenance-task-create-dialog';
import { MaintenanceInterventionCreateDialog } from '@/features/maintenance/components/maintenance-intervention-create-dialog';
import { MaintenanceInterventionsTable } from '@/features/maintenance/components/maintenance-interventions-table';
import { CancelTaskDialog } from '@/features/maintenance/components/cancel-task-dialog';
import {
  useNetworkStatusReadings,
  useSolarInfrastructureReadings,
  useWaterInfrastructureReadings,
} from '@/features/infrastructure/hooks';
import { WaterReadingTable } from '@/features/infrastructure/components/water-reading-table';
import { WaterReadingCreateDialog } from '@/features/infrastructure/components/water-reading-create-dialog';
import { SolarReadingTable } from '@/features/infrastructure/components/solar-reading-table';
import { SolarReadingCreateDialog } from '@/features/infrastructure/components/solar-reading-create-dialog';
import { NetworkReadingTable } from '@/features/infrastructure/components/network-reading-table';
import { NetworkReadingCreateDialog } from '@/features/infrastructure/components/network-reading-create-dialog';

const OPEN_TASK_STATUSES = new Set(['A_FAIRE', 'EN_COURS']);

function PermissionFallback() {
  return <p className="text-sm text-muted-foreground">Non disponible avec votre rôle actuel.</p>;
}

export function AssetDetailView({ assetId }: { assetId: string }) {
  const { data: asset, isLoading } = useAsset(assetId);
  const { data: depreciationEntries, isLoading: depreciationLoading } = useDepreciationEntries(assetId);
  const deleteMutation = useDeleteAsset();

  const { data: allPlans, isLoading: plansLoading } = useMaintenancePlans();
  const { data: allTasks, isLoading: tasksLoading } = useMaintenanceTasks();
  const { data: allInterventions, isLoading: interventionsLoading } = useMaintenanceInterventions();

  // Eau/Solaire/Réseau : catégorie déjà normalisée à la source (Select
  // strict sur assetCategoryOptions, voir schemas.ts) — comparaison
  // directe suffisante, pas besoin de normalisation trim/lowercase/
  // diacritiques (voir DETTE_TECHNIQUE.md Phase 19, décision D1).
  const isWaterAsset = asset?.category === 'eau';
  const isSolarAsset = asset?.category === 'solaire';
  const isNetworkAsset = asset?.category === 'internet';

  const { data: waterReadings, isLoading: waterLoading } = useWaterInfrastructureReadings(
    isWaterAsset ? assetId : '',
  );
  const { data: solarReadings, isLoading: solarLoading } = useSolarInfrastructureReadings(
    isSolarAsset ? assetId : '',
  );
  const { data: networkReadings, isLoading: networkLoading } = useNetworkStatusReadings(
    isNetworkAsset ? assetId : '',
  );

  const [reformDialogOpen, setReformDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [interventionDialogState, setInterventionDialogState] = useState<{
    open: boolean;
    taskId?: string;
  }>({ open: false });
  const [cancelTaskId, setCancelTaskId] = useState<string | null>(null);
  const [waterDialogOpen, setWaterDialogOpen] = useState(false);
  const [solarDialogOpen, setSolarDialogOpen] = useState(false);
  const [networkDialogOpen, setNetworkDialogOpen] = useState(false);

  const plans = useMemo(() => (allPlans ?? []).filter((p) => p.assetId === assetId), [allPlans, assetId]);
  const tasks = useMemo(() => (allTasks ?? []).filter((t) => t.assetId === assetId), [allTasks, assetId]);
  const interventions = useMemo(
    () => (allInterventions ?? []).filter((i) => i.assetId === assetId),
    [allInterventions, assetId],
  );
  const taskLabelById = useMemo(() => new Map(tasks.map((t) => [t.id, t.designation])), [tasks]);

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(assetId);
      toast.success('Actif supprimé.');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la suppression.')
          : 'Échec de la suppression.',
      );
    }
  }

  if (isLoading || !asset) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  // Réforme = statut terminal — garde également Modifier (le schéma
  // d'édition restreint `status` à ASSET_EDITABLE_STATUSES, un actif déjà
  // réformé n'a pas de valeur valide à soumettre), même leçon que Broiler/
  // Layer (voir DETTE_TECHNIQUE.md Phase 12).
  const isAssetOpen = asset.status !== 'REFORME';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${asset.code} — ${asset.designation}`}
        description={assetCategoryLabels[asset.category as AssetCategory] ?? asset.category}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={assetStatusConfig[asset.status].label} tone={assetStatusConfig[asset.status].tone} />
            <Can permission={PERMISSIONS.ASSETS_UPDATE}>
              {isAssetOpen ? (
                <Button
                  variant="outline"
                  size="icon"
                  nativeButton={false}
                  render={<Link href={`/patrimoine/${assetId}/modifier`} />}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </Can>
            <Can permission={PERMISSIONS.ASSETS_REFORM}>
              {isAssetOpen ? (
                <Button variant="outline" onClick={() => setReformDialogOpen(true)}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Réformer
                </Button>
              ) : null}
            </Can>
            <Can permission={PERMISSIONS.ASSETS_DELETE}>
              <Button variant="outline" size="icon" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
          </div>
        }
      />

      <EntityAlertsWidget entityId={assetId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard label="Coût d’acquisition" value={asset.totalAcquisitionCostFcfa.toLocaleString('fr-FR')} unit="FCFA" />
        <KpiCard label="Valeur nette comptable" value={asset.netBookValueFcfa.toLocaleString('fr-FR')} unit="FCFA" />
        <KpiCard label="Amorti cumulé" value={asset.accumulatedDepreciationFcfa.toLocaleString('fr-FR')} unit="FCFA" />
        <KpiCard label="Coût total de possession" value={asset.tcoFcfa.toLocaleString('fr-FR')} unit="FCFA" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <span className="text-muted-foreground">Marque</span>
          <span>{asset.brand ?? '—'}</span>
          <span className="text-muted-foreground">Modèle</span>
          <span>{asset.model ?? '—'}</span>
          <span className="text-muted-foreground">N° de série</span>
          <span>{asset.serialNumber ?? '—'}</span>
          <span className="text-muted-foreground">Localisation</span>
          <span>{asset.location ?? '—'}</span>
          <span className="text-muted-foreground">Date d’achat</span>
          <span>{new Date(asset.purchaseDate).toLocaleDateString('fr-FR')}</span>
          <span className="text-muted-foreground">Mise en service</span>
          <span>{new Date(asset.serviceDate).toLocaleDateString('fr-FR')}</span>
          <span className="text-muted-foreground">Garantie jusqu’au</span>
          <span>{asset.warrantyExpiresAt ? new Date(asset.warrantyExpiresAt).toLocaleDateString('fr-FR') : '—'}</span>
          <span className="text-muted-foreground">Durée d’amortissement</span>
          <span>{asset.depreciationDurationYears} an(s)</span>
        </CardContent>
      </Card>

      <Tabs defaultValue="apercu">
        <TabsList>
          <TabsTrigger value="apercu">Amortissement</TabsTrigger>
          <TabsTrigger value="maintenance">
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Maintenance
          </TabsTrigger>
          {isWaterAsset ? (
            <TabsTrigger value="eau">
              <Waves className="h-4 w-4" aria-hidden="true" />
              Eau
            </TabsTrigger>
          ) : null}
          {isSolarAsset ? (
            <TabsTrigger value="solaire">
              <Sun className="h-4 w-4" aria-hidden="true" />
              Solaire
            </TabsTrigger>
          ) : null}
          {isNetworkAsset ? (
            <TabsTrigger value="reseau">
              <Wifi className="h-4 w-4" aria-hidden="true" />
              Réseau
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="apercu">
          <Can permission={PERMISSIONS.DEPRECIATION_READ} fallback={<PermissionFallback />}>
            <DepreciationEntriesTable data={depreciationEntries} isLoading={depreciationLoading} />
          </Can>
        </TabsContent>

        <TabsContent value="maintenance">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm font-semibold text-primary">Plans de maintenance</h2>
                <Can permission={PERMISSIONS.MAINTENANCE_PLANS_CREATE}>
                  {isAssetOpen ? (
                    <Button size="sm" variant="outline" onClick={() => setPlanDialogOpen(true)}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Nouveau plan
                    </Button>
                  ) : null}
                </Can>
              </div>
              <ul className="flex flex-col gap-2">
                {plansLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
                {!plansLoading && plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun plan de maintenance.</p>
                ) : null}
                {plans.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                  >
                    <span>{p.designation}</span>
                    <span className="text-muted-foreground">
                      Tous les {p.periodicityDays} jours — depuis le{' '}
                      {new Date(p.startDate).toLocaleDateString('fr-FR')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm font-semibold text-primary">Tâches</h2>
                <div className="flex gap-2">
                  <Can permission={PERMISSIONS.MAINTENANCE_INTERVENTIONS_CREATE}>
                    {isAssetOpen ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setInterventionDialogState({ open: true })}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Intervention
                      </Button>
                    ) : null}
                  </Can>
                  <Can permission={PERMISSIONS.MAINTENANCE_TASKS_CREATE}>
                    {isAssetOpen ? (
                      <Button size="sm" variant="outline" onClick={() => setTaskDialogOpen(true)}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Nouvelle tâche
                      </Button>
                    ) : null}
                  </Can>
                </div>
              </div>
              <MaintenanceTaskTable
                data={tasks}
                isLoading={tasksLoading}
                rowActions={(task) =>
                  OPEN_TASK_STATUSES.has(task.status) ? (
                    <div className="flex justify-end gap-2">
                      <Can permission={PERMISSIONS.MAINTENANCE_INTERVENTIONS_CREATE}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInterventionDialogState({ open: true, taskId: task.id })}
                        >
                          Réaliser
                        </Button>
                      </Can>
                      <Can permission={PERMISSIONS.MAINTENANCE_TASKS_CANCEL}>
                        <Button size="sm" variant="outline" onClick={() => setCancelTaskId(task.id)}>
                          Annuler
                        </Button>
                      </Can>
                    </div>
                  ) : null
                }
              />
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-sm font-semibold text-primary">Historique des interventions</h2>
              <Can permission={PERMISSIONS.MAINTENANCE_INTERVENTIONS_READ} fallback={<PermissionFallback />}>
                <MaintenanceInterventionsTable
                  data={interventions}
                  isLoading={interventionsLoading}
                  taskLabelById={taskLabelById}
                />
              </Can>
            </section>
          </div>
        </TabsContent>

        {isWaterAsset ? (
          <TabsContent value="eau">
            <Can permission={PERMISSIONS.WATER_INFRASTRUCTURE_READINGS_READ} fallback={<PermissionFallback />}>
              <div className="flex flex-col gap-3">
                <Can permission={PERMISSIONS.WATER_INFRASTRUCTURE_READINGS_CREATE}>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setWaterDialogOpen(true)}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Nouveau relevé
                    </Button>
                  </div>
                </Can>
                <WaterReadingTable data={waterReadings} isLoading={waterLoading} />
              </div>
            </Can>
          </TabsContent>
        ) : null}

        {isSolarAsset ? (
          <TabsContent value="solaire">
            <Can permission={PERMISSIONS.SOLAR_INFRASTRUCTURE_READINGS_READ} fallback={<PermissionFallback />}>
              <div className="flex flex-col gap-3">
                <Can permission={PERMISSIONS.SOLAR_INFRASTRUCTURE_READINGS_CREATE}>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setSolarDialogOpen(true)}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Nouveau relevé
                    </Button>
                  </div>
                </Can>
                <SolarReadingTable data={solarReadings} isLoading={solarLoading} />
              </div>
            </Can>
          </TabsContent>
        ) : null}

        {isNetworkAsset ? (
          <TabsContent value="reseau">
            <Can permission={PERMISSIONS.NETWORK_STATUS_READINGS_READ} fallback={<PermissionFallback />}>
              <div className="flex flex-col gap-3">
                <Can permission={PERMISSIONS.NETWORK_STATUS_READINGS_CREATE}>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setNetworkDialogOpen(true)}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Nouveau relevé
                    </Button>
                  </div>
                </Can>
                <NetworkReadingTable data={networkReadings} isLoading={networkLoading} />
              </div>
            </Can>
          </TabsContent>
        ) : null}
      </Tabs>

      <ReformAssetDialog asset={asset} open={reformDialogOpen} onOpenChange={setReformDialogOpen} />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Supprimer cet actif ?"
        description={`« ${asset.designation} » sera définitivement supprimé. Impossible si une dépense y est rattachée.`}
        confirmLabel="Supprimer"
      />
      <MaintenancePlanCreateDialog assetId={assetId} open={planDialogOpen} onOpenChange={setPlanDialogOpen} />
      <MaintenanceTaskCreateDialog assetId={assetId} open={taskDialogOpen} onOpenChange={setTaskDialogOpen} />
      <MaintenanceInterventionCreateDialog
        assetId={assetId}
        taskId={interventionDialogState.taskId}
        open={interventionDialogState.open}
        onOpenChange={(open) => setInterventionDialogState({ open })}
      />
      {cancelTaskId ? (
        <CancelTaskDialog
          taskId={cancelTaskId}
          open={!!cancelTaskId}
          onOpenChange={(open) => !open && setCancelTaskId(null)}
        />
      ) : null}
      {isWaterAsset ? (
        <WaterReadingCreateDialog assetId={assetId} open={waterDialogOpen} onOpenChange={setWaterDialogOpen} />
      ) : null}
      {isSolarAsset ? (
        <SolarReadingCreateDialog assetId={assetId} open={solarDialogOpen} onOpenChange={setSolarDialogOpen} />
      ) : null}
      {isNetworkAsset ? (
        <NetworkReadingCreateDialog assetId={assetId} open={networkDialogOpen} onOpenChange={setNetworkDialogOpen} />
      ) : null}
    </div>
  );
}
