import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { type Page, expect, test as setup } from "@playwright/test";

import { LEDGER_ACCOUNTS, LEDGER_PASSWORD, LEDGER_SKIP_REASON } from "./ledger";
import { AUTH_FILE, E2E_EMAIL, E2E_PASSWORD, SIGNED_IN_SKIP_REASON } from "./routes";

// Signs each test account in once and saves its session, so the run makes one sign-in request per
// account instead of one per test (Supabase rate-limits sign-ins). A session saved by an earlier
// run is reused while it still opens a signed-in page; using it also refreshes it.
// Tagged @smoke so `npm run test:smoke` keeps its sessions.

async function signIn(page: Page, email: string, password: string, stateFile: string) {
  mkdirSync(dirname(stateFile), { recursive: true });
  if (existsSync(stateFile)) {
    const reused = await page.context().browser()!.newContext({ storageState: stateFile });
    try {
      const probe = await reused.newPage();
      await probe.goto("/settings/data");
      if (new URL(probe.url()).pathname === "/settings/data") {
        await reused.storageState({ path: stateFile });
        return;
      }
    } finally {
      await reused.close();
    }
  }
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.context().storageState({ path: stateFile });
}

setup("sign in the shared account", { tag: "@smoke" }, async ({ page }) => {
  setup.skip(!E2E_EMAIL || !E2E_PASSWORD, SIGNED_IN_SKIP_REASON);
  await signIn(page, E2E_EMAIL!, E2E_PASSWORD!, AUTH_FILE);
});

for (const account of LEDGER_ACCOUNTS) {
  setup(`sign in ${account.spec} (${account.viewport})`, { tag: "@smoke" }, async ({ page }) => {
    setup.skip(!LEDGER_PASSWORD, LEDGER_SKIP_REASON);
    await signIn(page, account.email, account.password, account.stateFile);
  });
}
