import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import { APP_ROUTES, AUTH_FILE, E2E_EMAIL, E2E_PASSWORD, PUBLIC_ROUTES } from "./routes";

// Every screen, in both themes, loaded once per theme and viewport: it must answer 200, show a
// heading, never say "coming soon", fit the screen, log no errors, and pass WCAG 2.2 AA as axe can
// measure it. (This visit replaces separate per-route checks in shell.spec.ts and auth.spec.ts
// that loaded the same pages again.) Screenshots for a person to look at are written only when
// SHOTS_DIR is set.
const SHOTS = process.env.SHOTS_DIR;
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Dark runs at the device's own size (1280 px laptop, Pixel 7), light at the narrowest phone and
// a common laptop (375 / 1440 px), so each route is checked at all four widths.
const THEMES = [
  { theme: "dark", viewport: null },
  {
    theme: "light",
    viewport: { mobile: { width: 375, height: 812 }, desktop: { width: 1440, height: 900 } },
  },
] as const;

async function check(page: Page, route: string, theme: "dark" | "light", label: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("theme", value);
    } catch {
      // Storage is unavailable on about:blank.
    }
  }, theme);

  const response = await page.goto(route);
  expect(response?.status(), route).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
  // Ready when nothing on the page is still streaming in (each Suspense fallback is a skeleton).
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/coming soon/i);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${route} scrolls sideways`).toBeLessThanOrEqual(0);
  // Phones widen the layout viewport to fit overflowing content (which makes the check above
  // read 0), so also compare it with the device width.
  expect(await page.evaluate(() => window.innerWidth)).toBe(page.viewportSize()!.width);

  if (SHOTS) {
    const name = `${label}-${theme}-${route.replaceAll("/", "_")}.png`;
    await page.screenshot({ path: `${SHOTS}/${name}`, fullPage: true });
  }
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const found = violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 4).map((n) => `${n.target.join(" ")} :: ${n.failureSummary}`),
  }));
  expect(found, `${route} in ${theme}`).toEqual([]);
  expect(errors, `${route} in ${theme}: console errors`).toEqual([]);
}

/** The smoke set keeps two of these: Home on a phone in dark, History on a laptop in light. */
const SMOKE = new Set(["/home dark", "/transactions light"]);

function routeTests(routes: readonly string[]) {
  for (const { theme, viewport } of THEMES) {
    test.describe(theme, () => {
      if (viewport) {
        test.use({
          viewport: async ({ isMobile }, provide) =>
            provide(isMobile ? viewport.mobile : viewport.desktop),
        });
      }
      for (const route of routes) {
        const tag = SMOKE.has(`${route} ${theme}`) ? ["@smoke"] : [];
        test(`${route} in ${theme}`, { tag }, async ({ page, isMobile }) => {
          await check(page, route, theme, isMobile ? "mobile" : "desktop");
        });
      }
    });
  }
}

test.describe("signed in", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Needs a test account.");
  test.use({ storageState: AUTH_FILE });
  routeTests(APP_ROUTES);
});

test.describe("signed out", () => {
  routeTests([...PUBLIC_ROUTES, "/offline"]);
});
