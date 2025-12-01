import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 60_000,
    retries: 2,
    reporter: [['html', { open: 'never' }]],
    use: {
        headless: true,
        viewport: { width: 1280, height: 720 },
        actionTimeout: 20_000,
        video: 'retain-on-failure',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
});
