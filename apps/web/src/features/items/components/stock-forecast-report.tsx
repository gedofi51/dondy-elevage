'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { StockStatus } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { Button } from '@/components/ui/button';
import { useItemsWithForecast, type ItemWithForecast } from '../hooks';
import { stockStatusConfig } from './item-table';

type StatusFilter = StockStatus | 'TOUS';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'ORANGE', label: 'Stock faible' },
  { value: 'ROUGE', label: 'Rupture' },
];

function formatQuantity(value: number, unit: string): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${unit}`;
}

/**
 * Prévisions stocks (Lot 2, STOCKS.md "Calculer l'autonomie lorsque cela
 * est pertinent") — même patron d'onglet autonome que HrReport (Personnel
 * Lot 6d) : filtres + fetch propres, monté uniquement dans l'onglet
 * "Prévisions" de /stocks. `ITEMS_READ` (même permission que la fiche
 * article) gate tout l'onglet côté page — voir stocks/page.tsx.
 *
 * Distinction visuelle prévisionnel/réel (règle non négociable du prompt
 * Lot 2) : colonnes prévisionnelles en italique + libellés explicites
 * "(estimé)"/"(estimée)" dans l'en-tête — jamais seulement une couleur,
 * pour rester lisible aussi sans discrimination des couleurs.
 */
export function StockForecastReport() {
  const { data, isLoading } = useItemsWithForecast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TOUS');
  const [insufficientOnly, setInsufficientOnly] = useState(false);

  const filtered = useMemo(() => {
    return (data ?? []).filter((row) => {
      if (statusFilter !== 'TOUS' && row.item.status !== statusFilter) return false;
      if (insufficientOnly && row.forecast?.dataStatus !== 'INSUFFISANT') return false;
      return true;
    });
  }, [data, statusFilter, insufficientOnly]);

  const sufficientCount = (data ?? []).filter((r) => r.forecast?.dataStatus === 'SUFFISANT').length;
  const insufficientCount = (data ?? []).filter((r) => r.forecast?.dataStatus === 'INSUFFISANT').length;
  const calculatedAt = data?.find((r) => r.forecast)?.forecast?.calculatedAt;
  const windowDays = data?.find((r) => r.forecast)?.forecast?.windowDays;

  const columns: DataTableColumn<ItemWithForecast>[] = [
    {
      key: 'name',
      header: 'Article',
      render: (r) => (
        <Link href={`/stocks/${r.item.id}`} className="font-medium text-primary hover:underline">
          {r.item.name}
        </Link>
      ),
    },
    {
      key: 'stock',
      header: 'Stock actuel',
      render: (r) => formatQuantity(Number(r.item.currentStock), r.item.unit),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (r) => (
        <StatusBadge label={stockStatusConfig[r.item.status].label} tone={stockStatusConfig[r.item.status].tone} />
      ),
    },
    {
      key: 'dataStatus',
      header: 'Données',
      render: (r) =>
        r.forecast ? (
          <StatusBadge
            label={r.forecast.dataStatus === 'SUFFISANT' ? 'Suffisantes' : 'Insuffisantes'}
            tone={r.forecast.dataStatus === 'SUFFISANT' ? 'info' : 'muted'}
          />
        ) : (
          '—'
        ),
    },
    {
      key: 'consumption',
      header: 'Conso. moy./j (estimée)',
      className: 'italic text-muted-foreground',
      render: (r) =>
        r.forecast?.averageDailyConsumption != null
          ? formatQuantity(r.forecast.averageDailyConsumption, r.item.unit)
          : '—',
    },
    {
      key: 'autonomy',
      header: 'Autonomie (estimée)',
      className: 'italic text-muted-foreground',
      render: (r) => (r.forecast?.autonomyDays != null ? `${r.forecast.autonomyDays} j` : '—'),
    },
    {
      key: 'stockout',
      header: 'Rupture prévue (estimée)',
      className: 'italic text-muted-foreground',
      render: (r) =>
        r.forecast?.estimatedStockoutDate
          ? new Date(r.forecast.estimatedStockoutDate).toLocaleDateString('fr-FR')
          : '—',
    },
    {
      key: 'reorder',
      header: 'Réappro. suggéré (estimé)',
      className: 'italic text-muted-foreground',
      render: (r) =>
        r.forecast?.suggestedReorderQuantity != null ? (
          <>
            {formatQuantity(r.forecast.suggestedReorderQuantity, r.item.unit)}{' '}
            <span className="text-xs">
              ({r.forecast.reorderBasis === 'CONSOMMATION' ? 'conso. 30j' : 'seuil min.'})
            </span>
          </>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="Articles avec prévision calculable" value={sufficientCount} />
        <KpiCard
          label="Articles à données insuffisantes"
          value={insufficientCount}
          tone={insufficientCount > 0 ? 'warning' : 'default'}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {calculatedAt
          ? `Prévisions calculées le ${new Date(calculatedAt).toLocaleString('fr-FR')}, sur une fenêtre glissante de ${windowDays} jours.`
          : 'Calcul en cours…'}{' '}
        Colonnes en italique = estimation, jamais une valeur garantie — un article à données
        insuffisantes n’affiche aucun chiffre inventé.
      </p>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
        <Button
          variant={insufficientOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setInsufficientOnly((v) => !v)}
        >
          Données insuffisantes
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        getRowKey={(r) => r.item.id}
        emptyLabel="Aucun article ne correspond à ce filtre."
      />
    </div>
  );
}
