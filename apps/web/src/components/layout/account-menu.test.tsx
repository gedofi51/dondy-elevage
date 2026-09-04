import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountMenu } from './account-menu';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const logoutMock = vi.fn().mockResolvedValue(undefined);
let mockUser: { roles: string[] } | null = { roles: ['Propriétaire / Administrateur'] };
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser, logout: logoutMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { roles: ['Propriétaire / Administrateur'] };
});

describe('AccountMenu', () => {
  it('affiche le(s) rôle(s) de l’utilisateur et permet de se déconnecter', async () => {
    render(<AccountMenu trigger={<button type="button">Compte</button>} />);

    fireEvent.click(screen.getByText('Compte'));
    expect(await screen.findByText('Propriétaire / Administrateur')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Se déconnecter'));
    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith('/connexion');
  });

  it('reste utilisable (déconnexion) même sans utilisateur résolu', async () => {
    mockUser = null;
    render(<AccountMenu trigger={<button type="button">Compte</button>} />);

    fireEvent.click(screen.getByText('Compte'));
    expect(await screen.findByText('Se déconnecter')).toBeInTheDocument();
  });
});
