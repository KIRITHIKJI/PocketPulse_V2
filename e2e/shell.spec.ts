import { expect, test } from "@playwright/test";

import { AUTH_FILE, E2E_EMAIL, E2E_PASSWORD, SIGNED_IN_SKIP_REASON } from "./routes";

// Signed-in shell tests, using the session saved by auth.setup.ts (a real account; there is no
// fake session). They only run when E2E_EMAIL / E2E_PASSWORD are set. Every route's own checks
// (status, heading, overflow, console errors) run in a11y.spec.ts, in the same page load as axe.
test.skip(!E2E_EMAIL || !E2E_PASSWORD, SIGNED_IN_SKIP_REASON);
test.use({ storageState: AUTH_FILE });

test.describe("sign-out", () => {
  // A fresh sign-in of its own, so signing out doesn't end the shared session other tests use.
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    "signed-in users skip the sign-in page and can sign out",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(E2E_EMAIL!);
      await page.getByLabel("Password").fill(E2E_PASSWORD!);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/home$/);
      await page.goto("/login");
      await expect(page).toHaveURL(/\/home$/);
      await page.getByTestId("account-menu").click();
      await page.getByRole("menuitem", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.goto("/home");
      await expect(page).toHaveURL(/\/login\?next=%2Fhome$/);
    },
  );
});

test("unknown transaction ids get a real 404 with the in-app not-found state", async ({ page }) => {
  // The entry is looked up in transactions/[id]/layout.tsx, outside the streaming loading
  // boundary, so the status is decided before the response starts.
  const randomId = crypto.randomUUID();
  for (const path of [
    "/transactions/does-not-exist",
    `/transactions/${randomId}`,
    `/transactions/${randomId}/edit`,
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: "We couldn’t find that" })).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Primary" })
        .or(page.getByRole("complementary", { name: "Main navigation" })),
    ).toBeVisible();
  }
});

test(
  "navigation: eight-link sidebar on desktop, bottom bar + More sheet on mobile, Add sheet, hub tabs",
  { tag: "@smoke" },
  async ({ page, isMobile }) => {
    await page.goto("/home");
    const sidebar = page.getByRole("complementary", { name: "Main navigation" });
    const tabs = page.getByRole("navigation", { name: "Primary" });

    if (isMobile) {
      await expect(sidebar).toBeHidden();
      await expect(tabs).toBeVisible();
      await tabs.getByRole("link", { name: "Plan" }).click();
      await expect(page).toHaveURL(/\/budgets$/);
      await expect(tabs.getByRole("link", { name: "Plan" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      // Two taps from the bar: More, then a hub's screen.
      await tabs.getByRole("button", { name: "More" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Categories" }).click();
      await expect(page).toHaveURL(/\/categories$/);
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(
        page.getByRole("navigation", { name: "Manage screens" }).getByRole("link", {
          name: "Categories",
        }),
      ).toHaveAttribute("aria-current", "page");

      await tabs.getByRole("button", { name: "Add expense" }).click();
      await page
        .getByRole("dialog")
        .getByRole("navigation", { name: "Ways to add" })
        .getByRole("link", { name: /Quick add/ })
        .click();
      await expect(page).toHaveURL(/\/add$/);
    } else {
      await expect(sidebar).toBeVisible();
      await expect(tabs).toBeHidden();
      await expect(
        sidebar.getByRole("navigation", { name: "Sections" }).getByRole("link"),
      ).toHaveText([
        "Home",
        "Transactions",
        "Insights",
        "Plan",
        "Player",
        "Reports",
        "Manage",
        "Settings",
      ]);

      await sidebar.getByRole("link", { name: "Plan" }).click();
      await expect(page).toHaveURL(/\/budgets$/);
      const hub = page.getByRole("navigation", { name: "Plan screens" });
      await hub.getByRole("link", { name: "Goals" }).click();
      await expect(page).toHaveURL(/\/goals$/);
      await expect(hub.getByRole("link", { name: "Goals" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      // The hub's sidebar link stays current on every tab.
      await expect(sidebar.getByRole("link", { name: "Plan" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await sidebar.getByRole("button", { name: "Add expense" }).click();
      await page
        .getByRole("dialog")
        .getByRole("navigation", { name: "Ways to add" })
        .getByRole("link", { name: /Type it/ })
        .click();
      await expect(page).toHaveURL(/\/add\/text$/);
      await expect(page.getByRole("dialog")).toBeHidden();
    }
  },
);

test.describe("sidebar on common laptop screens", () => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    test(`fits ${viewport.width}×${viewport.height} without scrolling`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "The sidebar is a laptop layout.");
      await page.setViewportSize(viewport);
      await page.goto("/home");
      const sidebar = page.getByRole("complementary", { name: "Main navigation" });
      await expect(sidebar.getByTestId("sidebar-player-chip")).toBeVisible();
      const { scroll, client } = await sidebar.evaluate((el) => ({
        scroll: el.scrollHeight,
        client: el.clientHeight,
      }));
      expect(scroll).toBeLessThanOrEqual(client);
      // Every link and the level line are inside the screen.
      for (const item of await sidebar.getByRole("link").all()) {
        const box = await item.boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      }
    });
  }
});

test.describe("with OS reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("CSS transitions are effectively disabled", async ({ page }) => {
    await page.goto("/home");
    // A quick-add tile: it has a press/hover transition on every viewport.
    const duration = await page
      .getByRole("list", { name: "Quick-add tiles" })
      .getByRole("button")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.001);
  });
});

test("Home shows the level once: in the sidebar on laptops, in the progress strip on phones", async ({
  page,
  isMobile,
}) => {
  await page.goto("/home");
  const strip = page.locator("#main").getByTestId("player-chip");
  await expect(strip).toHaveAttribute("href", "/rewards/status");
  await expect(page.getByText(/^Level \d+$/).filter({ visible: true })).toHaveCount(1);
  const where = isMobile ? strip : page.getByTestId("sidebar-player-chip");
  await expect(where.getByText(/^Level \d+$/)).toBeVisible();
});

test("offline banner reflects connectivity", async ({ page, context }) => {
  await page.goto("/home");
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "You’re offline" })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("You’re offline")).toBeHidden();
});
