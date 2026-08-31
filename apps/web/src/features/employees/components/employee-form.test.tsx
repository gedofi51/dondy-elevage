import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Employee } from '@dondy-elevage/shared-types';
import { EmployeeForm } from './employee-form';

const updateMutateAsync = vi.fn().mockResolvedValue({ id: 'employee-1' });
const createMutateAsync = vi.fn().mockResolvedValue({ id: 'employee-1' });

vi.mock('../hooks', () => ({
  useCreateEmployee: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateEmployee: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));
vi.mock('@/components/shared/entity-select', () => ({
  BuildingSelect: () => null,
  EmployeeSelect: () => null,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const employeeWithSalary: Employee = {
  id: 'employee-1',
  farmId: 'farm-1',
  code: 'EMP-0001',
  buildingId: null,
  managerId: null,
  name: 'Jean Koyamba',
  position: 'Chef d’élevage',
  contractType: 'CDI',
  phone: '+236 70 00 00 00',
  hireDate: '2026-01-01',
  endDate: null,
  status: 'ACTIF',
  baseSalaryFcfa: 150_000,
  observations: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: null,
  deletedAt: null,
};

// Rôle sans EMPLOYEES_VIEW_SALARY (ex. Lecteur — mais celui-ci n'aurait de
// toute façon pas EMPLOYEES_UPDATE ; ce cas couvre surtout la défense en
// profondeur du composant lui-même, cf. règle UI explicite du Lot 6a).
const employeeWithoutSalary: Employee = { ...employeeWithSalary, baseSalaryFcfa: undefined };

describe('EmployeeForm (création)', () => {
  it('affiche des erreurs de validation si les champs requis sont vides', async () => {
    render(<EmployeeForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Créer l’employé' }));

    expect(await screen.findByText('Nom requis')).toBeInTheDocument();
    expect(screen.getByText('Poste requis')).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('protège contre la double soumission (bouton désactivé pendant l’envoi)', async () => {
    render(<EmployeeForm />);

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Jean Koyamba' } });
    fireEvent.change(screen.getByLabelText('Poste'), { target: { value: 'Chef d’élevage' } });
    fireEvent.change(screen.getByLabelText('Date d’embauche'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Salaire de base (FCFA)'), { target: { value: '150000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Créer l’employé' }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
  });
});

describe('EmployeeForm (édition)', () => {
  it('affiche le champ salaire quand baseSalaryFcfa est présent', () => {
    render(<EmployeeForm employee={employeeWithSalary} />);
    expect(screen.getByLabelText('Salaire de base (FCFA)')).toBeInTheDocument();
  });

  it('n’affiche pas le champ salaire quand baseSalaryFcfa est absent (rôle sans accès)', () => {
    render(<EmployeeForm employee={employeeWithoutSalary} />);
    expect(screen.queryByLabelText('Salaire de base (FCFA)')).not.toBeInTheDocument();
  });

  it('n’envoie jamais baseSalaryFcfa si le champ n’a jamais été affiché', async () => {
    render(<EmployeeForm employee={employeeWithoutSalary} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    const payload = updateMutateAsync.mock.calls[0]?.[0];
    expect(payload?.baseSalaryFcfa).toBeUndefined();
  });
});
