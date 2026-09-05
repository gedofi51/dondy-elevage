import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PublicUser, Role } from '@dondy-elevage/shared-types';
import { UserForm } from './user-form';

const createMutateAsync = vi.fn().mockResolvedValue({ id: 'user-1' });
const updateMutateAsync = vi.fn().mockResolvedValue({ id: 'user-1' });

vi.mock('../hooks', () => ({
  useCreateUser: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateUser: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

const roles: Role[] = [
  { id: 'role-owner', name: 'Propriétaire / Administrateur', isSystem: true },
  { id: 'role-reader', name: 'Lecteur / Lecture seule', isSystem: true },
];
vi.mock('@/features/roles/hooks', () => ({
  useRoles: () => ({ data: roles, isLoading: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

let currentUserId = 'someone-else';
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { sub: currentUserId } }),
}));

const baseUser: PublicUser = {
  id: 'user-1',
  farmId: 'farm-1',
  email: 'jean@test.local',
  name: 'Jean Koyamba',
  status: 'ACTIVE',
  emailVerified: true,
  twoFactorEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  userRoles: [{ role: { id: 'role-reader', name: 'Lecteur / Lecture seule' } }],
};

beforeEach(() => {
  vi.clearAllMocks();
  currentUserId = 'someone-else';
});

describe('UserForm — création (invitation)', () => {
  it('exige au moins un rôle avant de soumettre', async () => {
    render(<UserForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));
    expect(await screen.findByText('Sélectionnez au moins un rôle.')).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('soumet email/nom/rôles sans jamais envoyer de mot de passe (invitation)', async () => {
    render(<UserForm />);

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Nouvel Utilisateur' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nouveau@test.local' } });
    fireEvent.click(screen.getByText('Lecteur / Lecture seule'));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]![0];
    expect(payload).toEqual({
      email: 'nouveau@test.local',
      name: 'Nouvel Utilisateur',
      roleIds: ['role-reader'],
    });
    expect(payload).not.toHaveProperty('password');
  });
});

describe('UserForm — édition', () => {
  it('préremplit nom, statut et rôles depuis l’utilisateur existant', () => {
    render(<UserForm user={baseUser} />);
    expect(screen.getByLabelText('Nom')).toHaveValue('Jean Koyamba');
    expect(screen.getByDisplayValue('jean@test.local')).toBeDisabled();
  });

  it('désactive le champ Statut quand l’utilisateur édite son propre compte (garde-fou auto-désactivation)', () => {
    currentUserId = baseUser.id;
    render(<UserForm user={baseUser} />);
    expect(screen.getByText('Vous ne pouvez pas modifier le statut de votre propre compte.')).toBeInTheDocument();
  });

  it('n’affiche pas l’avertissement quand ce n’est pas son propre compte', () => {
    render(<UserForm user={baseUser} />);
    expect(
      screen.queryByText('Vous ne pouvez pas modifier le statut de votre propre compte.'),
    ).not.toBeInTheDocument();
  });

  it('soumet le formulaire avec les valeurs modifiées', async () => {
    render(<UserForm user={baseUser} />);
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Jean K.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    expect(updateMutateAsync.mock.calls[0]![0]).toMatchObject({ name: 'Jean K.', status: 'ACTIVE' });
  });
});
