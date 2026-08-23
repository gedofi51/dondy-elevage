'use client';

import type {
  HealthEventStatus,
  HealthEventType,
  LayerHealthEvent,
} from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';

const typeLabels: Record<HealthEventType, string> = {
  VACCINATION: 'Vaccination',
  TRAITEMENT: 'Traitement',
  PROPHYLAXIE: 'Prophylaxie',
  DESINFECTION: 'Désinfection',
  VITAMINE: 'Vitamine',
  CONSULTATION_VETERINAIRE: 'Consultation vétérinaire',
};

const statusConfig: Record<HealthEventStatus, { label: string; tone: 'success' | 'warning' | 'muted' | 'destructive' }> = {
  PREVU: { label: 'Prévu', tone: 'warning' },
  REALISE: { label: 'Réalisé', tone: 'success' },
  REPORTE: { label: 'Reporté', tone: 'muted' },
  ANNULE: { label: 'Annulé', tone: 'destructive' },
};

interface HealthEventTableProps {
  data: LayerHealthEvent[] | undefined;
  isLoading: boolean;
}

export function HealthEventTable({ data, isLoading }: HealthEventTableProps) {
  const columns: DataTableColumn<LayerHealthEvent>[] = [
    { key: 'date', header: 'Date', render: (e) => new Date(e.date).toLocaleDateString('fr-FR') },
    { key: 'type', header: 'Type', render: (e) => typeLabels[e.type] },
    { key: 'product', header: 'Produit', render: (e) => e.product ?? '—' },
    {
      key: 'status',
      header: 'Statut',
      render: (e) => <StatusBadge label={statusConfig[e.status].label} tone={statusConfig[e.status].tone} />,
    },
    { key: 'performedBy', header: 'Réalisé par', render: (e) => e.performedBy ?? '—' },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      getRowKey={(e) => e.id}
      emptyLabel="Aucun événement sanitaire pour le moment."
    />
  );
}
