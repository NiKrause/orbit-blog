/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RELAY_PINNED_CID_BASE?: string;
  /** Optional origin for `orbitdb-relay-pinner` metrics `GET /health` (dev defaults to `/api/relay` proxy). */
  readonly VITE_RELAY_METRICS_BASE?: string;
}

// Build-time constants injected by Vite
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
