import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

loadDotenv({ path: resolve(process.cwd(), '.env') });

export const LOCAL_RELAY_PEER_ID = '12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE';
export const LOCAL_RELAY_TEST_PRIVATE_KEY =
  '08011240821cb6bc3d4547fcccb513e82e4d718089f8a166b23ffcd4a436754b6b0774cf07447d1693cd10ce11ef950d7517bad6e9472b41a927cd17fc3fb23f8c70cd99';
export const LOCAL_RELAY_HTTP_PORT = 19090;
export const LOCAL_RELAY_TCP_PORT = 19091;
export const LOCAL_RELAY_WS_PORT = 19092;
export const LOCAL_RELAY_WEBRTC_PORT = 19093;
export const LOCAL_RELAY_ORIGIN = `http://127.0.0.1:${LOCAL_RELAY_HTTP_PORT}`;
export const LOCAL_RELAY_SEED = `/ip4/127.0.0.1/tcp/${LOCAL_RELAY_WS_PORT}/ws/p2p/${LOCAL_RELAY_PEER_ID}`;

export type RelayTestMode = 'local' | 'remote';

function firstCsvValue(raw: string | undefined): string {
  return raw
    ?.split(',')
    .map((part) => part.trim())
    .find(Boolean) ?? '';
}

export function getRelayTestMode(): RelayTestMode {
  return process.env.PLAYWRIGHT_RELAY_MODE === 'remote' ? 'remote' : 'local';
}

export function shouldSpawnLocalRelay(): boolean {
  return getRelayTestMode() === 'local';
}

export function getRelaySeedNodes(): string {
  if (shouldSpawnLocalRelay()) return LOCAL_RELAY_SEED;

  const raw =
    process.env.PLAYWRIGHT_REMOTE_SEED_NODES?.trim() ||
    process.env.VITE_SEED_NODES_DEV?.trim() ||
    process.env.VITE_SEED_NODES?.trim() ||
    '';

  if (!raw) {
    throw new Error(
      'Remote relay mode requires PLAYWRIGHT_REMOTE_SEED_NODES or VITE_SEED_NODES(_DEV) in the environment.',
    );
  }

  return raw;
}

export function getRelaySeedPeerIds(): string[] {
  return getRelaySeedNodes()
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((addr) => {
      const match = addr.match(/\/p2p\/([^/]+)$/);
      return match?.[1]?.trim() ?? '';
    })
    .filter(Boolean);
}

export function getRelayOriginsRaw(): string {
  if (shouldSpawnLocalRelay()) return LOCAL_RELAY_ORIGIN;

  const raw =
    process.env.PLAYWRIGHT_REMOTE_RELAY_ORIGIN?.trim() ||
    process.env.VITE_RELAY_ORIGIN?.trim() ||
    '';

  if (!raw) {
    throw new Error(
      'Remote relay mode requires PLAYWRIGHT_REMOTE_RELAY_ORIGIN or VITE_RELAY_ORIGIN in the environment.',
    );
  }

  return raw;
}

export function getPrimaryRelayOrigin(): string {
  return firstCsvValue(getRelayOriginsRaw());
}

export function getRelayMetricsOriginsRaw(): string {
  if (shouldSpawnLocalRelay()) return LOCAL_RELAY_ORIGIN;

  return (
    process.env.PLAYWRIGHT_REMOTE_RELAY_METRICS_ORIGIN?.trim() ||
    process.env.VITE_RELAY_METRICS_ORIGIN?.trim() ||
    getRelayOriginsRaw()
  );
}

export function getPrimaryRelayMetricsOrigin(): string {
  return firstCsvValue(getRelayMetricsOriginsRaw());
}

export function getRelayTargetLabel(): string {
  if (shouldSpawnLocalRelay()) return 'local relay';

  return process.env.PLAYWRIGHT_REMOTE_RELAY_NAME?.trim() || getPrimaryRelayOrigin();
}

export function getRelayViteEnv(): Record<string, string> {
  const seedNodes = getRelaySeedNodes();

  return {
    VITE_MODE: 'development',
    VITE_SEED_NODES_DEV: seedNodes,
    VITE_SEED_NODES: seedNodes,
    VITE_P2P_PUPSUB_DEV: 'todo._peer-discovery._p2p._pubsub',
    VITE_P2P_PUPSUB: 'todo._peer-discovery._p2p._pubsub',
    VITE_RELAY_ORIGIN: getRelayOriginsRaw(),
    VITE_RELAY_METRICS_ORIGIN: getRelayMetricsOriginsRaw(),
  };
}
