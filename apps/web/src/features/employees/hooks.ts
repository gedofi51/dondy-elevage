import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Attendance,
  CancelEmployeeTaskInput,
  CreateAttendanceInput,
  CreateEmployeeInput,
  CreateEmployeeTaskInput,
  CreatePayrollInput,
  CreateSalaryAdvanceInput,
  Employee,
  EmployeeRosterEntry,
  EmployeeTaskWithComputed,
  Payroll,
  SalaryAdvance,
  UpdateAttendanceInput,
  UpdateEmployeeInput,
  UpdateEmployeeTaskInput,
  UpdatePayrollInput,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

export function useEmployees(options?: { enabled?: boolean }) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['employees'],
    queryFn: () => apiFetch<Employee[]>('/employees'),
    enabled: options?.enabled,
  });
}

export function useEmployee(id: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => apiFetch<Employee>(`/employees/${id}`),
    enabled: !!id,
  });
}

/** Registre minimal (Lot 7-correctif) — id/code/name/status uniquement,
 * accessible à EMPLOYEES_READ OU ATTENDANCE_READ OU EMPLOYEE_TASKS_READ
 * (contrairement à useEmployees(), gardé par EMPLOYEES_READ seul côté
 * API) : à utiliser pour tout consommateur qui doit rester atteignable
 * par un rôle sans accès à la fiche employé complète (ex.
 * AttendanceRegister/Responsable élevage) — voir DETTE_TECHNIQUE.md
 * Lot 7-correctif. `useEmployees()` reste le bon choix partout ailleurs
 * (EmployeeTable, EmployeeSelect, HrReport...), déjà vérifié
 * inatteignables par un rôle sans EMPLOYEES_READ. */
export function useEmployeeRoster() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['employees', 'roster'],
    queryFn: () => apiFetch<EmployeeRosterEntry[]>('/employees/roster'),
  });
}

export function useCreateEmployee() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) =>
      apiFetch<Employee>('/employees', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUpdateEmployee(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) =>
      apiFetch<Employee>(`/employees/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees', id] });
    },
  });
}

/** Soft delete côté API (deletedAt) — mais sans endpoint de restauration
 * (voir DETTE_TECHNIQUE.md Lot 2) : une fois confirmée, la fiche
 * disparaît de tous les écrans, comme une suppression définitive du
 * point de vue de l'utilisateur. */
export function useDeleteEmployee() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

// Pointage (Lot 6b) — sous-ressource nestée, même patron que WaterReadings
// sous WaterPoint (voir attendance.service.ts côté API). Pas de hook GET
// par date isolé ici : le registre du jour (AttendanceRegister) interroge
// plusieurs employés en parallèle via useQueries et ne peut pas réutiliser
// un hook à employeeId fixe — la requête GET/:date y est donc construite
// directement avec useApiFetch, la clé de cache restant compatible
// (['employees', id, 'attendance', ...]) pour profiter de l'invalidation
// ci-dessous.
export function useEmployeeAttendance(employeeId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['employees', employeeId, 'attendance'],
    queryFn: () => apiFetch<Attendance[]>(`/employees/${employeeId}/attendance`),
    enabled: !!employeeId,
  });
}

export function useCreateAttendance(employeeId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAttendanceInput) =>
      apiFetch<Attendance>(`/employees/${employeeId}/attendance`, { method: 'POST', body: input }),
    // Invalidation par préfixe : recouvre aussi bien la liste complète
    // (['employees', id, 'attendance']) que les lectures ciblées par date
    // (['employees', id, 'attendance', date]) utilisées par le registre.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'attendance'] }),
  });
}

export function useUpdateAttendance(employeeId: string, date: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAttendanceInput) =>
      apiFetch<Attendance>(`/employees/${employeeId}/attendance/${date}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'attendance'] }),
  });
}

// Tâches assignées (Lot 6c) — même patron nesté que Présence (Lot 6b).
export function useEmployeeTasks(employeeId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['employees', employeeId, 'tasks'],
    queryFn: () => apiFetch<EmployeeTaskWithComputed[]>(`/employees/${employeeId}/tasks`),
    enabled: !!employeeId,
  });
}

export function useCreateEmployeeTask(employeeId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeTaskInput) =>
      apiFetch<EmployeeTaskWithComputed>(`/employees/${employeeId}/tasks`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'tasks'] }),
  });
}

export function useUpdateEmployeeTask(employeeId: string, taskId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEmployeeTaskInput) =>
      apiFetch<EmployeeTaskWithComputed>(`/employees/${employeeId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'tasks'] }),
  });
}

/** Endpoint dédié, jamais via useUpdateEmployeeTask — ANNULEE est isolé
 * du PATCH générique (voir schemas.ts, cancelEmployeeTaskSchema). */
export function useCancelEmployeeTask(employeeId: string, taskId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelEmployeeTaskInput) =>
      apiFetch<EmployeeTaskWithComputed>(`/employees/${employeeId}/tasks/${taskId}/annuler`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'tasks'] }),
  });
}

// Paie (Lot 6d) — même patron nesté que Présence/Tâches. Attention
// particulière (voir DETTE_TECHNIQUE.md) : ces hooks ne doivent JAMAIS
// être appelés inconditionnellement dans un composant toujours monté
// (contrairement à useEmployeeAttendance/useEmployeeTasks) — Lecteur n'a
// aucun accès à PAYROLL_READ, un appel non gardé produirait un 403 et,
// plus grave, une entrée de cache React Query pour un rôle qui ne
// devrait jamais en déclencher une. Seul PayrollTab (monté uniquement
// derrière <Can permission={PAYROLL_READ}>) doit les appeler.
export function useEmployeePayroll(employeeId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['employees', employeeId, 'payroll'],
    queryFn: () => apiFetch<Payroll[]>(`/employees/${employeeId}/payroll`),
    enabled: !!employeeId,
  });
}

export function useCreatePayroll(employeeId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePayrollInput) =>
      apiFetch<Payroll>(`/employees/${employeeId}/payroll`, { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'payroll'] }),
  });
}

/** Un seul hook PATCH pour deux usages distincts (voir payroll-tab.tsx) :
 * correction (bonusFcfa/deductionsFcfa/observations) tant que BROUILLON,
 * et validation (`{ status: 'VALIDE' }`) — jamais de statut ANNULE
 * (interdiction explicite du Lot 6d). Aucun endpoint .../pay dédié
 * n'existe côté API (contrairement à ce que le prompt suggérait) : la
 * validation passe par ce même PATCH générique avec `status: 'VALIDE'`. */
export function useUpdatePayroll(employeeId: string, payrollId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePayrollInput) =>
      apiFetch<Payroll>(`/employees/${employeeId}/payroll/${payrollId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'payroll'] }),
  });
}

export function useSalaryAdvances(employeeId: string) {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['employees', employeeId, 'advances'],
    queryFn: () => apiFetch<SalaryAdvance[]>(`/employees/${employeeId}/advances`),
    enabled: !!employeeId,
  });
}

export function useCreateSalaryAdvance(employeeId: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSalaryAdvanceInput) =>
      apiFetch<SalaryAdvance>(`/employees/${employeeId}/advances`, { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'advances'] }),
  });
}
