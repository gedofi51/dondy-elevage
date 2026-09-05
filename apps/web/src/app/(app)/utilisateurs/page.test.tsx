import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PublicUser, Role } from '@dondy-elevage/shared-types';
import UsersPage from './page';

const useUsersMock = vi.fn();
vi.mock('@/features/users/hooks', () => ({
  useUsers: () => useUsersMock(),
}));

const roles: Role[] = [
  { id: 'role-owner', name: 'Propriétaire / Administrateur', isSystem: true },
  { id: 'role-reader', name: 'Lecteur / Lecture seule', isSystem: true },
];
vi.mock('@/features/roles/hooks', () => ({
  useRoles: () => ({ data: roles, isLoading: false }),
}));

let mockPermissions: string[] = ['users.create', 'users.update'];
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: { permissions: mockPermissions } }),
}));

function makeUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions = ['users.create', 'users.update'];
});

describe('UsersPage', () => {
  it('affiche les utilisateurs de la ferme avec nom, email, rôle(s) et statut', () => {
    useUsersMock.mockReturnValue({ data: [makeUser()], isLoading: false });
    render(<UsersPage />);

    expect(screen.getByText('Jean Koyamba')).toBeInTheDocument();
    expect(screen.getByText('jean@test.local')).toBeInTheDocument();
    expect(screen.getByText('Lecteur / Lecture seule')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('propose le bouton Nouvel utilisateur et un lien Modifier par ligne quand les permissions le permettent', () => {
    useUsersMock.mockReturnValue({ data: [makeUser()], isLoading: false });
    render(<UsersPage />);

    expect(screen.getByRole('button', { name: /Nouvel utilisateur/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier' })).toHaveAttribute(
      'href',
      '/utilisateurs/user-1/modifier',
    );
  });

  it('masque la création/modification sans les permissions USERS_CREATE/USERS_UPDATE', () => {
    mockPermissions = [];
    useUsersMock.mockReturnValue({ data: [makeUser()], isLoading: false });
    render(<UsersPage />);

    expect(screen.queryByRole('button', { name: /Nouvel utilisateur/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
  });

  it('affiche un état vide explicite en l’absence d’utilisateur', () => {
    useUsersMock.mockReturnValue({ data: [], isLoading: false });
    render(<UsersPage />);
    expect(screen.getByText('Aucun utilisateur ne correspond à ce filtre.')).toBeInTheDocument();
  });
});
