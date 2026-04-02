/**
 * FR-9: Maps transport / HTTP failures to svelte-i18n keys (no English in callers).
 *
 * Status mapping (see `mapHttpStatusToAiJobErrorKey`):
 * - **0** / opaque → `ai_job_error_cors_or_blocked`
 * - **401** → `ai_job_error_auth`
 * - **403** → `ai_job_error_forbidden`
 * - **429** → `ai_job_error_rate_limit`
 * - **5xx** → `ai_job_error_http_server`
 * - **other 4xx** → `ai_job_error_http_client`
 *
 * Browser "opaque" / CORS-blocked responses: `fetch` rejects or yields `type: 'opaque'`
 * with no readable body — treat like network/CORS (see `mapAiTransportError`).
 */
export const AI_JOB_ERROR_KEYS = {
  network: 'ai_job_error_network',
  auth: 'ai_job_error_auth',
  /** HTTP 403 — distinct from 401 for FR-9 mapping. */
  forbidden: 'ai_job_error_forbidden',
  rateLimit: 'ai_job_error_rate_limit',
  httpClient: 'ai_job_error_http_client',
  httpServer: 'ai_job_error_http_server',
  corsOrBlocked: 'ai_job_error_cors_or_blocked',
  unknown: 'ai_job_error_unknown',
  pollFailed: 'ai_job_error_poll_failed',
  badResponse: 'ai_job_error_bad_response',
  /** Poll loop exhausted without terminal job status (see `AiManager` max polls). */
  timeout: 'ai_job_error_timeout',
} as const;

export class AiTransportError extends Error {
  constructor(public readonly i18nKey: string) {
    super(i18nKey);
    this.name = 'AiTransportError';
  }
}

/** HTTP status → i18n key (response must be non-opaque for status codes). */
export function mapHttpStatusToAiJobErrorKey(status: number): string {
  if (status === 0) return AI_JOB_ERROR_KEYS.corsOrBlocked;
  if (status === 401) return AI_JOB_ERROR_KEYS.auth;
  if (status === 403) return AI_JOB_ERROR_KEYS.forbidden;
  if (status === 429) return AI_JOB_ERROR_KEYS.rateLimit;
  if (status >= 500) return AI_JOB_ERROR_KEYS.httpServer;
  if (status >= 400) return AI_JOB_ERROR_KEYS.httpClient;
  return AI_JOB_ERROR_KEYS.unknown;
}

/**
 * Maps thrown errors from `fetch` / JSON parse / our transport to an i18n key.
 * Prefer `response` when `fetch` returned a non-ok Response you already have.
 */
export function mapAiTransportError(err: unknown, response?: Response): string {
  if (err instanceof AiTransportError) return err.i18nKey;
  if (response !== undefined && response.type !== 'opaque') {
    return mapHttpStatusToAiJobErrorKey(response.status);
  }
  if (err instanceof TypeError) {
    return AI_JOB_ERROR_KEYS.network;
  }
  if (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') {
    return AI_JOB_ERROR_KEYS.unknown;
  }
  return AI_JOB_ERROR_KEYS.unknown;
}
