import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * `process.cwd()` vaut toujours `apps/api` dans tous les modes d'exécution
 * de ce projet (Docker dev/prod, natif host, CI — confirmé via Dockerfile et
 * docker-compose.dev.yml) : pas de variable d'environnement nécessaire pour
 * ce chemin, contrairement à DATABASE_URL. Couvert par le bind-mount déjà en
 * place pour le conteneur api (`..:/repo`), non committé (voir .gitignore).
 */
const STORAGE_DIR = join(process.cwd(), 'storage', 'documents');

@Injectable()
export class DocumentStorageService {
  /**
   * Nom UUID généré — jamais le nom original de l'utilisateur (exigence de
   * sécurité : aucune donnée sensible ou secret ne doit apparaître dans un
   * nom de fichier stocké sur disque).
   */
  async save(buffer: Buffer, extension: string): Promise<string> {
    await mkdir(STORAGE_DIR, { recursive: true });
    const storedName = `${randomUUID()}${extension}`;
    await writeFile(this.resolvePath(storedName), buffer);
    return storedName;
  }

  resolvePath(storedName: string): string {
    return join(STORAGE_DIR, storedName);
  }
}
