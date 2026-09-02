'use client';

import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { BroilerForecastTable } from './broiler-forecast-table';
import { LayerForecastTable } from './layer-forecast-table';
import { FinanceForecastCard } from './finance-forecast-card';

/**
 * Prévisions Production/Finance (Lot 3) — écran dédié transverse (décision
 * Lot 3, voir DETTE_TECHNIQUE.md) : contrairement au Lot 2 (un seul
 * domaine RBAC, onglet sur l'écran existant), ce lot couvre deux domaines
 * RBAC distincts (bandes/finances) sans écran existant qui les recouvre.
 * Chaque section gated indépendamment par sa propre permission (RBAC/
 * farmId identiques à l'accès classique, prompt Lot 3) — un rôle qui n'a
 * qu'un sous-ensemble de ces permissions voit seulement les sections
 * correspondantes, jamais une section vide.
 */
export default function PrevisionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Prévisions"
        description="Projections production et finance à partir des tendances observées — jamais un chiffre garanti."
      />

      <section className="flex flex-col gap-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Production</h2>

        <Can permission={PERMISSIONS.BROILER_BATCHES_READ}>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">Poulets de chair</h3>
            <BroilerForecastTable />
          </div>
        </Can>

        <Can permission={PERMISSIONS.LAYER_BATCHES_READ}>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">Pondeuses</h3>
            <LayerForecastTable />
          </div>
        </Can>
      </section>

      <Can permission={PERMISSIONS.TREASURY_READ}>
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">Finance</h2>
          <FinanceForecastCard />
        </section>
      </Can>
    </div>
  );
}
