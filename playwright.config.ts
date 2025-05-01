import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
    testDir: './tests',
    timeout: 120000, // Increase timeout to 60 seconds
    expect: {
        timeout: 30000 // Increase expect timeout to 10 seconds
    },
    use: {
        baseURL: 'http://localhost:5173',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: !process.env.CI,
        timeout: 120000, // Increase webserver startup timeout
    },
    // globalSetup: './tests/global-setup.ts',
    // globalTeardown: './tests/global-teardown.ts',
    reporter: [
        ['list'],
        ['html', { open: 'never' }]
    ],
    workers: 1, // Run tests serially
    retries: process.env.CI ? 2 : 0, // Retry twice on CI, no retries locally
};

export default config; 