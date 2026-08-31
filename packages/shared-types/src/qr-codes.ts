/**
 * QR Codes (Lot 1 "fondations", cahier V6 §9) — modèle générique
 * entityType/entityId résolu par jeton opaque, même patron que
 * Document.entityType/entityId côté modélisation. Périmètre confirmé
 * après investigation : BROILER_BATCH/LAYER_BATCH/ASSET/ITEM, seules
 * entités disposant déjà d'une fiche de lecture réelle côté web —
 * Building/Incubator explicitement reportés (aucune fiche de lecture à ce
 * jour), voir DETTE_TECHNIQUE.md. Aucune entité "Magasin" (dette déjà
 * documentée, Phase 7 — concept multi-magasin absent du modèle de
 * données).
 *
 * Le QR n'encode jamais de donnée métier : uniquement un jeton opaque
 * haute entropie, résolu côté serveur avec les MÊMES contrôles
 * RBAC/farmId qu'un accès direct à la fiche.
 */
export type QrEntityType = 'BROILER_BATCH' | 'LAYER_BATCH' | 'ASSET' | 'ITEM';

/**
 * État courant du QR d'une fiche — `null` (pas ce type) tant qu'aucun QR
 * n'a jamais été généré pour cette entité, voir hooks.ts côté web.
 * `scanCount`/`lastScannedAt` résument QrCodeScan pour l'écran de
 * gestion — jamais l'historique ligne à ligne.
 */
export interface QrCodeStatus {
  id: string;
  entityType: QrEntityType;
  entityId: string;
  revoked: boolean;
  createdAt: string;
  scanCount: number;
  lastScannedAt: string | null;
}

/**
 * Réponse de génération/régénération : `qrCodeDataUrl` est un data URL PNG
 * (voir `toDataURL`, librairie `qrcode`, déjà utilisée pour le QR TOTP de
 * la 2FA) — affichable directement dans un `<img>`, jamais persisté tel
 * quel côté serveur (régénérable à volonté depuis le jeton stocké... en
 * réalité re-généré à la volée à chaque appel, voir QrCodesService).
 */
export interface QrCodeGenerated extends QrCodeStatus {
  qrCodeDataUrl: string;
  /** Même URL que celle encodée dans qrCodeDataUrl, en clair — repli
   * copiable pour l'utilisateur (affichage/partage manuel du lien sous le
   * QR). N'ajoute aucune fuite : c'est l'information déjà portée par le
   * QR affiché à l'écran. */
  scanUrl: string;
}

/** Résultat de la résolution d'un scan (`GET /qr-codes/resoudre/:token`).
 * Volontairement dépourvu de chemin de redirection : c'est au frontend de
 * traduire entityType/entityId en route (voir QR_ENTITY_ROUTES,
 * apps/web) — le contrat API reste indépendant du routage front. */
export interface QrCodeResolution {
  entityType: QrEntityType;
  entityId: string;
}
