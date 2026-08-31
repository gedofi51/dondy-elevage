'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { PERMISSIONS, type EmployeeTaskWithComputed } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import { extractMessage } from '@/lib/api/extract-error-message';
import { useDeleteEmployee, useEmployee, useEmployees, useEmployeeTasks } from '@/features/employees/hooks';
import { useBuildings } from '@/features/buildings/hooks';
import { employeeStatusConfig } from '@/features/employees/components/employee-table';
import { AttendanceCalendar } from '@/features/employees/components/attendance-calendar';
import { EmployeeTaskTable } from '@/features/employees/components/employee-task-table';
import { EmployeeTaskDialog } from '@/features/employees/components/employee-task-dialog';
import { CancelEmployeeTaskDialog } from '@/features/employees/components/cancel-employee-task-dialog';

// Onglet Paie : coquille visible dès le Lot 6a (fiche « extensible »
// demandée), contenu réel prévu au Lot 6d — interdiction explicite du
// Lot 6c de le remplir ici. Présence (Lot 6b) et Tâches (Lot 6c) ont
// désormais leur contenu réel.
function PlaceholderTabContent({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {label} — à venir dans un prochain lot du module Personnel.
    </p>
  );
}

// A_FAIRE/EN_COURS uniquement — REALISEE/ANNULEE sont terminaux (aucune
// action de correction/annulation proposée, le PATCH échouerait en 409
// côté API, voir TERMINAL_TASK_STATUSES). Même patron que asset-detail-
// view.tsx (OPEN_TASK_STATUSES, MaintenanceTask).
const OPEN_EMPLOYEE_TASK_STATUSES = new Set(['A_FAIRE', 'EN_COURS']);

export function EmployeeDetailView({ employeeId }: { employeeId: string }) {
  const { data: employee, isLoading } = useEmployee(employeeId);
  const { data: buildings } = useBuildings();
  const { data: employees } = useEmployees();
  const { data: tasks, isLoading: tasksLoading } = useEmployeeTasks(employeeId);
  const deleteMutation = useDeleteEmployee();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskDialogState, setTaskDialogState] = useState<{
    open: boolean;
    task?: EmployeeTaskWithComputed;
  }>({ open: false });
  const [cancelTaskId, setCancelTaskId] = useState<string | null>(null);

  const buildingsById = new Map((buildings ?? []).map((b) => [b.id, b.name]));
  const employeesById = new Map((employees ?? []).map((e) => [e.id, e.name]));

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(employeeId);
      toast.success('Employé supprimé.');
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? extractMessage(err.body, 'Échec de la suppression.')
          : 'Échec de la suppression.',
      );
    }
  }

  if (isLoading || !employee) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  // baseSalaryFcfa est absent (pas null) de la réponse pour un rôle sans
  // EMPLOYEES_VIEW_SALARY (ex. Lecteur) — ne jamais supposer sa présence,
  // ne jamais afficher de ligne vide suspecte à la place (règle UI
  // explicite du Lot 6a, voir DETTE_TECHNIQUE.md).
  const hasSalary = employee.baseSalaryFcfa !== undefined;

  // Même définition d'« employé actif » que côté API pour la création
  // d'une tâche (assertEmployeeActiveForNewTask / RESTRICTED_EMPLOYEE_
  // STATUSES, apps/api/.../employees.validation.ts) — évite de proposer
  // un bouton qui échouerait systématiquement en 409, même logique que
  // REGISTER_ELIGIBLE_STATUSES côté AttendanceRegister (Lot 6b).
  const canCreateTaskForEmployee = employee.status === 'ACTIF' || employee.status === 'CONGE';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${employee.code} — ${employee.name}`}
        description={employee.position}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={employeeStatusConfig[employee.status].label}
              tone={employeeStatusConfig[employee.status].tone}
            />
            <Can permission={PERMISSIONS.EMPLOYEES_UPDATE}>
              <Button
                variant="outline"
                size="icon"
                nativeButton={false}
                render={<Link href={`/personnel/${employeeId}/modifier`} />}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
            <Can permission={PERMISSIONS.EMPLOYEES_DELETE}>
              <Button variant="outline" size="icon" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <span className="text-muted-foreground">Bâtiment / service</span>
          <span>{employee.buildingId ? (buildingsById.get(employee.buildingId) ?? '—') : '—'}</span>
          <span className="text-muted-foreground">Responsable hiérarchique</span>
          <span>{employee.managerId ? (employeesById.get(employee.managerId) ?? '—') : '—'}</span>
          <span className="text-muted-foreground">Type de contrat</span>
          <span>{employee.contractType ?? '—'}</span>
          <span className="text-muted-foreground">Téléphone</span>
          <span>{employee.phone ?? '—'}</span>
          <span className="text-muted-foreground">Date d’embauche</span>
          <span>{new Date(employee.hireDate).toLocaleDateString('fr-FR')}</span>
          <span className="text-muted-foreground">Date de sortie</span>
          <span>{employee.endDate ? new Date(employee.endDate).toLocaleDateString('fr-FR') : '—'}</span>
          {hasSalary ? (
            <>
              <span className="text-muted-foreground">Salaire de base</span>
              <span>{employee.baseSalaryFcfa!.toLocaleString('fr-FR')} FCFA</span>
            </>
          ) : null}
          {employee.observations ? (
            <>
              <span className="text-muted-foreground">Observations</span>
              <span className="col-span-3">{employee.observations}</span>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="presence">
        <TabsList>
          <TabsTrigger value="presence">Présence</TabsTrigger>
          <TabsTrigger value="taches">Tâches</TabsTrigger>
          <Can permission={PERMISSIONS.PAYROLL_READ}>
            <TabsTrigger value="paie">Paie</TabsTrigger>
          </Can>
        </TabsList>

        <TabsContent value="presence">
          <AttendanceCalendar employeeId={employeeId} />
        </TabsContent>
        <TabsContent value="taches">
          <div className="flex flex-col gap-3">
            <Can permission={PERMISSIONS.EMPLOYEE_TASKS_CREATE}>
              <div className="flex items-center justify-end">
                {canCreateTaskForEmployee ? (
                  <Button size="sm" variant="outline" onClick={() => setTaskDialogState({ open: true })}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Nouvelle tâche
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Fiche {employeeStatusConfig[employee.status].label.toLowerCase()} — aucune nouvelle
                    tâche assignable.
                  </p>
                )}
              </div>
            </Can>
            <EmployeeTaskTable
              data={tasks}
              isLoading={tasksLoading}
              rowActions={(task) =>
                OPEN_EMPLOYEE_TASK_STATUSES.has(task.status) ? (
                  <div className="flex justify-end gap-2">
                    <Can permission={PERMISSIONS.EMPLOYEE_TASKS_UPDATE}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTaskDialogState({ open: true, task })}
                      >
                        Modifier
                      </Button>
                    </Can>
                    <Can permission={PERMISSIONS.EMPLOYEE_TASKS_UPDATE}>
                      <Button size="sm" variant="outline" onClick={() => setCancelTaskId(task.id)}>
                        Annuler
                      </Button>
                    </Can>
                  </div>
                ) : null
              }
            />
          </div>
        </TabsContent>
        <Can permission={PERMISSIONS.PAYROLL_READ}>
          <TabsContent value="paie">
            <PlaceholderTabContent label="Paie" />
          </TabsContent>
        </Can>
      </Tabs>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Supprimer cet employé ?"
        description={`« ${employee.name} » sera supprimé (suppression réversible uniquement en base — aucune restauration depuis l’interface).`}
        confirmLabel="Supprimer"
      />

      <EmployeeTaskDialog
        open={taskDialogState.open}
        onOpenChange={(open) => setTaskDialogState({ open })}
        employeeId={employeeId}
        task={taskDialogState.task}
      />
      {cancelTaskId ? (
        <CancelEmployeeTaskDialog
          employeeId={employeeId}
          taskId={cancelTaskId}
          open={!!cancelTaskId}
          onOpenChange={(open) => !open && setCancelTaskId(null)}
        />
      ) : null}
    </div>
  );
}
