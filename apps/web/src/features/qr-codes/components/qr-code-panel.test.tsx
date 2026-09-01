import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PermissionCode } from '@dondy-elevage/shared-types';
import { QrCodePanel } from './qr-code-panel';

const useEntityQrCodeMock = vi.fn();
const useEntityQrCodeScansMock = vi.fn();
const generateMutateMock = vi.fn();
const regenerateMutateMock = vi.fn();
const revokeMutateMock = vi.fn();

vi.mock('../hooks', () => ({
  useEntityQrCode: () => useEntityQrCodeMock(),
  useEntityQrCodeScans: () => useEntityQrCodeScansMock(),
  useGenerateQrCode: () => ({ mutate: generateMutateMock, isPending: false, data: undefined }),
  useRegenerateQrCode: () => ({ mutate: regenerateMutateMock, isPending: false, data: undefined }),
  useRevokeQrCode: () => ({ mutate: revokeMutateMock, isPending: false }),
}));

// Distingue les deux permissions (lecture vs écriture) du panneau — le mock
// d'AttendanceRegister (un seul `canEnabled` booléen) ne suffit pas ici :
// QrCodePanel gate le panneau ENTIER par readPermission ET ses boutons par
// updatePermission indépendamment (voir qr-code-panel.tsx).
let allowedPermissions = new Set<PermissionCode>();
vi.mock('@/components/shared/permission-gate', () => ({
  Can: ({
    permission,
    children,
    fallback,
  }: {
    permission: PermissionCode;
    children: ReactNode;
    fallback?: ReactNode;
  }) => (allowedPermissions.has(permission) ? <>{children}</> : <>{fallback ?? null}</>),
}));

const READ = 'items.read' as PermissionCode;
const UPDATE = 'items.update' as PermissionCode;

beforeEach(() => {
  allowedPermissions = new Set();
  useEntityQrCodeScansMock.mockReturnValue({ data: [] });
  vi.clearAllMocks();
});

function renderPanel() {
  return render(
    <QrCodePanel apiSegment="items" entityId="item-1" readPermission={READ} updatePermission={UPDATE} />,
  );
}

describe('QrCodePanel', () => {
  it('ne rend rien pour un rôle sans permission de lecture', () => {
    useEntityQrCodeMock.mockReturnValue({ data: null, isLoading: false });
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche « Jamais généré » et le bouton Générer pour un rôle avec lecture+écriture', () => {
    allowedPermissions = new Set([READ, UPDATE]);
    useEntityQrCodeMock.mockReturnValue({ data: null, isLoading: false });
    renderPanel();
    expect(screen.getByText('Jamais généré')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Générer un QR/ })).toBeInTheDocument();
  });

  it('masque le bouton Générer pour un rôle en lecture seule', () => {
    allowedPermissions = new Set([READ]);
    useEntityQrCodeMock.mockReturnValue({ data: null, isLoading: false });
    renderPanel();
    expect(screen.getByText('Jamais généré')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Générer un QR/ })).not.toBeInTheDocument();
  });

  it('affiche le statut Actif et le compteur de scans quand un QR existe', () => {
    allowedPermissions = new Set([READ, UPDATE]);
    useEntityQrCodeMock.mockReturnValue({
      data: {
        id: 'qr-1',
        entityType: 'ITEM',
        entityId: 'item-1',
        revoked: false,
        scanCount: 3,
        lastScannedAt: '2026-08-01T00:00:00.000Z',
      },
      isLoading: false,
    });
    renderPanel();
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText(/3 scans/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Régénérer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Révoquer/ })).toBeInTheDocument();
  });

  it('masque Régénérer/Révoquer pour un rôle en lecture seule sur un QR actif', () => {
    allowedPermissions = new Set([READ]);
    useEntityQrCodeMock.mockReturnValue({
      data: { id: 'qr-1', entityType: 'ITEM', entityId: 'item-1', revoked: false, scanCount: 0, lastScannedAt: null },
      isLoading: false,
    });
    renderPanel();
    expect(screen.queryByRole('button', { name: /Régénérer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Révoquer/ })).not.toBeInTheDocument();
  });

  it('affiche « Révoqué » et le bouton Générer quand le dernier QR est révoqué', () => {
    allowedPermissions = new Set([READ, UPDATE]);
    useEntityQrCodeMock.mockReturnValue({
      data: { id: 'qr-1', entityType: 'ITEM', entityId: 'item-1', revoked: true, scanCount: 1, lastScannedAt: null },
      isLoading: false,
    });
    renderPanel();
    expect(screen.getByText('Révoqué')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Générer un QR/ })).toBeInTheDocument();
  });
});
