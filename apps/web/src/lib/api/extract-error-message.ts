/** Extrait le message d'erreur porté par le body JSON d'une réponse API
 * NestJS (`{message: string | string[]}`) — fallback si le body n'a pas
 * cette forme (erreur réseau, réponse non-JSON, etc.). Mutualisé depuis
 * un pattern dupliqué en Phase 9/11 (set-password-form.tsx,
 * water-reading-form.tsx) — voir DETTE_TECHNIQUE.md. */
export function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(' ');
  }
  return fallback;
}
