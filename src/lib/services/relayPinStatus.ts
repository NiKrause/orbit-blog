/**
 * FR-7c / Story 4.3 — relay sync LED support.
 *
 * `orbitdb-relay-pinner` (v0.1.x) exposes **GET /health** on the metrics HTTP server (METRICS_PORT, default 9090)
 * but does **not** publish a JSON “which OrbitDB addresses replicated” API. We therefore:
 * - Treat **metrics health reachable** as a proxy for “relay process up” (yellow vs orange when HEAD fails).
 * - Treat **HEAD** (or tiny **Range GET**) on `VITE_RELAY_PINNED_CID_BASE + cid` as **green** when the gateway answers OK.
 *
 * Browser CORS: use **`VITE_RELAY_METRICS_BASE`** or dev-only **`/api/relay`** proxy in Vite.
 */

import { getRelayMetricsBaseForFetch, normalizeRelayPinnedBase } from '../relay/relayEnv.js';

export type RelayLedState = 'idle' | 'yellow' | 'orange' | 'green' | 'error';

/** @internal */
export async function probeRelayHealth(metricsBase: string, signal?: AbortSignal): Promise<boolean> {
  const base = metricsBase.replace(/\/$/, '');
  try {
    const r = await fetch(`${base}/health`, { method: 'GET', signal, cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
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
   * Override metrics origin for `GET /health` (default: `getRelayMetricsBaseForFetch()`).
   * Use empty string to simulate prod without metrics URL. Tests pass explicit values for stable branches.
   */
  metricsBase?: string;
}

/**
 * Polls until green, abort, or max iterations (then `error`).
 * Returns cleanup that aborts timers (does not abort the external signal).
 */
export function startRelayPinPolling(options: RelayPinPollOptions): () => void {
  const { cid, pinnedBase, signal, onState, maxIterations = 80, metricsBase: metricsBaseOpt } = options;
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

  const metricsBase =
    metricsBaseOpt !== undefined ? metricsBaseOpt.replace(/\/$/, '') : getRelayMetricsBaseForFetch();

  async function tick(iteration: number): Promise<void> {
    if (cancelled || signal.aborted) return;

    if (iteration === 0) emit('yellow');

    if (iteration >= maxIterations) {
      emit('error');
      return;
    }

    const headOk = await probeCidPinned(pinnedBase, cid, signal);
    if (cancelled || signal.aborted) return;
    if (headOk) {
      emit('green');
      return;
    }

    let healthOk = false;
    if (metricsBase) {
      healthOk = await probeRelayHealth(metricsBase, signal);
    }

    if (cancelled || signal.aborted) return;

    if (metricsBase && !healthOk) {
      emit('yellow');
    } else if (!metricsBase && iteration < 4) {
      emit('yellow');
    } else {
      emit('orange');
    }

    const delayMs = Math.min(600 + iteration * 150, 4000);
    timer = setTimeout(() => void tick(iteration + 1), delayMs);
  }

  void tick(0);

  signal.addEventListener('abort', cleanup);
  return () => {
    cleanup();
    signal.removeEventListener('abort', cleanup);
  };
}
