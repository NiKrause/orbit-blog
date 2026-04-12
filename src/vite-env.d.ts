/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Relay HTTP origin without `/ipfs/`, e.g. `http://localhost:81`.
   * Multiple origins may be comma-separated; the first is used for preview URLs and all are used by relay LED probes.
   * Preview: `{origin}/ipfs/{cid}`; health: `{origin}/health`.
   */
  readonly VITE_RELAY_ORIGIN?: string;
  /**
   * @deprecated Prefer `VITE_RELAY_ORIGIN`. If set alone, origin is derived by stripping a trailing `/ipfs` path.
   * Example: `http://localhost:81/ipfs/` → origin `http://localhost:81`.
   */
  readonly VITE_RELAY_PINNED_CID_BASE?: string;
  /**
   * Optional. HTTP origin for relay pinning JSON API (`GET /pinning/databases`, `POST /pinning/sync`).
   * Multiple origins may be comma-separated. Use when metrics/pinning listen on a different port than `VITE_RELAY_ORIGIN`.
   * If unset, defaults to `VITE_RELAY_ORIGIN` / legacy pinned base origin.
   */
  readonly VITE_RELAY_METRICS_ORIGIN?: string;
}

// Build-time constants injected by Vite
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
