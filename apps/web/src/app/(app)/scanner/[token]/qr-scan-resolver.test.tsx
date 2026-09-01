import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/lib/api/client';
import { QrScanResolver } from './qr-scan-resolver';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api/use-api-fetch', () => ({
  useApiFetch: () => apiFetchMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QrScanResolver', () => {
  it.each([
    ['BROILER_BATCH', '/poulets-chair/entity-1'],
    ['LAYER_BATCH', '/pondeuses/entity-1'],
    ['ASSET', '/patrimoine/entity-1'],
    ['ITEM', '/stocks/entity-1'],
  ] as const)('redirige %s vers %s', async (entityType, expectedPath) => {
    apiFetchMock.mockResolvedValue({ entityType, entityId: 'entity-1' });
    render(<QrScanResolver token="abc123" />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith(expectedPath));
    expect(apiFetchMock).toHaveBeenCalledWith('/qr-codes/resoudre/abc123');
  });

  it('affiche un message dédié sur 404 (jeton inconnu ou révoqué)', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(404, { message: 'QR introuvable ou révoqué.' }));
    render(<QrScanResolver token="abc123" />);
    expect(await screen.findByText('QR introuvable ou révoqué.')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('affiche un message dédié sur 403 (permission insuffisante)', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, { message: 'Permissions insuffisantes.' }));
    render(<QrScanResolver token="abc123" />);
    expect(await screen.findByText('Vous n’avez pas la permission de consulter cette fiche.')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
