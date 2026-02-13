import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const parsed = new URL(baseURL);
const port = parsed.port || '5173';
const managedServer = process.env.E2E_MANAGED_SERVER === '1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  ...(managedServer
    ? {}
    : {
        webServer: {
          command: `vite --host 127.0.0.1 --port ${port} --strictPort`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120000
        }
      })
});
