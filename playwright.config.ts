import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Signed-in e2e credentials (E2E_EMAIL, E2E_PASSWORD, E2E_LEDGER_PASSWORD) live in this
// gitignored file.
if (existsSync(".env.e2e.local")) process.loadEnvFile(".env.e2e.local");

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
const LEDGER_SPEC =
  /(transactions(-batch)?|insights|plan|motion|report|rewards|appearance|offline)\.spec\.ts/;
// Money specs with a test that also runs at phone size (tagged @phone), each on its own account.
const PHONE_LEDGER_SPEC = /(transactions(-batch)?|report|rewards|offline)\.spec\.ts/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One `next start` serves every browser. At 6 workers (measured 2026-11-12) long money journeys
  // queued behind other pages and ran out of their 30 s, so it stays at 4, with at most three
  // money specs at once (the ledger projects' own limits below).
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Saves round-trip to the hosted Supabase project; allow for that under parallel load.
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    // Only the offline spec runs with the service worker; a saved page must never decide a result.
    serviceWorkers: "block",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: LEDGER_SPEC,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
      testIgnore: LEDGER_SPEC,
    },
    // Money specs assert exact balance changes. Each spec file records on its own account per
    // viewport, so the files run in parallel; tests inside a file stay in order (serial mode).
    {
      name: "ledger-desktop",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: LEDGER_SPEC,
      workers: 2,
    },
    // At phone size only what looks or works differently on a phone runs again (@phone): the
    // money logic is the same code at every size, and runs above.
    {
      name: "ledger-mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
      testMatch: PHONE_LEDGER_SPEC,
      grep: /@phone/,
      workers: 1,
    },
  ],
  webServer: {
    // A fresh build every run, so a stale server can never decide a result. PW_REUSE_SERVER=1
    // reuses one already on the port (for quick reruns while working).
    command: `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
    timeout: 300_000,
    // Test-only logging of why a session or profile read fails (status/code only).
    env: { PP_E2E_DIAGNOSE: "1" },
  },
});
