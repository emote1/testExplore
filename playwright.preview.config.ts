import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';

// Capture preset shell env keys to preserve them over .env/.env.e2e
const PRESET_KEYS = new Set(Object.keys(process.env));

// Load base .env first (does not override shell)
dotenv.config();

// Then optionally merge with .env.e2e: override .env values but never override preset shell env
if (fs.existsSync('.env.e2e')) {
  const result = dotenv.config({ path: '.env.e2e', override: false });
  const parsed = result.parsed ?? undefined;
  if (parsed) {
    for (const [k, v] of Object.entries(parsed)) {
      if (!PRESET_KEYS.has(k)) {
        process.env[k] = v;
      }
    }
  }
}

const PREVIEW_PORT = (() => {
  const n = Number(process.env.PREVIEW_PORT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 4173;
})();
const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npx vite preview --port ${PREVIEW_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
