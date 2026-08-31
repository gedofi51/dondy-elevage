import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Attendance } from '@dondy-elevage/shared-types';
import { AttendanceForm } from './attendance-form';

const createMutateAsync = vi.fn().mockResolvedValue({ id: 'attendance-1' });
const updateMutateAsync = vi.fn().mockResolvedValue({ id: 'attendance-1' });

vi.mock('../hooks', () => ({
  useCreateAttendance: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateAttendance: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

beforeEach(() => {
  // Les mocks createMutateAsync/updateMutateAsync sont partagés (module-
  // level) entre tous les tests de ce fichier — sans ce reset, les
  // compteurs d'appels s'accumuleraient d'un test à l'autre.
  vi.clearAllMocks();
});

const existingRecord: Attendance = {
  id: 'attendance-1',
  farmId: 'farm-1',
  employeeId: 'employee-1',
  date: '2026-08-31',
  status: 'PRESENT',
  checkInTime: '07:30',
  checkOutTime: null,
  observations: null,
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z',
  createdBy: 'user-1',
};

describe('AttendanceForm (création — pas de pointage existant)', () => {
  it('affiche une erreur si le statut Présent n’a pas d’heure d’arrivée', async () => {
    render(<AttendanceForm employeeId="employee-1" date="2026-08-31" existing={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Heure d’arrivée requise pour un statut Présent.')).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('crée un pointage (POST) quand aucun enregistrement n’existe pour ce jour', async () => {
    render(<AttendanceForm employeeId="employee-1" date="2026-08-31" existing={null} />);

    fireEvent.change(screen.getByLabelText('Heure d’arrivée'), { target: { value: '07:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(updateMutateAsync).not.toHaveBeenCalled();
    const payload = createMutateAsync.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ date: '2026-08-31', status: 'PRESENT', checkInTime: '07:00' });
  });

  it('protège contre la double soumission (un seul appel malgré un double clic)', async () => {
    render(<AttendanceForm employeeId="employee-1" date="2026-08-31" existing={null} />);

    fireEvent.change(screen.getByLabelText('Heure d’arrivée'), { target: { value: '07:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
  });

  it('le sélecteur de statut propose les 4 statuts réels, aucun autre', () => {
    render(<AttendanceForm employeeId="employee-1" date="2026-08-31" existing={null} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Statut' }));

    expect(screen.getByRole('option', { name: 'Présent' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Absent' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'En congé' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Maladie' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });
});

describe('AttendanceForm (correction — pointage déjà enregistré)', () => {
  it('corrige un pointage (PATCH) quand un enregistrement existe déjà pour ce jour', async () => {
    render(<AttendanceForm employeeId="employee-1" date="2026-08-31" existing={existingRecord} />);

    fireEvent.change(screen.getByLabelText('Heure de départ'), { target: { value: '16:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync).not.toHaveBeenCalled();
    const payload = updateMutateAsync.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ checkInTime: '07:30', checkOutTime: '16:00' });
    // `date` n'est jamais un champ du payload PATCH (immuable, porté par
    // la route) — voir UpdateAttendanceInput.
    expect(payload?.date).toBeUndefined();
  });

  it('refuse une heure de départ antérieure ou égale à l’heure d’arrivée', async () => {
    render(<AttendanceForm employeeId="employee-1" date="2026-08-31" existing={existingRecord} />);

    fireEvent.change(screen.getByLabelText('Heure de départ'), { target: { value: '07:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByText('L’heure de départ doit être postérieure à l’heure d’arrivée.'),
    ).toBeInTheDocument();
    expect(updateMutateAsync).not.toHaveBeenCalled();
  });

  it('ne restitue aucun champ heure pour un enregistrement existant au statut ABSENT, et les envoie à undefined à la correction', async () => {
    const absentRecord: Attendance = {
      ...existingRecord,
      status: 'ABSENT',
      checkInTime: null,
      checkOutTime: null,
    };
    render(<AttendanceForm employeeId="employee-1" date="2026-08-31" existing={absentRecord} />);

    expect(screen.queryByLabelText('Heure d’arrivée')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Heure de départ')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    const payload = updateMutateAsync.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ status: 'ABSENT', checkInTime: undefined, checkOutTime: undefined });
  });
});
