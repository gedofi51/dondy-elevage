import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('renders the navigation and the page content', () => {
    render(
      <AppShell>
        <p>Contenu de la page</p>
      </AppShell>,
    );

    expect(screen.getAllByText('Tableau de bord').length).toBeGreaterThan(0);
    expect(screen.getByText('Contenu de la page')).toBeInTheDocument();
  });
});
