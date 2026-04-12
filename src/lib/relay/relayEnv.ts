/**
 * Relay pinning node HTTP surface (FR-7c / FR-7d).
 *
 * Set **`VITE_RELAY_ORIGIN`** to one or more relay HTTP origins **without** `/ipfs/`, e.g.
 * `http://localhost:81` or `https://relay-a.example,https://relay-b.example`.
 * The app derives:
 * - **Pinned CID gateway base:** `{origin}/ipfs/` (used for preview URLs and HEAD/Range probes)
 * - **Health:** `GET {origin}/health` (same host as the gateway, not the Vite dev server)
 *
 * **Legacy:** `VITE_RELAY_PINNED_CID_BASE` (e.g. `http://localhost:81/ipfs/`) is still read if
 * `VITE_RELAY_ORIGIN` is unset; the origin is inferred by stripping a trailing `/ipfs` path.
 *
 * **Pinning API (`GET /pinning/databases`, …):** defaults to the same origin set as {@link getRelayOrigins}
 * (single-listener relay). When the metrics server runs on another port, set
 * **`VITE_RELAY_METRICS_ORIGIN`** to one or more base URLs (no trailing slash), comma-separated.
 */

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

function parseOriginList(raw: string | undefined | null): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((part) => stripTrailingSlashes(part.trim()))
    .filter(Boolean);
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

/** Relay HTTP origins with no trailing slash, or empty when unset. */
export function getRelayOrigins(): string[] {
  const configured = parseOriginList(import.meta.env.VITE_RELAY_ORIGIN);
  if (configured.length > 0) return configured;
  const legacy = import.meta.env.VITE_RELAY_PINNED_CID_BASE?.trim();
  if (legacy) return [relayOriginFromLegacyPinnedBase(legacy)];
  return [];
}

/** First configured relay HTTP origin with no trailing slash, or empty when unset. */
export function getRelayOrigin(): string {
  return getRelayOrigins()[0] || '';
}

export function normalizeRelayPinnedBase(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return t.endsWith('/') ? t : `${t}/`;
}

/** Normalized `{origin}/ipfs/` for gateway URLs, or empty when no relay is configured. */
export function getRelayPinnedCidBase(): string {
  return getRelayPinnedCidBases()[0] || '';
}

/** Normalized `{origin}/ipfs/` for every configured relay gateway. */
export function getRelayPinnedCidBases(): string[] {
  return getRelayOrigins().map((origin) => `${origin}/ipfs/`);
}

/**
 * Same origin as {@link getRelayPinnedCidBase} but without path — for `GET /health` on the relay node.
 * Empty when relay is not configured.
 */
export function getRelayHealthOriginForFetch(): string {
  return getRelayOrigin();
}

/** All configured relay origins for `GET /health`. */
export function getRelayHealthOriginsForFetch(): string[] {
  return getRelayOrigins();
}

/**
 * HTTP origin for **`/pinning/*`** on `orbitdb-relay-pinner` (default **`METRICS_PORT`** e.g. 9090).
 * Falls back to {@link getRelayOrigin} when unset so gateway + pinning share one host.
 */
export function getRelayMetricsOriginForFetch(): string {
  return getRelayMetricsOriginsForFetch()[0] || '';
}

/** All configured HTTP origins for **`/pinning/*`** on `orbitdb-relay-pinner`. */
export function getRelayMetricsOriginsForFetch(): string[] {
  const configured = parseOriginList(import.meta.env.VITE_RELAY_METRICS_ORIGIN);
  if (configured.length > 0) return configured;
  return getRelayOrigins();
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
