import { BadRequestException, Injectable } from '@nestjs/common';

export interface ValidatedFile {
  mimeType: string;
  extension: string;
}

interface FileSignature {
  mime: string;
  extension: string;
  bytes: number[];
}

/**
 * Signatures magic-bytes des formats minimum de la Phase 2 (PDF/JPG/PNG) —
 * vérification du contenu réel, jamais du nom de fichier ni du
 * Content-Type multipart déclaré par l'appelant (tous deux falsifiables).
 *
 * Écrit en interne plutôt que via un paquet de sniff générique (ex.
 * `file-type`) : ce dernier est ESM-only, et un `import()` dynamique
 * (nécessaire pour le consommer depuis ce backend CommonJS) échoue sous
 * Jest sans le flag expérimental --experimental-vm-modules
 * (`TypeError: A dynamic import callback was invoked without
 * --experimental-vm-modules`, vérifié en exécutant les tests unitaires).
 * Pour seulement 3 signatures fixes, une détection manuelle évite cette
 * fragilité et une dépendance dont on n'utiliserait qu'une fraction infime
 * des formats reconnus.
 */
const SIGNATURES: FileSignature[] = [
  { mime: 'application/pdf', extension: '.pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { mime: 'image/png', extension: '.png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', extension: '.jpg', bytes: [0xff, 0xd8, 0xff] },
];

function matchesSignature(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) {
    return false;
  }
  return signature.every((byte, index) => buffer[index] === byte);
}

@Injectable()
export class DocumentValidationService {
  validate(buffer: Buffer): ValidatedFile {
    const match = SIGNATURES.find((signature) => matchesSignature(buffer, signature.bytes));
    if (!match) {
      throw new BadRequestException(
        'Type de fichier non autorisé (formats acceptés : PDF, JPG, PNG).',
      );
    }
    return { mimeType: match.mime, extension: match.extension };
  }
}
