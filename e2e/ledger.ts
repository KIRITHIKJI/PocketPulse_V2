import { test as base } from "@playwright/test";

import LEDGER from "./ledger-accounts.json";

/**
 * Money specs assert exact balance changes, so each one records on its own test account (one per
 * viewport it runs at) instead of sharing one. That lets them run in parallel. The accounts are
 * made by `npm run e2e:accounts` (scripts/e2e-accounts.mjs) and signed in by auth.setup.ts.
 */
export type LedgerSpec = keyof typeof LEDGER;
export type Viewport = "desktop" | "mobile";

export interface LedgerAccount {
  spec: LedgerSpec;
  viewport: Viewport;
  email: string;
  password: string;
  /** Saved signed-in session (gitignored), written by auth.setup.ts. */
  stateFile: string;
}

export const LEDGER_PASSWORD = process.env.E2E_LEDGER_PASSWORD;
export const LEDGER_SKIP_REASON =
  "Set E2E_LEDGER_PASSWORD in .env.e2e.local (npm run e2e:accounts creates the money-test accounts).";

export function ledgerAccount(spec: LedgerSpec, viewport: Viewport): LedgerAccount {
  if (!(LEDGER[spec] as readonly string[]).includes(viewport)) {
    throw new Error(`${spec} has no ${viewport} account; add it to e2e/ledger-accounts.json.`);
  }
  return {
    spec,
    viewport,
    email: `pp-e2e-${spec}-${viewport}@example.test`,
    password: LEDGER_PASSWORD ?? "",
    stateFile: `e2e/.auth/${spec}-${viewport}.json`,
  };
}

export const LEDGER_ACCOUNTS: readonly LedgerAccount[] = (
  Object.entries(LEDGER) as [LedgerSpec, Viewport[]][]
).flatMap(([spec, viewports]) => viewports.map((viewport) => ledgerAccount(spec, viewport)));

/**
 * The test function for a money spec: signed in as that spec's own account for the viewport the
 * project runs at. `account` is worker-scoped, so `beforeAll`/`afterAll` can use it too.
 */
export function ledgerTest(spec: LedgerSpec) {
  return base.extend<object, { account: LedgerAccount }>({
    account: [
      async ({ browserName: _ }, provide, workerInfo) => {
        const viewport = workerInfo.project.name === "ledger-mobile" ? "mobile" : "desktop";
        await provide(ledgerAccount(spec, viewport));
      },
      { scope: "worker" },
    ],
    storageState: async ({ account }, provide) => {
      await provide(account.stateFile);
    },
  });
}
