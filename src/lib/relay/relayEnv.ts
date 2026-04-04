/**
 * Relay pinning node HTTP surface (FR-7c / FR-7d).
 *
 * Set **`VITE_RELAY_ORIGIN`** to the relay’s HTTP origin **without** `/ipfs/`, e.g. `http://localhost:81`.
 * The app derives:
 * - **Pinned CID gateway base:** `{origin}/ipfs/` (used for preview URLs and HEAD/Range probes)
 * - **Health:** `GET {origin}/health` (same host as the gateway, not the Vite dev server)
 *
 * **Legacy:** `VITE_RELAY_PINNED_CID_BASE` (e.g. `http://localhost:81/ipfs/`) is still read if
 * `VITE_RELAY_ORIGIN` is unset; the origin is inferred by stripping a trailing `/ipfs` path.
 *
 * **Pinning API (`GET /pinning/databases`, …):** defaults to the same origin as {@link getRelayOrigin}
 * (single-listener relay). When the metrics server runs on another port (e.g. **`9090`** in
 * `orbitdb-relay-pinner`), set **`VITE_RELAY_METRICS_ORIGIN`** to that base URL (no trailing slash).
 */

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

/**
 * Strip trailing slashes and remove a terminal `/ipfs` segment to recover the relay origin
 * from the old env shape.
 */
export function relayOriginFromLegacyPinnedBase(raw: string): string {
  let u = stripTrailingSlashes(raw.trim());
  if (u.endsWith('/ipfs')) {
    u = u.slice(0, -'/ipfs'.length);
  }
  return stripTrailingSlashes(u);
}

/** Relay HTTP origin with no trailing slash, or empty when unset. */
export function getRelayOrigin(): string {
  const o = import.meta.env.VITE_RELAY_ORIGIN?.trim();
  if (o) return stripTrailingSlashes(o);
  const legacy = import.meta.env.VITE_RELAY_PINNED_CID_BASE?.trim();
  if (legacy) return relayOriginFromLegacyPinnedBase(legacy);
  return '';
}

export function normalizeRelayPinnedBase(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return t.endsWith('/') ? t : `${t}/`;
}

/** Normalized `{origin}/ipfs/` for gateway URLs, or empty when no relay is configured. */
export function getRelayPinnedCidBase(): string {
  const origin = getRelayOrigin();
  if (!origin) return '';
  return `${origin}/ipfs/`;
}

/**
 * Same origin as {@link getRelayPinnedCidBase} but without path — for `GET /health` on the relay node.
 * Empty when relay is not configured.
 */
export function getRelayHealthOriginForFetch(): string {
  return getRelayOrigin();
}

/**
 * HTTP origin for **`/pinning/*`** on `orbitdb-relay-pinner` (default **`METRICS_PORT`** e.g. 9090).
 * Falls back to {@link getRelayOrigin} when unset so gateway + pinning share one host.
 */
export function getRelayMetricsOriginForFetch(): string {
  const m = import.meta.env.VITE_RELAY_METRICS_ORIGIN?.trim();
  if (m) return stripTrailingSlashes(m);
  return getRelayOrigin();
}

/** Full preview URL for a CID on the relay gateway. */
export function relayPreviewUrl(pinnedBase: string, cid: string): string {
  const base = normalizeRelayPinnedBase(pinnedBase);
  const c = cid.trim().replace(/^\/+/, '');
  return `${base}${c}`;
}

/**
 * HTTP URL to load a CID from the configured pinning relay **`/ipfs/`** only (no public gateways).
 * Empty when **`VITE_RELAY_ORIGIN`** / legacy pinned base is unset — callers should use local Helia blob URLs only.
 */
export function relayOnlyIpfsUrlForCid(cid: string): string {
  const c = typeof cid === 'string' ? cid.trim() : '';
  if (!c) return '';
  const base = getRelayPinnedCidBase();
  if (!base) return '';
  return relayPreviewUrl(base, c);
}
