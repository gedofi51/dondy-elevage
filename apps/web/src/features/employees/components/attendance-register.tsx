'use client';

import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import type { Attendance, EmployeeRosterEntry } from '@dondy-elevage/shared-types';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useApiFetch } from '@/lib/api/use-api-fetch';
import { useEmployeeRoster } from '../hooks';
import { attendanceStatusLabels } from '../schemas';
import { AttendanceDialog } from './attendance-dialog';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

const statusTone: Record<Attendance['status'], Tone> = {
  PRESENT: 'success',
  ABSENT: 'destructive',
  CONGE: 'info',
  MALADIE: 'warning',
};

interface RegisterRow {
  employee: EmployeeRosterEntry;
  // undefined = requête encore en cours, null = confirmé « pas de
  // pointage ce jour » (404 API), sinon l'enregistrement.
  record: Attendance | null | undefined;
}

/**
 * Registre de pointage du jour (Lot 6b, écran /pointage) — aucun endpoint
 * farm-wide « tous les employés à une date » côté API (Lot 3 n'expose que
 * /employees/:id/attendance, nesté par employé) : une requête GET/:date
 * par employé éligible, en parallèle (useQueries), est la seule option
 * sans modification backend hors périmètre de ce lot. Borné par
 * l'effectif de la ferme — voir DETTE_TECHNIQUE.md Lot 6b pour le
 * compromis assumé (nombre de requêtes vs connectivité Samba).
 *
 * Source de la liste : useEmployeeRoster() (Lot 7-correctif), pas
 * useEmployees() — GET /employees est gardé par EMPLOYEES_READ seul,
 * que Responsable élevage n'a pas (a ATTENDANCE_CREATE/UPDATE, donc
 * accès nav à /pointage, mais recevait un 403 silencieux sur la liste
 * employés → registre toujours vide, malgré une navigation correcte).
 * /employees/roster est gardé par EMPLOYEES_READ OU ATTENDANCE_READ OU
 * EMPLOYEE_TASKS_READ et filtre déjà les statuts éligibles côté serveur
 * (RESTRICTED_EMPLOYEE_STATUSES) — plus besoin de filtrer ici.
 */
export function AttendanceRegister({ date }: { date: string }) {
  const apiFetch = useApiFetch();
  const { data: roster, isLoading: rosterLoading } = useEmployeeRoster();
  const [dialogEmployee, setDialogEmployee] = useState<{ id: string; existing: Attendance | null } | null>(
    null,
  );

  const eligible = roster ?? [];

  const attendanceQueries = useQueries({
    queries: eligible.map((employee) => ({
      queryKey: ['employees', employee.id, 'attendance', date],
      queryFn: async (): Promise<Attendance | null> => {
        try {
          return await apiFetch<Attendance>(`/employees/${employee.id}/attendance/${date}`);
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }
      },
      enabled: !!date,
    })),
  });

  const rows: RegisterRow[] = eligible.map((employee, index) => ({
    employee,
    record: attendanceQueries[index]?.data,
  }));

  const columns: DataTableColumn<RegisterRow>[] = [
    {
      key: 'employee',
      header: 'Employé',
      render: (row) => `${row.employee.code} — ${row.employee.name}`,
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) =>
        row.record === undefined ? (
          <Skeleton className="h-5 w-20" />
        ) : row.record ? (
          <StatusBadge label={attendanceStatusLabels[row.record.status]} tone={statusTone[row.record.status]} />
        ) : (
          <StatusBadge label="Non pointé" tone="muted" />
        ),
    },
    { key: 'checkIn', header: 'Arrivée', render: (row) => row.record?.checkInTime ?? '—' },
    { key: 'checkOut', header: 'Départ', render: (row) => row.record?.checkOutTime ?? '—' },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={rosterLoading}
        getRowKey={(row) => row.employee.id}
        emptyLabel="Aucun employé actif."
        rowActions={(row) => (
          <Can permission={row.record ? PERMISSIONS.ATTENDANCE_UPDATE : PERMISSIONS.ATTENDANCE_CREATE}>
            <Button
              variant="outline"
              size="sm"
              disabled={row.record === undefined}
              onClick={() => setDialogEmployee({ id: row.employee.id, existing: row.record ?? null })}
            >
              {row.record ? 'Modifier' : 'Pointer'}
            </Button>
          </Can>
        )}
      />

      {dialogEmployee ? (
        <AttendanceDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialogEmployee(null);
          }}
          employeeId={dialogEmployee.id}
          date={date}
          existing={dialogEmployee.existing}
        />
      ) : null}
    </>
  );
}
