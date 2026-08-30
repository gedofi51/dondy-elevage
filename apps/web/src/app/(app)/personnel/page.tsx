'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { useEmployees } from '@/features/employees/hooks';
import { EmployeeTable } from '@/features/employees/components/employee-table';

export default function EmployeesListPage() {
  const { data, isLoading } = useEmployees();
  const [filter, setFilter] = useState<'actifs' | 'tous'>('actifs');

  // GET /employees n'a aucun filtre/pagination serveur — filtrage en
  // mémoire, même palliatif que les autres listes du projet (voir
  // DETTE_TECHNIQUE.md). "Actifs" exclut seulement le statut terminal
  // DEPART (un employé CONGE/SUSPENDU reste dans l'effectif), même
  // convention que Patrimoine (REFORME) — voir DETTE_TECHNIQUE.md Lot 6a.
  const filtered = filter === 'actifs' ? data?.filter((e) => e.status !== 'DEPART') : data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Personnel"
        description="Fiches employé — effectif, affectation, statut."
        action={
          <Can permission={PERMISSIONS.EMPLOYEES_CREATE}>
            <Button nativeButton={false} render={<Link href="/personnel/nouveau" />}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouvel employé
            </Button>
          </Can>
        }
      />

      <div className="flex gap-2">
        <Button
          variant={filter === 'actifs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('actifs')}
        >
          Actifs
        </Button>
        <Button
          variant={filter === 'tous' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('tous')}
        >
          Tous
        </Button>
      </div>

      <EmployeeTable data={filtered} isLoading={isLoading} />
    </div>
  );
}
