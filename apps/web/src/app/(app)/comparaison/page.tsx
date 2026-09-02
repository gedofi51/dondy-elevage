'use client';

import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BroilerComparison } from './broiler-comparison';
import { LayerComparison } from './layer-comparison';
import { IncubationComparison } from './incubation-comparison';

/**
 * Comparaison de bandes/couveuses (Lot 4) — écran dédié séparé de
 * /anomalies (décision Lot 4, voir DETTE_TECHNIQUE.md) : sélection
 * manuelle de 2+ entités DU MÊME TYPE (comparer un poulet de chair à une
 * pondeuse n'aurait pas de sens, unités différentes), pas de détection
 * automatique. Un onglet par type, chacun gated par sa propre permission
 * — même principe que /previsions (Lot 3).
 */
export default function ComparaisonPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Comparaison"
        description="Comparez 2 bandes ou couveuses ou plus, indicateurs côte à côte."
      />

      <Tabs defaultValue="chair">
        <TabsList>
          <Can permission={PERMISSIONS.BROILER_BATCHES_READ}>
            <TabsTrigger value="chair">Poulets de chair</TabsTrigger>
          </Can>
          <Can permission={PERMISSIONS.LAYER_BATCHES_READ}>
            <TabsTrigger value="pondeuses">Pondeuses</TabsTrigger>
          </Can>
          <Can permission={PERMISSIONS.INCUBATION_BATCHES_READ}>
            <TabsTrigger value="couvoir">Couvoir</TabsTrigger>
          </Can>
        </TabsList>

        <Can permission={PERMISSIONS.BROILER_BATCHES_READ}>
          <TabsContent value="chair">
            <BroilerComparison />
          </TabsContent>
        </Can>
        <Can permission={PERMISSIONS.LAYER_BATCHES_READ}>
          <TabsContent value="pondeuses">
            <LayerComparison />
          </TabsContent>
        </Can>
        <Can permission={PERMISSIONS.INCUBATION_BATCHES_READ}>
          <TabsContent value="couvoir">
            <IncubationComparison />
          </TabsContent>
        </Can>
      </Tabs>
    </div>
  );
}
