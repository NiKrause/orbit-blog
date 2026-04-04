/**
 * Relay pinning preview (FR-7d) + metrics health probe for LED states (FR-7c).
 *
 * - `VITE_RELAY_PINNED_CID_BASE` — HTTP gateway base for pinned CIDs (e.g. `http://localhost:81/ipfs/`).
 * - `VITE_RELAY_METRICS_BASE` — Optional origin for `orbitdb-relay-pinner` metrics HTTP server (`GET /health`).
 *   In **dev**, defaults to same-origin `/api/relay` (see `vite.config.ts` proxy → metrics port).
 */

export function normalizeRelayPinnedBase(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return t.endsWith('/') ? t : `${t}/`;
}

/** Normalized pinned-CID base URL, or empty when unset. */
export function getRelayPinnedCidBase(): string {
  const v = import.meta.env.VITE_RELAY_PINNED_CID_BASE?.trim();
  if (!v) return '';
  return normalizeRelayPinnedBase(v);
}

/**
 * Base URL for metrics `/health` (no trailing slash). Empty = skip health (LED uses HEAD-only phases).
 */
export function getRelayMetricsBaseForFetch(): string {
  const v = import.meta.env.VITE_RELAY_METRICS_BASE?.trim();
  if (v) return v.replace(/\/$/, '');
  if (import.meta.env.DEV) return '/api/relay';
  return '';
}

/** Full preview URL for a CID on the relay gateway. */
export function relayPreviewUrl(pinnedBase: string, cid: string): string {
  const base = normalizeRelayPinnedBase(pinnedBase);
  const c = cid.trim().replace(/^\/+/, '');
  return `${base}${c}`;
}
