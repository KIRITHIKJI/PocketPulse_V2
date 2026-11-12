# PocketPulse

**Track. Understand. Save.** A responsive, installable personal-finance web app for a college
student: record ₹10 purchases in seconds, see honest spending insights, and save on purpose.

Product requirements live in [`PROJECT_SPEC.md`](PROJECT_SPEC.md). Build status, decisions and
next steps live in [`PROGRESS.md`](PROGRESS.md).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 6 (strict) · Tailwind CSS 4 ·
shadcn-style components on Radix UI · lucide icons · Motion (Framer Motion) · next-themes ·
Vitest + Testing Library · Playwright · Supabase (Auth + Postgres + RLS) · Dexie (IndexedDB) and
a service worker for offline use.

## Requirements

- Node.js ≥ 20.9 (developed on Node 24) and npm.
- A Supabase project for accounts and cloud data (see Setup).
- Optional: a local PostgreSQL 15+ for `npm run test:db`.

## Setup

### 1. Install and configure

```bash
npm install
cp .env.example .env.local   # then fill in real values (see the table)
```

| Variable | Where it's used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | `sb_publishable_…`. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a fallback. Safe in the browser: every private row is protected by RLS. |
| `SUPABASE_SECRET_KEY` | server only | `sb_secret_…`. Bypasses RLS. Never prefix with `NEXT_PUBLIC_`. Only `src/lib/supabase/admin.ts` (marked `server-only`) reads it. |
| `NEXT_PUBLIC_SITE_URL` | auth email links | `http://localhost:3000` locally, your production URL when deployed. |

Find the keys in Supabase Dashboard → Project Settings → API Keys. `.env.local` is gitignored;
`.env.example` contains placeholders only.

### 2. Create the Supabase project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard) (a region close
   to your users, e.g. Mumbai). Copy the URL and keys into `.env.local`.
2. **Authentication → Sign In / Providers → Email:** keep Email enabled. Leaving "Confirm email"
   on is recommended (new users get a link that signs them in and opens setup). With it off,
   sign-up signs in immediately.
3. **Authentication → URL Configuration:**
   - Site URL: your production URL (or `http://localhost:3000` while developing).
   - Redirect URLs: add `http://localhost:3000/**` and `https://<your-domain>/**`. Email links
     land on `/auth/confirm`, which must be allowed here.
4. **Authentication → Emails (templates), recommended:** the default templates work, but they use
   the PKCE flow, which only completes in the browser that started it. To let someone open the
   link on another device, change the links to the token-hash form:
   - Confirm signup:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
   - Reset password:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

### 3. Apply the database migrations

Migrations live in `supabase/migrations/`: schema, integrity triggers, RLS policies, RPCs and
per-user defaults, the defaults backfill, and the onboarding/wallet/category RPCs. Apply them with the Supabase CLI (no global install needed):

```bash
npx supabase@2.120.0 init          # once: creates supabase/config.toml, keeps the migrations
npx supabase@2.120.0 login         # opens the browser to authorise the CLI
npx supabase@2.120.0 link --project-ref <project-ref>
npx supabase@2.120.0 db push       # applies every migration not yet applied
```

Or paste each file, in filename order, into Dashboard → SQL Editor. New sign-ups get their
profile, default categories (spec §9) and quick-add tiles from the `on_auth_user_created`
trigger. Users created before the migrations can call the `ensure_my_defaults()` RPC.

### Server key

`SUPABASE_SECRET_KEY` is required on the server for two things. Rewards are written with it,
because clients can't write to the reward tables, and account deletion uses it to remove the auth
user. It's read at call time, is never prefixed `NEXT_PUBLIC_`, and can't reach a browser bundle.
Without it, the app still works and `/rewards` says rewards aren't available; deleting an account
reports that nothing was changed.

### 4. Run

```bash
npm run dev                  # http://localhost:3000
```

Without the Supabase variables the app still builds and runs: public pages work, app routes
redirect to sign-in, and the auth pages say which variables are missing.

### Database tests

`npm run test:db` runs the schema, RLS, idempotency and atomicity tests against a **real
PostgreSQL** (15+). It creates a temporary database, applies `tests/db/supabase-shim.sql` (a
minimal stand-in for Supabase's `auth` schema and API roles) plus every migration, runs the
tests as the `authenticated` and `anon` roles, and drops the database. Point it at an admin
connection, **never at your hosted Supabase project**:

```bash
# Any local Postgres, e.g. a throwaway cluster (no Docker needed):
initdb -D ./.pgtest -U postgres --auth=trust -E UTF8 --locale=C
pg_ctl -D ./.pgtest -o "-p 54329" -l ./.pgtest.log start
POCKETPULSE_TEST_DB_URL=postgres://postgres@127.0.0.1:54329/postgres npm run test:db

# Or the Postgres inside a local Supabase stack (needs Docker):
npx supabase@2.120.0 start
POCKETPULSE_TEST_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
```

Without `POCKETPULSE_TEST_DB_URL` the database tests are reported as skipped, not passed.

### Live project checks

`npm run test:live` checks the configured project with the **publishable key only**: that each
of two real accounts has its defaults, and that RLS stops one from reading or changing the other's
rows. It uses the same two accounts as the browser tests: `E2E_EMAIL`, `E2E_PASSWORD`,
`E2E_USER_B_EMAIL` and `E2E_USER_B_PASSWORD` in the gitignored `.env.e2e.local`. It writes an
archived test wallet and one soft-deleted expense to the first account per run, so use test
accounts. Without them it is skipped.

### Cleaning up the test accounts

`npm run clean:e2e` lists the archived test wallets, goals and categories that test runs have left
in the e2e accounts and changes nothing. `npm run clean:e2e -- --apply` removes them. It signs in
as each account, so it can't touch anyone else's data. It never removes an entry: anything with an
entry linked to it, deleted entries included, stays.

### Signed-in browser tests

`npm run test:e2e` always runs the signed-out suite (redirects, auth forms, validation). The
signed-in suites need test accounts in the V2 project. `npm run e2e:accounts`
(`scripts/e2e-accounts.mjs`) makes them: it refuses any Supabase project but V2
(`qdoyqcvzhxfsmwrcbsjs`), reads the secret key from `.env.local`, keeps the accounts' password only
in the gitignored `.env.e2e.local` (`E2E_LEDGER_PASSWORD`, never printed), and only creates or
changes `pp-e2e-…@example.test` users. It makes:

- one account per money spec and viewport, listed in `e2e/ledger-accounts.json`;
- the shared account (`E2E_EMAIL`) and a second user (`E2E_USER_B_EMAIL`), only if the ones in
  `.env.e2e.local` don't exist in V2; it then points `.env.e2e.local` at
  `pp-e2e-shared@example.test` and `pp-e2e-user-b@example.test` and keeps the old lines as comments.

Each account starts like a real user after a skipped onboarding, with one "Cash" wallet that opens
at ₹10,000 on 1 Jan 2026. The setup project (`e2e/auth.setup.ts`) signs each account in once and
saves its session in `e2e/.auth/` (gitignored); a saved session that still works is reused, so a run
makes few sign-in requests. Tests that change the shared test profile (onboarding, wallets,
categories) run on the desktop project only and restore defaults; runs leave archived "E2E …"
wallets/categories behind. Without the credentials the signed-in tests are skipped.

The money specs (`transactions`, `transactions-batch`, `insights`, `plan`, `motion`, `report`,
`rewards`, `appearance`, `offline`) record real entries and assert exact balance changes. Each one
records on **its own account** (`e2e/ledger.ts`: `ledgerTest("plan")` signs the spec in as
`pp-e2e-plan-desktop@example.test`), so the spec files run in parallel with each other while the
tests inside a file keep their order. They run in full at desktop size (`ledger-desktop`); at phone
size (`ledger-mobile`) only the tests tagged `@phone` run again, the ones whose screens or controls
differ on a phone (Journeys A, B, F and G, the one-tap tile, typed/voice entry links, mission and
Home progress layout, signing out offline). Every entry they create is undone or deleted again (soft
delete, like a user delete); if a run is interrupted mid-test, an entry can be left behind, but only
in that spec's account. A goal with history can't be deleted, so the plan and motion specs reuse one
archived goal each between runs. `e2e/rewards.spec.ts` tests account deletion only on a throwaway
`pp-delete-…@example.test` user it creates with the admin API, so it needs `SUPABASE_SECRET_KEY`.
Voice tests use a stand-in for the browser's speech recognition, so they don't exercise a real
microphone or speech service. The cross-user checks use the second account.

`e2e/offline.spec.ts` is the only spec that runs with the real service worker; every other spec
blocks it, so a saved page can never decide a result. `e2e/a11y.spec.ts` loads every screen once
per theme and viewport (dark at the device's own size, light at 375 and 1440 px) and checks the
status, heading, overflow, console errors and axe in that one visit. Set `SHOTS_DIR` to a folder to
also get a screenshot of each.

`npm run test:smoke` runs the smoke set: the tests tagged `@smoke` (the key journey of each area,
the cross-user checks and two accessibility checks), a few minutes instead of the full run.

Every run builds the app fresh and serves it on port 3100. While working, `PW_REUSE_SERVER=1`
reuses a server you already started there (`npx next start -p 3100`); never use it for a run whose
result you report.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules, Prettier-compatible) |
| `npm run typecheck` | Generates Next route types, then `tsc --noEmit` |
| `npm test` | Vitest unit/integration tests (Node; jsdom for component tests) |
| `npm run test:db` | Schema/RLS/RPC tests on a real Postgres (needs `POCKETPULSE_TEST_DB_URL`) |
| `npm run test:live` | Defaults + cross-user RLS against the configured Supabase project (needs two test accounts) |
| `npm run clean:e2e` | Lists leftover test data in the e2e accounts; add `-- --apply` to remove it |
| `npm run e2e:accounts` | Creates or repairs the browser-test accounts on the V2 project |
| `npm run test:e2e` | Playwright on desktop Chrome + Pixel 7 viewports (builds and serves on port 3100) |
| `npm run test:smoke` | The `@smoke` subset of the browser tests |
| `npm run format` | Prettier (with Tailwind class sorting) |
| `npm run check` | lint + typecheck + test + build |

First Playwright run needs a browser: `npx playwright install chromium`.

## Using it on a phone

The app has to be on a public `https://` address: phones only install web apps, run service workers
and allow the microphone over https.

1. Deploy to any Next.js host (for example Vercel) with the four variables from the table in
   Setup. Set `NEXT_PUBLIC_SITE_URL` to the deployed address. On Vercel, `vercel.json` runs the
   server code in Mumbai (`bom1`), next to the Supabase project. If your project is in another
   region, change it to the nearest one, since every screen makes several database calls.
2. In Supabase, Authentication → URL Configuration: set Site URL to that address and add
   `https://<your-domain>/**` to Redirect URLs.
3. Open the address on the phone and sign in. Android Chrome: menu → Add to Home screen. iPhone
   Safari: Share → Add to Home Screen. Settings → Sync shows an Install button where the browser
   offers one.
4. Open the app once with a connection before relying on it offline: that's when the core screens
   are saved to the device.

## Offline

- **Works offline:** opening the app; quick add, typed entry, the full form, repeat; editing and
  deleting entries; goal money, bill and recurring confirmations from a screen that's already open.
  They wait in IndexedDB (`src/lib/offline/queue.ts`) with their ids, and go to `POST /api/sync`
  in order.
- **Needs a connection:** voice entry; changing budgets, goals, wallets, categories and settings;
  signing in and out; reports. Those forms say so and keep what was typed.
- **Syncing happens while the app is open.** Entries saved offline go up when it reconnects, or the
  next time it's opened. There's no background sync.
- **A retry can't duplicate.** Each operation keeps its ids, so the database answers `duplicate`. An
  edit or delete that meets a newer change becomes a conflict on Settings → Sync, showing both
  versions, and nothing changes until the user chooses.
- **Figures don't include what's still on the device.** Home and Transactions list those entries
  and say so, rather than adjusting a total.
- **Saved screens hold the user's figures.** They're network-first, labelled with their age when
  shown offline, and cleared on sign-out. Unsynced entries stay on the device across a sign-out and
  sync when the same account signs in again; another account can't see or send them.

## Project layout

```
src/
  app/
    (public)/     welcome, login, register, forgot/reset password, onboarding
    (app)/        signed-in shell: home, add, transactions, insights, budgets, goals, …
  components/
    ui/           accessible primitives (button, card, sheet, dropdown, segmented control…)
    layout/       sidebar, header, bottom nav, section tabs, offline banner
    states/       shared empty / error / offline / permission-denied / loading states
    offline/      sync provider and screens, install prompt, service worker registration
    preferences/  theme + motion controls
    providers/    theme and motion providers
  lib/            navigation config, env detection, preferences, utilities
    supabase/     server, browser and server-only admin clients
    auth/         route rules, form schemas, server actions, error copy
    data/         database row → domain record mappers
    ledger/       the one mutation layer: commands, executor, Supabase adapter
    offline/      IndexedDB queue, conflict choices, transport to /api/sync, saved pages
  proxy.ts        session refresh + route protection (Next 16 "proxy", formerly middleware)
  domain/         pure financial domain layer: paise money, IST periods, ledger, balances,
                  aggregation, budgets, savings, safe-to-spend, recurring schedules, survival
                  mode (used by every screen/report)
supabase/
  migrations/     schema, integrity triggers, RLS, RPCs, per-user defaults
tests/            Vitest tests (tests/unit/domain: financial invariants)
  db/             PostgreSQL tests: RLS, idempotency, atomicity, domain rules
e2e/              Playwright tests
public/           service worker (sw.js) and app icons
scripts/          app icon generator, test-account cleanup
```

## Design system

Tokens are defined once in `src/app/globals.css` as CSS variables and exposed to Tailwind via
`@theme inline`. Midnight/charcoal dark is the default; `.light` provides the light theme.
Violet (`primary`) is the accent; lime/green (`positive`) is reserved for positive progress.
Motion follows the OS `prefers-reduced-motion` setting, with an in-app override in Settings
(applied before first paint, and to both CSS and Motion animations).
