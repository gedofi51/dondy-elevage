'use client';

import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { Attendance, EmployeeStatus, Payroll } from '@dondy-elevage/shared-types';
import { KpiCard } from '@/components/shared/kpi-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { useApiFetch } from '@/lib/api/use-api-fetch';
import { useEmployees } from '../hooks';
import { employeeStatusLabels } from '../schemas';

function firstDayOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const ABSENCE_STATUSES = new Set(['ABSENT', 'CONGE', 'MALADIE']);
const EMPTY_STATUS_COUNTS: Record<EmployeeStatus, number> = { ACTIF: 0, CONGE: 0, SUSPENDU: 0, DEPART: 0 };

/**
 * Rapport RH (Lot 6d) — effectif, absentéisme, coût de personnel par
 * période. Accès PAYROLL_READ (même gate que l'onglet Paie) : décision
 * confirmée avec l'utilisateur avant construction (aucun endpoint
 * farm-wide d'agrégation côté API, contrairement à /treasury/summary —
 * voir DETTE_TECHNIQUE.md Lot 6d) plutôt que tranchée seule.
 *
 * Absentéisme/coût de personnel exigent un historique par employé
 * (Attendance/Payroll sont nestés, aucun endpoint « toute la ferme sur
 * une période ») : une requête Attendance + une requête Payroll par
 * employé, en parallèle (même compromis que /pointage et le registre du
 * Lot 6b, un cran plus coûteux ici — accepté explicitement pour ce lot).
 * Chaque agrégat (comptage, somme) porte sur des lignes individuelles
 * déjà correctes retournées par l'API — jamais une réinterprétation
 * d'une règle métier que l'API aurait déjà tranchée (isLate, solde
 * d'avance...), qui reste strictement interdite.
 */
export function HrReport() {
  const [from, setFrom] = useState(firstDayOfCurrentMonthIso);
  const [to, setTo] = useState(todayIsoDate);
  const apiFetch = useApiFetch();
  const { data: employees, isLoading: employeesLoading } = useEmployees();
  // Mémoïsé : `employees ?? []` créerait sinon un nouveau tableau vide à
  // chaque rendu, invalidant inutilement les useMemo ci-dessous tant que
  // employees reste undefined.
  const list = useMemo(() => employees ?? [], [employees]);

  const attendanceQueries = useQueries({
    queries: list.map((employee) => ({
      queryKey: ['employees', employee.id, 'attendance'],
      queryFn: () => apiFetch<Attendance[]>(`/employees/${employee.id}/attendance`),
    })),
  });
  const payrollQueries = useQueries({
    queries: list.map((employee) => ({
      queryKey: ['employees', employee.id, 'payroll'],
      queryFn: () => apiFetch<Payroll[]>(`/employees/${employee.id}/payroll`),
    })),
  });
  const fanOutLoading =
    attendanceQueries.some((q) => q.isLoading) || payrollQueries.some((q) => q.isLoading);

  const headcountByStatus = useMemo(() => {
    const counts = { ...EMPTY_STATUS_COUNTS };
    for (const employee of list) counts[employee.status]++;
    return counts;
  }, [list]);

  // Absentéisme = jours ABSENT/CONGE/MALADIE ÷ jours pointés sur la
  // période, tous employés confondus — comptage brut sur les
  // enregistrements individuels, pas un recalcul de leur statut.
  const attendanceTotals = useMemo(() => {
    let present = 0;
    let absence = 0;
    for (const query of attendanceQueries) {
      for (const record of query.data ?? []) {
        const day = record.date.slice(0, 10);
        if (day < from || day > to) continue;
        if (ABSENCE_STATUSES.has(record.status)) absence++;
        else present++;
      }
    }
    return { present, absence, total: present + absence };
  }, [attendanceQueries, from, to]);

  // Coût de personnel = somme des netFcfa des relevés VALIDE dont la
  // période chevauche [from, to] — un BROUILLON n'est pas encore un
  // engagement confirmé, exclu volontairement du total.
  const personnelCostFcfa = useMemo(() => {
    let total = 0;
    for (const query of payrollQueries) {
      for (const payroll of query.data ?? []) {
        if (payroll.status !== 'VALIDE') continue;
        const periodStart = payroll.periodStart.slice(0, 10);
        const periodEnd = payroll.periodEnd.slice(0, 10);
        if (periodEnd < from || periodStart > to) continue;
        total += payroll.netFcfa;
      }
    }
    return total;
  }, [payrollQueries, from, to]);

  const hasFanOutError =
    attendanceQueries.some((q) => q.error instanceof ApiError) ||
    payrollQueries.some((q) => q.error instanceof ApiError);

  const absenteeismRate = attendanceTotals.total > 0 ? (attendanceTotals.absence / attendanceTotals.total) * 100 : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="hr-from">Du</Label>
          <Input id="hr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hr-to">Au</Label>
          <Input id="hr-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Effectif total" value={employeesLoading ? '—' : list.length} />
        <KpiCard
          label="Taux d’absentéisme (période)"
          value={
            employeesLoading || fanOutLoading || absenteeismRate === null
              ? '—'
              : `${absenteeismRate.toFixed(1)} %`
          }
          tone={absenteeismRate !== null && absenteeismRate > 10 ? 'destructive' : 'default'}
        />
        <KpiCard
          label="Coût de personnel (période)"
          value={employeesLoading || fanOutLoading ? '—' : personnelCostFcfa.toLocaleString('fr-FR')}
          unit="FCFA"
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {(Object.keys(employeeStatusLabels) as EmployeeStatus[]).map((status) => (
          <span key={status} className="text-muted-foreground">
            {employeeStatusLabels[status]} : <span className="font-medium text-foreground">{headcountByStatus[status]}</span>
          </span>
        ))}
      </div>

      {hasFanOutError ? (
        <p className="text-sm text-destructive">
          Certaines données employé n’ont pas pu être chargées — les totaux ci-dessus peuvent être
          incomplets.
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Effectif reflété à l’instant présent (l’API ne conserve pas d’historique de statut).
        Absentéisme = jours Absent/Congé/Maladie ÷ jours pointés sur la période, tous employés
        confondus. Coût de personnel = somme des relevés de paie Validés dont la période chevauche
        celle sélectionnée (un Brouillon n’est pas encore un engagement confirmé).
      </p>
    </div>
  );
}
