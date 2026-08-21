/** `NEXT_PUBLIC_API_URL` absente → dérive un défaut raisonnable (voir
 * .env.example, commentaire "pattern à reprendre en Phase 1") : Nginx
 * expose l'API sur le port 8080 en local (CLAUDE.md, mode hybride
 * Windows). Utilisable côté navigateur (Client Components, apiFetch) et
 * côté serveur (Route Handlers `/api/auth/*`, appels server-to-server). */
export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8080/api/v1`;
  }
  return 'http://localhost:8080/api/v1';
}
