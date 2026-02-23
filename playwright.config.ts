import { defineConfig, devices } from '@playwright/test'

const RELAY_PEER_ID = '12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE'
// Use non-default ports to avoid collisions with a locally running relay.
const RELAY_TCP_PORT = 19091
const RELAY_WS_PORT = 19092
const RELAY_WEBRTC_PORT = 19093
const RELAY_SEED = `/ip4/127.0.0.1/tcp/${RELAY_WS_PORT}/ws/p2p/${RELAY_PEER_ID}`

export default defineConfig({
  testDir: './tests',

  // These e2e specs share on-disk state (./orbitdb) and share state across tests
  // inside a describe block, so run with a single worker for stability.
  workers: 1,
  fullyParallel: false,

  // The app+P2P stack can take a while to bootstrap.
  timeout: 120_000,
  expect: { timeout: 30_000 },

  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',

  use: {
    baseURL: 'http://localhost:5183',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
    trace: 'on-first-retry',
  },

  // Start the app server for the tests. The specs currently hardcode
  // http://localhost:5183, so keep that stable.
  webServer: {
    // Use a dedicated Vite mode so env is deterministic for e2e (see `.env.test`).
    command: 'npm run dev -- --mode test --host 127.0.0.1 --port 5183 --strictPort',
    url: 'http://localhost:5183',
    // Always spawn this project's server to avoid accidentally attaching
    // to another app already running on the same port.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,

      // Ensure the app only bootstraps against the locally spawned relay for stable tests.
      VITE_MODE: 'development',
      VITE_SEED_NODES_DEV: RELAY_SEED,
      VITE_SEED_NODES: RELAY_SEED,
      VITE_P2P_PUPSUB_DEV: 'todo._peer-discovery._p2p._pubsub',
      VITE_P2P_PUPSUB: 'todo._peer-discovery._p2p._pubsub',

      // Keep relay ports in sync with tests/global-setup.ts spawning.
      RELAY_TCP_PORT: String(RELAY_TCP_PORT),
      RELAY_WS_PORT: String(RELAY_WS_PORT),
      RELAY_WEBRTC_PORT: String(RELAY_WEBRTC_PORT),
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
