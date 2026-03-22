/**
 * constants/errors.ts — user-facing error messages keyed by HTTP status code
 *
 * UX-03: Previously all API errors surfaced as the raw server message or a
 * generic "Error al reservar." string. Status-code-specific messages give
 * users actionable guidance instead of cryptic technical text.
 *
 * Usage:
 *   import { friendlyError } from "@/constants/errors";
 *   const msg = friendlyError(err instanceof ApiError ? err.status : 0, err.message);
 */

/** Maps HTTP status codes to Spanish user-facing messages. */
const STATUS_MESSAGES: Record<number, string> = {
  400: "Los datos enviados no son válidos. Recarga la página e inténtalo de nuevo.",
  401: "Tu sesión ha caducado. Cierra sesión y vuelve a entrar.",
  403: "No tienes permiso para realizar esta acción.",
  409: "Este horario ya no está disponible. Por favor elige otro.",
  429: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
  500: "Error del servidor. Si el problema persiste, escribe a contacto@gustavoai.dev.",
  502: "Error al contactar con el servicio. Inténtalo de nuevo en unos segundos.",
};

/**
 * Returns a user-friendly Spanish error message.
 *
 * @param status   HTTP status code from the failed response (pass 0 for network errors)
 * @param fallback The raw server message — used when no status-specific text exists,
 *                 or when the status is 0 (network failure / timeout)
 */
export function friendlyError(status: number, fallback: string): string {
  return STATUS_MESSAGES[status] ?? fallback;
}
