import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CancelMaintenanceTaskInput,
  CreateMaintenanceInterventionInput,
  CreateMaintenancePlanInput,
  CreateMaintenanceTaskInput,
  MaintenanceIntervention,
  MaintenanceInterventionWithComputed,
  MaintenancePlan,
  MaintenanceTaskWithComputed,
  UpdateMaintenancePlanInput,
  UpdateMaintenanceTaskInput,
} from '@dondy-elevage/shared-types';
import { useApiFetch } from '@/lib/api/use-api-fetch';

/** GET /maintenance-plans|-tasks|-interventions n'ont aucun filtre serveur
 * (assetId, statut...) — retournent toute la ferme, voir
 * DETTE_TECHNIQUE.md Phase 17. Filtrage par actif fait côté client par les
 * consommateurs (fiche Asset vs page globale Maintenance). */
export function useMaintenancePlans() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['maintenance-plans'],
    queryFn: () => apiFetch<MaintenancePlan[]>('/maintenance-plans'),
  });
}

export function useMaintenanceTasks() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['maintenance-tasks'],
    queryFn: () => apiFetch<MaintenanceTaskWithComputed[]>('/maintenance-tasks'),
  });
}

export function useMaintenanceInterventions() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: ['maintenance-interventions'],
    queryFn: () => apiFetch<MaintenanceInterventionWithComputed[]>('/maintenance-interventions'),
  });
}

export function useCreateMaintenancePlan() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaintenancePlanInput) =>
      apiFetch<MaintenancePlan>('/maintenance-plans', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-plans'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });
}

export function useUpdateMaintenancePlan(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMaintenancePlanInput) =>
      apiFetch<MaintenancePlan>(`/maintenance-plans/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance-plans'] }),
  });
}

export function useDeleteMaintenancePlan() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/maintenance-plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-plans'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });
}

export function useCreateMaintenanceTask() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaintenanceTaskInput) =>
      apiFetch<MaintenanceTaskWithComputed>('/maintenance-tasks', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] }),
  });
}

export function useUpdateMaintenanceTask(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMaintenanceTaskInput) =>
      apiFetch<MaintenanceTaskWithComputed>(`/maintenance-tasks/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] }),
  });
}

export function useDeleteMaintenanceTask() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/maintenance-tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] }),
  });
}

export function useCancelMaintenanceTask(id: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelMaintenanceTaskInput) =>
      apiFetch<MaintenanceTaskWithComputed>(`/maintenance-tasks/${id}/annuler`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] }),
  });
}

export function useCreateMaintenanceIntervention() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaintenanceInterventionInput) =>
      apiFetch<MaintenanceIntervention>('/maintenance-interventions', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      // Une intervention peut clôturer une tâche (effet de bord serveur),
      // consommer du stock et imputer un coût à l'actif (TCO) — invalide
      // les 4 ressources potentiellement affectées.
      queryClient.invalidateQueries({ queryKey: ['maintenance-interventions'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}
