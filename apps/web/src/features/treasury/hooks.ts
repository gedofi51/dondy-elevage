import { useQuery } from '@tanstack/react-query';
import type {
  PayableBySupplier,
  ReceivableByCustomer,
  TreasuryForecast,
  TreasuryJournal,
  TreasurySummary,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/** journal/summary exigent une période explicite côté API (from/to,
 * @IsDateString, aucun défaut implicite) — le choix de période par
 * défaut est une décision UX frontend (mois courant), pas un
 * comportement serveur (voir DETTE_TECHNIQUE.md Phase 14). */
export function useTreasuryJournal(from: string, to: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['treasury', 'journal', { from, to }],
    queryFn: () => apiFetch<TreasuryJournal>('/treasury/journal', { searchParams: { from, to } }),
    enabled: !!from && !!to,
  });
}

/** Snapshots globaux, sans notion de période. */
export function useTreasuryReceivables() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['treasury', 'receivables'],
    queryFn: () => apiFetch<ReceivableByCustomer[]>('/treasury/receivables'),
  });
}

export function useTreasuryPayables() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['treasury', 'payables'],
    queryFn: () => apiFetch<PayableBySupplier[]>('/treasury/payables'),
  });
}

export function useTreasurySummary(from: string, to: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['treasury', 'summary', { from, to }],
    queryFn: () => apiFetch<TreasurySummary>('/treasury/summary', { searchParams: { from, to } }),
    enabled: !!from && !!to,
  });
}

/** Prévisions finance (Lot 3) — période implicite = mois courant, pas de
 * paramètre (voir TreasuryService.getForecast). */
export function useTreasuryForecast() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['treasury', 'previsions'],
    queryFn: () => apiFetch<TreasuryForecast>('/treasury/previsions'),
  });
}
