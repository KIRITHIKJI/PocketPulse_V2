import { type Page, expect } from "@playwright/test";

import { LEDGER_PASSWORD, LEDGER_SKIP_REASON, ledgerTest } from "./ledger";

// V2 Phase 2B: credit cards, loans and balance checks on the real project, every figure read from
// the screens. Exact amounts, so this records on its own account. Accounts are reused between
// runs (names are unique), and every figure is compared before and after, never absolute.
const test = ledgerTest("accounts");
test.skip(!LEDGER_PASSWORD, LEDGER_SKIP_REASON);
test.describe.configure({ mode: "serial", timeout: 180_000 });

const CARD = "zzcard";
const RAVI = "zzravi";
const PRIYA = "zzpriya";
const main = (page: Page) => page.locator("#main");
const toast = (page: Page) => page.getByTestId("toast");
const dialog = (page: Page) => page.getByRole("dialog");

/** Net tracked money and this month's spending, as Home shows them. */
async function home(page: Page) {
  await page.goto("/home");
  const read = async (id: string) =>
    Number(await main(page).getByTestId(id).getAttribute("data-paise"));
  return { total: await read("home-balance"), spentMonth: await read("home-spent-month") };
}
/** This month's report income, as the report preview shows it. */
async function monthIncome(page: Page): Promise<string> {
  await page.goto("/reports");
  return (await main(page).getByTestId("report-income").textContent()) ?? "";
}

/** Opens an account by name from Wallets, adding it first if this account doesn't have it yet. */
async function openAccount(
  page: Page,
  name: string,
  kind?: "credit_card" | "loan_borrowed" | "loan_lent",
) {
  await page.goto("/accounts");
  // Decide only once the list has rendered: counting while the loading skeleton still shows
  // finds no link and adds a duplicate, which the database refuses (one active name per owner).
  await expect(main(page).getByRole("button", { name: "Add wallet" })).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  const link = main(page).getByRole("link", { name, exact: true });
  if (kind && (await link.count()) === 0) {
    await main(page).getByRole("button", { name: "Add wallet" }).click();
    await dialog(page).getByLabel("Name").fill(name);
    await dialog(page).getByLabel("Type").selectOption(kind);
    await dialog(page).getByRole("button", { name: "Add wallet" }).click();
    await expect(dialog(page)).toBeHidden();
  }
  await link.click();
  await expect(main(page).getByRole("heading", { name, level: 1 })).toBeVisible();
}
const accountBalance = async (page: Page) =>
  Number(await main(page).getByTestId("account-balance").getAttribute("data-paise"));

/** Runs one of the account's transfer or loan actions with an amount, and waits for the toast. */
async function act(page: Page, button: string, amount: string, expectToast: RegExp) {
  await main(page).getByRole("button", { name: button, exact: true }).click();
  await dialog(page).getByLabel("Amount").fill(amount);
  await dialog(page).getByRole("button", { name: button, exact: true }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(toast(page)).toContainText(expectToast);
}

test(
  "a card purchase and its bill payment count the spending once",
  { tag: "@smoke" },
  async ({ page }) => {
    await openAccount(page, CARD, "credit_card");
    const before = await home(page);

    // The purchase is an ordinary expense on the card.
    await page.goto("/transactions/new");
    await page.getByLabel("Amount").fill("500");
    await page.getByLabel("Paid from").selectOption({ label: CARD });
    await page.getByLabel("Description").fill("zzcard lunch");
    await expect(page.getByLabel("Category")).toHaveValue(/^[0-9a-f-]{36}\|/);
    await page.getByRole("button", { name: "Save entry" }).click();
    await expect(toast(page)).toContainText("Saved. Add another?");
    const bought = await home(page);
    expect(bought.total).toBe(before.total - 50_000);
    expect(bought.spentMonth).toBe(before.spentMonth + 50_000);

    // Recording the bill as an expense would count it twice: the form offers a transfer.
    await page.goto("/transactions/new");
    await page.getByLabel("Description").fill("paid credit card bill");
    await expect(page.getByTestId("card-payment-nudge")).toContainText(
      "This looks like paying your card bill",
    );
    await page.getByTestId("card-payment-nudge").getByRole("button").click();
    await expect(page.getByRole("radio", { name: "Transfer" })).toBeChecked();
    await expect(page.getByLabel("To wallet").locator("option:checked")).toHaveText(CARD);

    // Paying the bill from the account screen: a transfer. Neither total moves again.
    await openAccount(page, CARD);
    const owed = await accountBalance(page);
    await act(page, "Pay card bill", "500", /Paid ₹500 to zzcard/);
    await expect(main(page).getByTestId("account-balance")).toHaveAttribute(
      "data-paise",
      String(owed + 50_000),
    );
    expect(await home(page)).toEqual(bought);
  },
);

test(
  "a loan borrowed and repaid is never income or spending",
  { tag: "@smoke" },
  async ({ page }) => {
    await openAccount(page, RAVI, "loan_borrowed");
    const start = await accountBalance(page);
    const before = await home(page);
    const income = await monthIncome(page);

    await openAccount(page, RAVI);
    await act(page, "Borrow more", "1000", /Borrowed ₹1,000/);
    await expect(main(page).getByTestId("account-balance")).toHaveAttribute(
      "data-paise",
      String(start - 100_000),
    );
    await expect(main(page).getByTestId("account-balance")).toContainText(`You owe ${RAVI}`);
    expect(await home(page)).toEqual(before);
    expect(await monthIncome(page)).toBe(income);

    await openAccount(page, RAVI);
    await act(page, "Repay", "1000", /Repaid ₹1,000 to zzravi/);
    await expect(main(page).getByTestId("account-balance")).toHaveAttribute(
      "data-paise",
      String(start),
    );
    expect(await home(page)).toEqual(before);
    expect(await monthIncome(page)).toBe(income);
  },
);

test("writing off a loan happens only from the user's own confirmation", async ({ page }) => {
  await openAccount(page, PRIYA, "loan_lent");
  const lent = (await accountBalance(page)) + 30_000;
  await act(page, "Lend more", "300", /Lent ₹300 to zzpriya/);
  await expect(main(page).getByTestId("account-balance")).toHaveAttribute(
    "data-paise",
    String(lent),
  );
  const before = await home(page);

  // The dialog names the amount and what it counts as; closing it records nothing.
  await openAccount(page, PRIYA);
  await main(page).getByRole("button", { name: "Write it off" }).click();
  await dialog(page).getByLabel("Amount").fill("300");
  await expect(dialog(page).getByTestId("loan-end-summary")).toHaveText(
    "₹300 will count as spending today.",
  );
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  expect(await home(page)).toEqual(before);

  await openAccount(page, PRIYA);
  await main(page).getByRole("button", { name: "Write it off" }).click();
  await dialog(page).getByLabel("Amount").fill("300");
  await dialog(page).getByRole("button", { name: "Yes, record ₹300 as spending" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(toast(page)).toContainText("Wrote off ₹300. It counts as spending.");
  await expect(main(page).getByTestId("account-balance")).toHaveAttribute(
    "data-paise",
    String(lent - 30_000),
  );
  const after = await home(page);
  expect(after.spentMonth).toBe(before.spentMonth + 30_000);
  expect(after.total).toBe(before.total - 30_000);
});

test(
  "a balance check with a correction, its Corrections line, and Undo",
  { tag: "@smoke" },
  async ({ page }) => {
    await openAccount(page, "Cash");
    const recorded = await accountBalance(page);
    const before = await home(page);

    // A real balance ₹40 above the records.
    await openAccount(page, "Cash");
    await main(page)
      .getByLabel("Real balance")
      .fill(String((recorded + 4_000) / 100));
    await main(page).getByRole("button", { name: "Compare" }).click();
    await expect(main(page).getByTestId("check-recorded")).toBeVisible();
    await expect(main(page).getByTestId("check-difference")).toHaveAttribute("data-paise", "4000");
    await main(page).getByRole("button", { name: "Record a correction of +₹40" }).click();
    await expect(toast(page)).toContainText("Corrected Cash by ₹40. It now matches.");
    await expect(main(page).getByTestId("account-balance")).toHaveAttribute(
      "data-paise",
      String(recorded + 4_000),
    );
    await expect(main(page).getByTestId("check-history")).toContainText("off by ₹40, corrected");

    // Not income, not spending: only the total and the report's Corrections line move.
    const corrected = await home(page);
    expect(corrected.total).toBe(before.total + 4_000);
    expect(corrected.spentMonth).toBe(before.spentMonth);
    await page.goto("/reports");
    await expect(main(page).getByTestId("report-corrections")).toBeVisible();

    // Undo from the toast removes the correction and reopens the check.
    await openAccount(page, "Cash");
    await main(page)
      .getByLabel("Real balance")
      .fill(String((recorded + 4_000) / 100));
    await main(page).getByRole("button", { name: "Compare" }).click();
    await expect(main(page).getByTestId("check-difference")).toHaveAttribute("data-paise", "0");
    await main(page).getByRole("button", { name: "Save check: it matches" }).click();
    await expect(toast(page)).toContainText("Cash matches. Check saved.");
    await page.goto("/transactions?type=adjustment_in");
    await main(page).getByTestId("history-table").getByRole("link").first().click();
    await main(page)
      .getByRole("button", { name: /Delete/ })
      .first()
      .click();
    const confirm = dialog(page).getByRole("button", { name: /Delete/ });
    if (await confirm.count()) await confirm.click();
    await expect(toast(page)).toBeVisible();
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect(toast(page)).toContainText(/Undone|Restored/);
    // Delete again: the correction goes and the check is reopened.
    await page.goto("/transactions?type=adjustment_in");
    await main(page).getByTestId("history-table").getByRole("link").first().click();
    await main(page)
      .getByRole("button", { name: /Delete/ })
      .first()
      .click();
    if (await confirm.count()) await confirm.click();
    await expect(toast(page)).toBeVisible();
    await openAccount(page, "Cash");
    await expect(main(page).getByTestId("account-balance")).toHaveAttribute(
      "data-paise",
      String(recorded),
    );
    await expect(main(page).getByTestId("check-history")).toContainText("off by ₹40, not resolved");
    expect(await home(page)).toEqual(before);
  },
);

test("a balance check made offline is not queued and saves nothing", async ({ page, context }) => {
  await openAccount(page, "Cash");
  const recorded = await accountBalance(page);
  const checks = await main(page).getByTestId("check-history").locator("li").count();
  await context.setOffline(true);
  try {
    await main(page)
      .getByLabel("Real balance")
      .fill(String((recorded + 9_900) / 100));
    await main(page).getByRole("button", { name: "Compare" }).click();
    await expect(main(page).getByTestId("check-balance")).toContainText(
      "Checking a balance needs a connection",
    );
    await expect(main(page).getByTestId("check-result")).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
  // Nothing waits to sync, and nothing was saved.
  await page.goto("/settings/sync");
  await expect(main(page).getByText(/balance check/i)).toHaveCount(0);
  await openAccount(page, "Cash");
  await expect(main(page).getByTestId("account-balance")).toHaveAttribute(
    "data-paise",
    String(recorded),
  );
  await expect(main(page).getByTestId("check-history").locator("li")).toHaveCount(checks);
});
