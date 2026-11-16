import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

export default defineConfig({
  testDir: defineBddConfig({
    features: 'tests/browser/*.feature',
    steps: 'tests/browser/*.steps.mjs',
  }),
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:8017' },
  webServer: {
    command: 'node tests/browser/server.mjs',
    url: 'http://127.0.0.1:8017',
  },
});
