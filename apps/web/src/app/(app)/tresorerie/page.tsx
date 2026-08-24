'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import type { PayableBySupplier, ReceivableByCustomer, TreasuryJournalEntry } from '@dondy-elevage/shared-types';
import {
  useTreasuryJournal,
  useTreasuryPayables,
  useTreasuryReceivables,
  useTreasurySummary,
} from '@/features/treasury/hooks';

function firstDayOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const journalSourceLabels: Record<TreasuryJournalEntry['source'], string> = {
  payment: 'Vente',
  supplier_payment: 'Achat',
  expense: 'Dépense',
};

export default function TreasuryPage() {
  // Défaut = mois courant — aucun défaut serveur (from/to obligatoires),
  // choix UX documenté (voir DETTE_TECHNIQUE.md Phase 14).
  const [from, setFrom] = useState(firstDayOfCurrentMonthIso());
  const [to, setTo] = useState(todayIsoDate());

  const { data: journal, isLoading: journalLoading } = useTreasuryJournal(from, to);
  const journalRows = (journal?.entries ?? []).map((entry, index) => ({
    ...entry,
    key: `${entry.source}-${entry.date}-${index}`,
  }));
  const { data: summary } = useTreasurySummary(from, to);
  const { data: receivables, isLoading: receivablesLoading } = useTreasuryReceivables();
  const { data: payables, isLoading: payablesLoading } = useTreasuryPayables();

  const journalColumns: DataTableColumn<TreasuryJournalEntry & { key: string }>[] = [
    { key: 'date', header: 'Date', render: (e) => new Date(e.date).toLocaleDateString('fr-FR') },
    { key: 'type', header: 'Type', render: (e) => (e.type === 'ENCAISSEMENT' ? 'Encaissement' : 'Décaissement') },
    { key: 'source', header: 'Source', render: (e) => journalSourceLabels[e.source] },
    { key: 'reference', header: 'Référence', render: (e) => e.reference ?? '—' },
    {
      key: 'amount',
      header: 'Montant',
      render: (e) => (
        <span className={e.type === 'ENCAISSEMENT' ? 'text-success' : 'text-destructive'}>
          {e.type === 'ENCAISSEMENT' ? '+' : '-'}
          {e.amountFcfa.toLocaleString('fr-FR')} FCFA
        </span>
      ),
    },
  ];

  const receivablesColumns: DataTableColumn<ReceivableByCustomer>[] = [
    { key: 'customer', header: 'Client', render: (r) => r.customerName },
    { key: 'sold', header: 'Vendu', render: (r) => `${r.totalSoldFcfa.toLocaleString('fr-FR')} FCFA` },
    { key: 'paid', header: 'Payé', render: (r) => `${r.totalPaidFcfa.toLocaleString('fr-FR')} FCFA` },
    { key: 'balance', header: 'Reste dû', render: (r) => `${r.balanceFcfa.toLocaleString('fr-FR')} FCFA` },
  ];

  const payablesColumns: DataTableColumn<PayableBySupplier>[] = [
    { key: 'supplier', header: 'Fournisseur', render: (p) => p.supplierName },
    { key: 'ordered', header: 'Commandé', render: (p) => `${p.totalOrderedFcfa.toLocaleString('fr-FR')} FCFA` },
    { key: 'paid', header: 'Payé', render: (p) => `${p.totalPaidFcfa.toLocaleString('fr-FR')} FCFA` },
    { key: 'balance', header: 'Reste à payer', render: (p) => `${p.balanceFcfa.toLocaleString('fr-FR')} FCFA` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Trésorerie" description="Journal, créances, dettes et rentabilité consolidée." />

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="tr-from">Du</Label>
          <Input id="tr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tr-to">Au</Label>
          <Input id="tr-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Chiffre d’affaires" value={summary?.revenueFcfa.toLocaleString('fr-FR') ?? '—'} unit="FCFA" />
        <KpiCard label="Charges totales" value={summary?.totalExpensesFcfa.toLocaleString('fr-FR') ?? '—'} unit="FCFA" />
        <KpiCard label="Marge brute" value={summary?.grossMarginFcfa.toLocaleString('fr-FR') ?? '—'} unit="FCFA" />
        <KpiCard
          label="Taux de rentabilité"
          value={summary ? `${summary.profitabilityRate.toFixed(1)} %` : '—'}
        />
        <KpiCard
          label="Trésorerie nette (période)"
          value={summary?.netTreasuryFcfa.toLocaleString('fr-FR') ?? '—'}
          unit="FCFA"
          tone={summary && summary.netTreasuryFcfa < 0 ? 'destructive' : 'success'}
        />
      </div>

      <Tabs defaultValue="journal">
        <TabsList>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="creances">Créances clients</TabsTrigger>
          <TabsTrigger value="dettes">Dettes fournisseurs</TabsTrigger>
        </TabsList>

        <TabsContent value="journal">
          <DataTable
            columns={journalColumns}
            data={journalRows}
            isLoading={journalLoading}
            getRowKey={(e) => e.key}
            emptyLabel="Aucun mouvement sur cette période."
          />
        </TabsContent>

        <TabsContent value="creances">
          <DataTable
            columns={receivablesColumns}
            data={receivables}
            isLoading={receivablesLoading}
            getRowKey={(r) => r.customerId}
            emptyLabel="Aucune créance en cours."
          />
        </TabsContent>

        <TabsContent value="dettes">
          <DataTable
            columns={payablesColumns}
            data={payables}
            isLoading={payablesLoading}
            getRowKey={(p) => p.supplierId}
            emptyLabel="Aucune dette en cours."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
