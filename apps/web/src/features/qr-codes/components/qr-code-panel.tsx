'use client';

import { useState } from 'react';
import { QrCode as QrCodeIcon, RefreshCw, Ban, Copy, History } from 'lucide-react';
import type { PermissionCode } from '@dondy-elevage/shared-types';
import { Can } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type QrCodeApiSegment,
  useEntityQrCode,
  useEntityQrCodeScans,
  useGenerateQrCode,
  useRegenerateQrCode,
  useRevokeQrCode,
} from '../hooks';

interface QrCodePanelProps {
  apiSegment: QrCodeApiSegment;
  entityId: string;
  /** Même permission qu'un accès direct à la fiche — le panneau lui-même
   * (et son GET .../qr-code) ne doit pas être visible sans elle. */
  readPermission: PermissionCode;
  /** Réutilise la permission UPDATE de l'entité pour générer/régénérer/
   * révoquer (décision confirmée Lot 1 — pas de permission QR dédiée). */
  updatePermission: PermissionCode;
}

/**
 * Écran de gestion du QR d'une fiche (Lot 1 "fondations") — panneau
 * autonome greffé sur chaque fiche confirmée (BroilerBatch/LayerBatch/
 * Asset/Item), même patron d'injection que EntityAlertsWidget. Le QR
 * n'encode jamais de donnée métier : uniquement un jeton opaque, résolu
 * côté serveur avec les mêmes contrôles RBAC/farmId qu'un accès direct
 * (voir /scanner/[token]).
 */
export function QrCodePanel({ apiSegment, entityId, readPermission, updatePermission }: QrCodePanelProps) {
  const { data: qrCode, isLoading } = useEntityQrCode(apiSegment, entityId);
  const generate = useGenerateQrCode(apiSegment, entityId);
  const regenerate = useRegenerateQrCode(apiSegment, entityId);
  const revoke = useRevokeQrCode(apiSegment, entityId);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const scansQuery = useEntityQrCodeScans(apiSegment, entityId, showHistory);

  const pending = generate.isPending || regenerate.isPending || revoke.isPending;
  const generated = generate.data ?? regenerate.data;

  async function copyScanUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission
      // refusée...) — le lien reste affiché et sélectionnable manuellement,
      // rien de plus à faire ici.
    }
  }

  return (
    <Can permission={readPermission}>
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <QrCodeIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          QR Code
        </h2>

        {isLoading ? (
          <Skeleton className="h-24 w-24" />
        ) : !qrCode || qrCode.revoked ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <StatusBadge label={qrCode ? 'Révoqué' : 'Jamais généré'} tone="muted" />
            </div>
            <Can permission={updatePermission}>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => generate.mutate()}
                className="w-fit"
              >
                <QrCodeIcon aria-hidden="true" />
                Générer un QR
              </Button>
            </Can>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label="Actif" tone="success" />
              <span className="text-xs text-muted-foreground">
                {qrCode.scanCount === 0
                  ? 'Jamais scanné'
                  : `${qrCode.scanCount} scan${qrCode.scanCount > 1 ? 's' : ''}${
                      qrCode.lastScannedAt
                        ? ` · dernier le ${new Date(qrCode.lastScannedAt).toLocaleDateString('fr-FR')}`
                        : ''
                    }`}
              </span>
            </div>

            {generated ? (
              <div className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL PNG généré côté serveur, pas une ressource à optimiser */}
                <img src={generated.qrCodeDataUrl} alt="QR Code" className="h-32 w-32 rounded-md border border-border" />
                <div className="flex items-center gap-1.5">
                  <code className="max-w-[220px] truncate text-xs text-muted-foreground">{generated.scanUrl}</code>
                  <Button variant="ghost" size="icon-xs" onClick={() => copyScanUrl(generated.scanUrl)}>
                    <Copy aria-hidden="true" />
                  </Button>
                  {copied ? <span className="text-xs text-success">Copié</span> : null}
                </div>
              </div>
            ) : (
              // Seul le hash du jeton est stocké en base (même principe que
              // les jetons d'activation/reset) — l'image ne peut donc être
              // reconstituée après coup : elle n'est affichable qu'au
              // moment même de la génération/régénération, jamais depuis
              // un simple GET de statut. Régénérer reste le seul recours
              // pour ré-obtenir une image affichable (invalide l'ancienne).
              <p className="max-w-sm text-xs text-muted-foreground">
                Image non ré-affichable après coup (jeton jamais stocké en clair). Régénérez pour
                obtenir une nouvelle image imprimable — l’ancien QR cessera alors de fonctionner.
              </p>
            )}

            <Can permission={updatePermission}>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => regenerate.mutate()}>
                  <RefreshCw aria-hidden="true" />
                  Régénérer
                </Button>
                <Button variant="destructive" size="sm" disabled={pending} onClick={() => revoke.mutate()}>
                  <Ban aria-hidden="true" />
                  Révoquer
                </Button>
              </div>
            </Can>
          </div>
        )}

        {qrCode && qrCode.scanCount > 0 ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setShowHistory((v) => !v)}
            >
              <History aria-hidden="true" />
              {showHistory ? 'Masquer l’historique' : 'Voir l’historique'}
            </Button>
            {showHistory ? (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {(scansQuery.data ?? []).map((scan) => (
                  <li key={scan.id}>{new Date(scan.scannedAt).toLocaleString('fr-FR')}</li>
                ))}
                {scansQuery.data?.length === 0 ? <li>Aucun scan récent.</li> : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </Can>
  );
}
