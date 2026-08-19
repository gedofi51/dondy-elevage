import { BadRequestException } from '@nestjs/common';
import { DocumentValidationService } from './document-validation.service';

// Signatures magic-bytes minimales, réelles — on vérifie le sniff de
// contenu réel, pas un mock.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const PDF_SIGNATURE = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'binary');
// En-tête ZIP local (PK\x03\x04) — même signature qu'un .docx : un format
// réel mais hors allowlist PDF/JPG/PNG, distinct d'un buffer simplement
// vide/arbitraire.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
const GARBAGE = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);

describe('DocumentValidationService', () => {
  const service = new DocumentValidationService();

  it('accepte un PNG (signature réelle) et dérive l’extension .png', () => {
    const result = service.validate(PNG_SIGNATURE);
    expect(result).toEqual({ mimeType: 'image/png', extension: '.png' });
  });

  it('accepte un JPEG (signature réelle) et dérive l’extension .jpg', () => {
    const result = service.validate(JPEG_SIGNATURE);
    expect(result).toEqual({ mimeType: 'image/jpeg', extension: '.jpg' });
  });

  it('accepte un PDF (signature réelle) et dérive l’extension .pdf', () => {
    const result = service.validate(PDF_SIGNATURE);
    expect(result).toEqual({ mimeType: 'application/pdf', extension: '.pdf' });
  });

  it('rejette un format réel mais hors allowlist (ZIP/.docx)', () => {
    expect(() => service.validate(ZIP_SIGNATURE)).toThrow(BadRequestException);
  });

  it('rejette un buffer non reconnu (contenu arbitraire)', () => {
    expect(() => service.validate(GARBAGE)).toThrow(BadRequestException);
  });
});
