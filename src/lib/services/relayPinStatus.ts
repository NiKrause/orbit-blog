/**
 * FR-7c / Story 4.3 — relay sync LED support.
 *
 * **DB on relay:** When **`mediaDbAddress`** and a **metrics origin** are available, the first tick **`POST {metrics}/pinning/sync`**
 * with **`{ dbAddress }`** asks the relay to sync that DB (`orbitdb-relay-pinner` `docs/http-api.md`). Then each tick uses
 * **`GET {metrics}/pinning/databases?address=…`** (targeted listing: **200** = row present, **404** = not in history yet).
 * When **`mediaContentCreatedAtIso`** is set (media document **`createdAt`**), **orange** only if **`lastSyncedAt` ≥** that time; otherwise stay **yellow** (**`listed_stale_sync`**) until the relay reports a newer sync.
 * Configure **`VITE_RELAY_METRICS_ORIGIN`** if pinning HTTP is not the same port as **`VITE_RELAY_ORIGIN`**.
 *
 * **Fallback:** **`GET {relayOrigin}/health`** (same host as **`{origin}/ipfs/…`**) when the databases probe is skipped or returns **unknown** (non-OK response, parse error, or missing config).
 *
 * **Green** = **HEAD** or tiny **Range GET** on **any configured** `{pinnedBase}{cid}` succeeds.
 */

import {
  getRelayHealthOriginsForFetch,
  getRelayMetricsOriginsForFetch,
  normalizeRelayPinnedBase,
} from '../relay/relayEnv.js';
import { mediaLog } from '../utils/logger.js';

export type RelayLedState = 'idle' | 'yellow' | 'orange' | 'green' | 'error';

/** Result of `GET /pinning/databases` vs a target OrbitDB manifest address (+ optional media `createdAt`). */
export type RelayMediaDbPinningProbe =
  | 'listed'
  | 'not_listed'
  /** Row exists but `lastSyncedAt` is missing/invalid or older than **`mediaContentCreatedAtIso`**. */
  | 'listed_stale_sync'
  | 'unknown';

export interface RelayPinningDatabaseRow {
  address?: string;
  lastSyncedAt?: string;
}

export interface RelayDatabaseListingResult {
  probe: Exclude<RelayMediaDbPinningProbe, 'listed_stale_sync'>;
  row: RelayPinningDatabaseRow | null;
}

function parseIsoToMs(iso: string | undefined | null): number | null {
  if (iso == null || typeof iso !== 'string') return null;
  const t = Date.parse(iso.trim());
  return Number.isNaN(t) ? null : t;
}

/** True when relay `lastSyncedAt` is at or after content `createdAt` (same moment counts as replicated). */
function relaySyncCoversContent(lastSyncedAtRaw: unknown, contentCreatedAtIso: string | undefined): boolean {
  const contentMs = parseIsoToMs(contentCreatedAtIso);
  if (contentMs === null) return true;
  if (typeof lastSyncedAtRaw !== 'string' || !lastSyncedAtRaw.trim()) return false;
  const syncMs = parseIsoToMs(lastSyncedAtRaw);
  if (syncMs === null) return false;
  return syncMs >= contentMs;
}

function normalizeOrbitDbAddress(addr: string): string {
  return addr.trim().replace(/\/+$/, '');
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function summarizeProbeResults(results: RelayMediaDbPinningProbe[]): RelayMediaDbPinningProbe {
  if (results.includes('listed')) return 'listed';
  if (results.includes('listed_stale_sync')) return 'listed_stale_sync';
  if (results.includes('not_listed')) return 'not_listed';
  return 'unknown';
}

function pickNewerRelayRow(
  current: RelayPinningDatabaseRow | null,
  candidate: RelayPinningDatabaseRow | null,
): RelayPinningDatabaseRow | null {
  if (!candidate) return current;
  if (!current) return candidate;
  const currentMs = parseIsoToMs(current.lastSyncedAt);
  const candidateMs = parseIsoToMs(candidate.lastSyncedAt);
  if (candidateMs === null) return current;
  if (currentMs === null) return candidate;
  return candidateMs > currentMs ? candidate : current;
}

function summarizeListingResults(results: RelayDatabaseListingResult[]): RelayDatabaseListingResult {
  let newestListedRow: RelayPinningDatabaseRow | null = null;
  for (const result of results) {
    if (result.probe === 'listed') {
      newestListedRow = pickNewerRelayRow(newestListedRow, result.row);
    }
  }
  if (newestListedRow) {
    return { probe: 'listed', row: newestListedRow };
  }
  if (results.some((result) => result.probe === 'not_listed')) {
    return { probe: 'not_listed', row: null };
  }
  return { probe: 'unknown', row: null };
}

/** @internal */
export async function probeRelayHealth(healthOrigin: string, signal?: AbortSignal): Promise<boolean> {
  const base = healthOrigin.replace(/\/$/, '');
  try {
    const r = await fetch(`${base}/health`, { method: 'GET', signal, cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

async function probeRelayHealthAny(healthOrigins: string[], signal?: AbortSignal): Promise<boolean> {
  for (const origin of uniqueNonEmpty(healthOrigins)) {
    if (await probeRelayHealth(origin, signal)) return true;
  }
  return false;
}

/**
 * **`POST /pinning/sync`** — ask the relay to open/sync one OrbitDB address (pin media CIDs, etc.).
 * Returns whether the relay responded **`200`** with **`ok: true`**.
 */
export async function requestRelayDbPinSync(
  metricsOrigin: string,
  dbAddressRaw: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const base = metricsOrigin.replace(/\/$/, '');
  const dbAddress = normalizeOrbitDbAddress(dbAddressRaw);
  if (!base || !dbAddress) return false;
  try {
    const r = await fetch(`${base}/pinning/sync`, {
      method: 'POST',
      signal,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbAddress }),
    });
    if (!r.ok) return false;
    const j = (await r.json()) as { ok?: boolean };
    return j?.ok === true;
  } catch {
    return false;
  }
}

export const requestRelayMediaDbPinSync = requestRelayDbPinSync;

async function requestRelayDbPinSyncAny(
  metricsOrigins: string[],
  dbAddress: string,
  signal?: AbortSignal,
): Promise<boolean> {
  let anyOk = false;
  for (const origin of uniqueNonEmpty(metricsOrigins)) {
    if (await requestRelayDbPinSync(origin, dbAddress, signal)) {
      anyOk = true;
    }
  }
  return anyOk;
}

export async function fetchRelayDatabaseListing(
  metricsOrigin: string,
  dbAddressRaw: string,
  signal?: AbortSignal,
): Promise<RelayDatabaseListingResult> {
  const base = metricsOrigin.replace(/\/$/, '');
  const want = normalizeOrbitDbAddress(dbAddressRaw);
  if (!base || !want) return { probe: 'unknown', row: null };
  const qs = new URLSearchParams({ address: want });
  const url = `${base}/pinning/databases?${qs.toString()}`;
  try {
    const r = await fetch(url, { method: 'GET', signal, cache: 'no-store' });
    if (r.status === 404) return { probe: 'not_listed', row: null };
    if (!r.ok) return { probe: 'unknown', row: null };
    const j = (await r.json()) as { databases?: RelayPinningDatabaseRow[] };
    const list = Array.isArray(j.databases) ? j.databases : [];
    const row =
      list.find((d) => {
        const address = d?.address;
        return typeof address === 'string' && normalizeOrbitDbAddress(address) === want;
      }) ?? null;
    if (!row) return { probe: 'not_listed', row: null };
    return { probe: 'listed', row };
  } catch {
    return { probe: 'unknown', row: null };
  }
}

async function fetchRelayDatabaseListingAny(
  metricsOrigins: string[],
  dbAddress: string,
  signal?: AbortSignal,
): Promise<RelayDatabaseListingResult> {
  const results: RelayDatabaseListingResult[] = [];
  for (const origin of uniqueNonEmpty(metricsOrigins)) {
    results.push(await fetchRelayDatabaseListing(origin, dbAddress, signal));
  }
  return summarizeListingResults(results);
}

/**
 * **`GET /pinning/databases?address=…`** (targeted listing per `orbitdb-relay-pinner` http-api).
 * **404** ⇒ address not in relay sync history (**`not_listed`**). **200** ⇒ parse **`databases`** for a match (supports relays
 * that only return the filtered entry). If **`mediaContentCreatedAtIso`** is set, **`lastSyncedAt`** must be **≥** that instant
 * or the probe returns **`listed_stale_sync`**. Other failures ⇒ **`unknown`**.
 */
export async function probeRelayMediaDbInPinningList(
  metricsOrigin: string,
  mediaDbAddress: string,
  signal?: AbortSignal,
  mediaContentCreatedAtIso?: string,
): Promise<RelayMediaDbPinningProbe> {
  const listing = await fetchRelayDatabaseListing(metricsOrigin, mediaDbAddress, signal);
  if (listing.probe !== 'listed') return listing.probe;
  if (!relaySyncCoversContent(listing.row?.lastSyncedAt, mediaContentCreatedAtIso?.trim())) {
    return 'listed_stale_sync';
  }
  return 'listed';
}

async function probeRelayMediaDbInPinningListAny(
  metricsOrigins: string[],
  mediaDbAddress: string,
  signal?: AbortSignal,
  mediaContentCreatedAtIso?: string,
): Promise<RelayMediaDbPinningProbe> {
  const results: RelayMediaDbPinningProbe[] = [];
  for (const origin of uniqueNonEmpty(metricsOrigins)) {
    results.push(await probeRelayMediaDbInPinningList(origin, mediaDbAddress, signal, mediaContentCreatedAtIso));
  }
  return summarizeProbeResults(results);
}

/**
 * True if the relay IPFS gateway appears to serve this CID (no full body download).
 */
export async function probeCidPinned(
  pinnedBaseRaw: string,
  cid: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const base = normalizeRelayPinnedBase(pinnedBaseRaw);
  const c = cid.trim().replace(/^\/+/, '');
  if (!base || !c) return false;
  const url = `${base}${c}`;
  try {
    const head = await fetch(url, { method: 'HEAD', signal, cache: 'no-store' });
    if (head.ok) return true;
    const getR = await fetch(url, {
      method: 'GET',
      signal,
      cache: 'no-store',
      headers: { Range: 'bytes=0-0' },
    });
    return getR.ok || getR.status === 206;
  } catch {
    return false;
  }
}

async function probeCidPinnedAny(pinnedBases: string[], cid: string, signal?: AbortSignal): Promise<boolean> {
  for (const base of uniqueNonEmpty(pinnedBases)) {
    if (await probeCidPinned(base, cid, signal)) return true;
  }
  return false;
}

export interface RelayPinPollOptions {
  cid: string;
  pinnedBase: string;
  pinnedBases?: string[];
  signal: AbortSignal;
  onState: (s: RelayLedState) => void;
  /** Max polling iterations (each step waits with backoff). Default 80 (~minutes upper bound). */
  maxIterations?: number;
  /**
   * Override relay HTTP origin for `GET /health` (default: `getRelayHealthOriginForFetch()`).
   * Pass empty string to skip health checks. Tests pass explicit values for stable branches.
   */
  healthOrigin?: string;
  healthOrigins?: string[];
  /**
   * OrbitDB **manifest address** of **mediaDB** (e.g. `/orbitdb/zdpu…`). When set together with a
   * non-empty **metrics** origin, **`POST /pinning/sync`** (once) + **`GET /pinning/databases?address=…`** drive yellow vs orange.
   */
  mediaDbAddress?: string;
  /**
   * Base URL for **`/pinning/databases`** (no trailing slash). Default: `getRelayMetricsOriginForFetch()`
   * when **`mediaDbAddress`** is set. Pass **`''`** to force the legacy health-only heuristic (tests).
   */
  metricsOrigin?: string;
  metricsOrigins?: string[];
  /**
   * When set, each poll tick is logged to the browser console (media category) with probe results and LED state.
   */
  pollDebugLabel?: string;
  /**
   * **`mediaDB` document `createdAt` (ISO)** for this CID. When set, **orange** requires relay **`lastSyncedAt` ≥** this time.
   */
  mediaContentCreatedAtIso?: string;
}

function resolveMetricsBasesForPoll(
  dbAddress: string | undefined,
  metricsOriginOpt: string | undefined,
  metricsOriginsOpt: string[] | undefined,
): string[] {
  const addr = dbAddress?.trim();
  if (!addr) return [];
  if (metricsOriginsOpt !== undefined) return uniqueNonEmpty(metricsOriginsOpt.map((v) => v.replace(/\/$/, '')));
  if (metricsOriginOpt !== undefined) {
    const single = metricsOriginOpt.replace(/\/$/, '').trim();
    return single ? [single] : [];
  }
  return getRelayMetricsOriginsForFetch();
}

export interface RelayDatabasePollUpdate {
  state: RelayLedState;
  lastSyncedAt: string | null;
  probe: Exclude<RelayMediaDbPinningProbe, 'listed_stale_sync'>;
}

export interface RelayDatabasePollOptions {
  dbAddress: string;
  signal: AbortSignal;
  onUpdate: (update: RelayDatabasePollUpdate) => void;
  maxIterations?: number;
  healthOrigin?: string;
  healthOrigins?: string[];
  metricsOrigin?: string;
  metricsOrigins?: string[];
  pollDebugLabel?: string;
}

/**
 * Poll relay pinning history for a DB address and keep reporting the latest `lastSyncedAt`.
 * Unlike CID polling, this keeps running so manager UIs can show ongoing replication freshness.
 */
export function startRelayDatabasePolling(options: RelayDatabasePollOptions): () => void {
  const {
    dbAddress: dbAddressOpt,
    signal,
    onUpdate,
    maxIterations = Number.POSITIVE_INFINITY,
    healthOrigin: healthOriginOpt,
    healthOrigins: healthOriginsOpt,
    metricsOrigin: metricsOriginOpt,
    metricsOrigins: metricsOriginsOpt,
    pollDebugLabel,
  } = options;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSyncedAt: string | null = null;
  let hasConfirmedReplication = false;

  const cleanup = () => {
    cancelled = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const emit = (state: RelayLedState, probe: Exclude<RelayMediaDbPinningProbe, 'listed_stale_sync'>) => {
    if (!cancelled && !signal.aborted) {
      onUpdate({ state, lastSyncedAt, probe });
    }
  };

  const healthBases =
    healthOriginsOpt !== undefined
      ? uniqueNonEmpty(healthOriginsOpt.map((v) => v.replace(/\/$/, '')))
      : healthOriginOpt !== undefined
        ? uniqueNonEmpty([healthOriginOpt.replace(/\/$/, '')])
        : getRelayHealthOriginsForFetch();

  const dbAddress = dbAddressOpt.trim();
  const metricsBases = resolveMetricsBasesForPoll(dbAddress, metricsOriginOpt, metricsOriginsOpt);

  const pollLog = (message: string, detail: Record<string, unknown>) => {
    if (!pollDebugLabel) return;
    mediaLog.info(`[relay db poll:${pollDebugLabel}] ${message}`, detail);
  };

  async function tick(iteration: number): Promise<void> {
    if (cancelled || signal.aborted) return;

    if (iteration >= maxIterations) {
      emit('error', 'unknown');
      pollLog('stopped (max iterations)', { iteration, dbAddress, maxIterations, emittedState: 'error' as const });
      return;
    }

    if (iteration === 0) emit('yellow', 'unknown');

    let pinSyncOk: boolean | null = null;
    if (metricsBases.length > 0 && iteration === 0) {
      pinSyncOk = await requestRelayDbPinSyncAny(metricsBases, dbAddress, signal);
      pollLog('POST /pinning/sync', { dbAddress, metricsOrigins: metricsBases, ok: pinSyncOk });
    }

    const listing =
      metricsBases.length > 0
        ? await fetchRelayDatabaseListingAny(metricsBases, dbAddress, signal)
        : { probe: 'unknown' as const, row: null };
    const nextLastSyncedAt =
      typeof listing.row?.lastSyncedAt === 'string' && listing.row.lastSyncedAt.trim()
        ? listing.row.lastSyncedAt.trim()
        : null;
    if (nextLastSyncedAt) lastSyncedAt = nextLastSyncedAt;
    if (listing.probe === 'listed') {
      hasConfirmedReplication = true;
    }

    const healthOk = healthBases.length > 0 ? await probeRelayHealthAny(healthBases, signal) : false;

    if (cancelled || signal.aborted) return;

    let emitted: RelayLedState;
    if (listing.probe === 'listed') {
      emitted = lastSyncedAt ? 'green' : 'orange';
    } else if (hasConfirmedReplication || lastSyncedAt) {
      emitted = healthBases.length > 0 && !healthOk ? 'orange' : 'green';
    } else if (listing.probe === 'not_listed') {
      emitted = 'yellow';
    } else if (healthBases.length > 0 && healthOk) {
      emitted = 'orange';
    } else {
      emitted = 'yellow';
    }
    emit(emitted, listing.probe);

    const delayMs = listing.probe === 'listed' ? 5000 : Math.min(1000 + iteration * 250, 5000);
    pollLog('tick', {
      iteration,
      dbAddress,
      metricsOrigins: metricsBases,
      pinSyncPostOk: pinSyncOk,
      listingProbe: listing.probe,
      lastSyncedAt,
      relayHealthOrigins: healthBases,
      healthChecked: healthBases.length > 0,
      healthOk,
      emittedState: emitted,
      nextPollInMs: delayMs,
    });
    timer = setTimeout(() => void tick(iteration + 1), delayMs);
  }

  void tick(0);

  signal.addEventListener('abort', cleanup);
  return () => {
    cleanup();
    signal.removeEventListener('abort', cleanup);
  };
}

/**
 * Polls until green, abort, or max iterations (then `error`).
 * Returns cleanup that aborts timers (does not abort the external signal).
 */
export function startRelayPinPolling(options: RelayPinPollOptions): () => void {
  const {
    cid,
    pinnedBase,
    pinnedBases: pinnedBasesOpt,
    signal,
    onState,
    maxIterations = 80,
    healthOrigin: healthOriginOpt,
    healthOrigins: healthOriginsOpt,
    mediaDbAddress: mediaDbAddressOpt,
    metricsOrigin: metricsOriginOpt,
    metricsOrigins: metricsOriginsOpt,
    pollDebugLabel,
    mediaContentCreatedAtIso: mediaContentCreatedAtOpt,
  } = options;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    cancelled = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const emit = (s: RelayLedState) => {
    if (!cancelled && !signal.aborted) onState(s);
  };

  const healthBases =
    healthOriginsOpt !== undefined
      ? uniqueNonEmpty(healthOriginsOpt.map((v) => v.replace(/\/$/, '')))
      : healthOriginOpt !== undefined
        ? uniqueNonEmpty([healthOriginOpt.replace(/\/$/, '')])
        : getRelayHealthOriginsForFetch();

  const pinnedBaseList =
    pinnedBasesOpt !== undefined
      ? uniqueNonEmpty(pinnedBasesOpt.map((v) => normalizeRelayPinnedBase(v)))
      : uniqueNonEmpty([normalizeRelayPinnedBase(pinnedBase)]);

  const mediaDbAddr = mediaDbAddressOpt?.trim();
  const metricsBases = resolveMetricsBasesForPoll(mediaDbAddr, metricsOriginOpt, metricsOriginsOpt);
  const mediaContentCreatedAtIso = mediaContentCreatedAtOpt?.trim();

  const pollLog = (message: string, detail: Record<string, unknown>) => {
    if (!pollDebugLabel) return;
    mediaLog.info(`[relay pin poll:${pollDebugLabel}] ${message}`, detail);
  };

  async function tick(iteration: number): Promise<void> {
    if (cancelled || signal.aborted) return;

    if (iteration === 0) emit('yellow');

    if (iteration >= maxIterations) {
      emit('error');
      pollLog('stopped (max iterations)', { iteration, cid, maxIterations, emittedState: 'error' as const });
      return;
    }

    const headOk = await probeCidPinnedAny(pinnedBaseList, cid, signal);
    if (cancelled || signal.aborted) return;
    if (headOk) {
      emit('green');
      pollLog(iteration === 0 ? 'CID reachable on relay gateway (after initial yellow)' : 'CID reachable on relay gateway', {
        iteration,
        cid,
        pinnedBases: pinnedBaseList,
        headOk: true,
        emittedState: 'green' as const,
        nextPollInMs: null,
      });
      return;
    }

    let dbProbe: RelayMediaDbPinningProbe = 'unknown';
    let pinSyncOk: boolean | null = null;
    if (mediaDbAddr && metricsBases.length > 0) {
      if (iteration === 0) {
        pinSyncOk = await requestRelayDbPinSyncAny(metricsBases, mediaDbAddr, signal);
        pollLog('POST /pinning/sync', { dbAddress: mediaDbAddr, metricsOrigins: metricsBases, ok: pinSyncOk });
      }
      dbProbe = await probeRelayMediaDbInPinningListAny(
        metricsBases,
        mediaDbAddr,
        signal,
        mediaContentCreatedAtIso,
      );
    }

    const healthOk = healthBases.length > 0 ? await probeRelayHealthAny(healthBases, signal) : false;

    if (cancelled || signal.aborted) return;

    let emitted: RelayLedState;
    if (dbProbe === 'listed') {
      emitted = 'orange';
    } else if (dbProbe === 'listed_stale_sync' || dbProbe === 'not_listed') {
      emitted = 'yellow';
    } else if (healthBases.length > 0 && !healthOk) {
      emitted = 'yellow';
    } else if (healthBases.length === 0 && iteration < 4) {
      emitted = 'yellow';
    } else {
      emitted = 'orange';
    }
    emit(emitted);

    const delayMs = Math.min(600 + iteration * 150, 4000);
    pollLog('tick', {
      iteration,
      cid,
      pinnedBases: pinnedBaseList,
      headOk: false,
      mediaDbAddress: mediaDbAddr || null,
      metricsOrigins: metricsBases,
      pinSyncPostOk: pinSyncOk,
      mediaContentCreatedAtIso: mediaContentCreatedAtIso || null,
      dbPinningProbe: dbProbe,
      relayHealthOrigins: healthBases,
      healthChecked: healthBases.length > 0,
      healthOk,
      emittedState: emitted,
      initialYellowThisCycle: iteration === 0,
      nextPollInMs: delayMs,
    });
    timer = setTimeout(() => void tick(iteration + 1), delayMs);
  }

  void tick(0);

  signal.addEventListener('abort', cleanup);
  return () => {
    cleanup();
    signal.removeEventListener('abort', cleanup);
  };
}
