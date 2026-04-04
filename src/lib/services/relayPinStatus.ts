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
 * **Green** = **HEAD** or tiny **Range GET** on **`{pinnedBase}{cid}`** succeeds.
 */

import {
  getRelayHealthOriginForFetch,
  getRelayMetricsOriginForFetch,
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

/**
 * **`POST /pinning/sync`** — ask the relay to open/sync one OrbitDB address (pin media CIDs, etc.).
 * Returns whether the relay responded **`200`** with **`ok: true`**.
 */
export async function requestRelayMediaDbPinSync(
  metricsOrigin: string,
  mediaDbAddress: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const base = metricsOrigin.replace(/\/$/, '');
  const dbAddress = normalizeOrbitDbAddress(mediaDbAddress);
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
  const base = metricsOrigin.replace(/\/$/, '');
  const want = normalizeOrbitDbAddress(mediaDbAddress);
  if (!base || !want) return 'unknown';
  const qs = new URLSearchParams({ address: want });
  const url = `${base}/pinning/databases?${qs.toString()}`;
  try {
    const r = await fetch(url, { method: 'GET', signal, cache: 'no-store' });
    if (r.status === 404) return 'not_listed';
    if (!r.ok) return 'unknown';
    const j = (await r.json()) as { databases?: Array<{ address?: string; lastSyncedAt?: string }> };
    const list = Array.isArray(j.databases) ? j.databases : [];
    const row = list.find((d) => {
      const a = d?.address;
      return typeof a === 'string' && normalizeOrbitDbAddress(a) === want;
    });
    if (!row) return 'not_listed';
    if (!relaySyncCoversContent(row.lastSyncedAt, mediaContentCreatedAtIso?.trim())) {
      return 'listed_stale_sync';
    }
    return 'listed';
  } catch {
    return 'unknown';
  }
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

export interface RelayPinPollOptions {
  cid: string;
  pinnedBase: string;
  signal: AbortSignal;
  onState: (s: RelayLedState) => void;
  /** Max polling iterations (each step waits with backoff). Default 80 (~minutes upper bound). */
  maxIterations?: number;
  /**
   * Override relay HTTP origin for `GET /health` (default: `getRelayHealthOriginForFetch()`).
   * Pass empty string to skip health checks. Tests pass explicit values for stable branches.
   */
  healthOrigin?: string;
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
  /**
   * When set, each poll tick is logged to the browser console (media category) with probe results and LED state.
   */
  pollDebugLabel?: string;
  /**
   * **`mediaDB` document `createdAt` (ISO)** for this CID. When set, **orange** requires relay **`lastSyncedAt` ≥** this time.
   */
  mediaContentCreatedAtIso?: string;
}

function resolveMetricsBaseForPoll(
  mediaDbAddress: string | undefined,
  metricsOriginOpt: string | undefined,
): string {
  const addr = mediaDbAddress?.trim();
  if (!addr) return '';
  if (metricsOriginOpt !== undefined) return metricsOriginOpt.replace(/\/$/, '');
  return getRelayMetricsOriginForFetch();
}

/**
 * Polls until green, abort, or max iterations (then `error`).
 * Returns cleanup that aborts timers (does not abort the external signal).
 */
export function startRelayPinPolling(options: RelayPinPollOptions): () => void {
  const {
    cid,
    pinnedBase,
    signal,
    onState,
    maxIterations = 80,
    healthOrigin: healthOriginOpt,
    mediaDbAddress: mediaDbAddressOpt,
    metricsOrigin: metricsOriginOpt,
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

  const healthBase =
    healthOriginOpt !== undefined
      ? healthOriginOpt.replace(/\/$/, '')
      : getRelayHealthOriginForFetch();

  const mediaDbAddr = mediaDbAddressOpt?.trim();
  const metricsBase = resolveMetricsBaseForPoll(mediaDbAddr, metricsOriginOpt);
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

    const headOk = await probeCidPinned(pinnedBase, cid, signal);
    if (cancelled || signal.aborted) return;
    if (headOk) {
      emit('green');
      pollLog(iteration === 0 ? 'CID reachable on relay gateway (after initial yellow)' : 'CID reachable on relay gateway', {
        iteration,
        cid,
        pinnedBase: normalizeRelayPinnedBase(pinnedBase),
        headOk: true,
        emittedState: 'green' as const,
        nextPollInMs: null,
      });
      return;
    }

    let dbProbe: RelayMediaDbPinningProbe = 'unknown';
    let pinSyncOk: boolean | null = null;
    if (mediaDbAddr && metricsBase) {
      if (iteration === 0) {
        pinSyncOk = await requestRelayMediaDbPinSync(metricsBase, mediaDbAddr, signal);
        pollLog('POST /pinning/sync', { dbAddress: mediaDbAddr, ok: pinSyncOk });
      }
      dbProbe = await probeRelayMediaDbInPinningList(
        metricsBase,
        mediaDbAddr,
        signal,
        mediaContentCreatedAtIso,
      );
    }

    let healthOk = false;
    if (healthBase) {
      healthOk = await probeRelayHealth(healthBase, signal);
    }

    if (cancelled || signal.aborted) return;

    let emitted: RelayLedState;
    if (dbProbe === 'listed') {
      emitted = 'orange';
    } else if (dbProbe === 'listed_stale_sync' || dbProbe === 'not_listed') {
      emitted = 'yellow';
    } else if (healthBase && !healthOk) {
      emitted = 'yellow';
    } else if (!healthBase && iteration < 4) {
      emitted = 'yellow';
    } else {
      emitted = 'orange';
    }
    emit(emitted);

    const delayMs = Math.min(600 + iteration * 150, 4000);
    pollLog('tick', {
      iteration,
      cid,
      pinnedBase: normalizeRelayPinnedBase(pinnedBase),
      headOk: false,
      mediaDbAddress: mediaDbAddr || null,
      metricsOrigin: metricsBase || null,
      pinSyncPostOk: pinSyncOk,
      mediaContentCreatedAtIso: mediaContentCreatedAtIso || null,
      dbPinningProbe: dbProbe,
      relayHealthOrigin: healthBase || null,
      healthChecked: Boolean(healthBase),
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
