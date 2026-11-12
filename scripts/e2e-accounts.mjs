/**
 * Creates (or repairs) the browser-test accounts on the V2 project:
 *   npm run e2e:accounts
 *
 * - One money-test account per spec and viewport listed in e2e/ledger-accounts.json, so the money
 *   specs can run in parallel without sharing a balance.
 * - The shared account (E2E_EMAIL) and the second user (E2E_USER_B_EMAIL), but only when the ones
 *   configured in .env.e2e.local don't exist in V2. Then pp-e2e-shared@example.test and
 *   pp-e2e-user-b@example.test are made, .env.e2e.local is pointed at them, and the old lines stay
 *   in the file as comments.
 *
 * Safety:
 * - Runs only against the V2 project (qdoyqcvzhxfsmwrcbsjs); any other Supabase URL is refused
 *   before anything is sent.
 * - Reads the secret key from .env.local, on this machine, and never prints it.
 * - Every account it makes shares one password, E2E_LEDGER_PASSWORD, which lives only in the
 *   gitignored .env.e2e.local. If it isn't there, one is generated and written there. It is never
 *   printed.
 * - Only creates or changes users named pp-e2e-…@example.test (a reserved domain: no real inbox).
 *
 * Each account gets what a real user has after the sign-up trigger and a skipped onboarding: the
 * seeded categories and tiles, and one default "Cash" wallet. The wallet opens at ₹10,000 on
 * 1 Jan 2026, so a test can record entries dated in the past and see them in the balance.
 */
/* eslint-disable no-console -- its output is the point: this script reports what it does. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const V2_REF = "qdoyqcvzhxfsmwrcbsjs";
const ENV_E2E = ".env.e2e.local";
const OPENING = { paise: 1_000_000, date: "2026-01-01" };
const OURS = /^pp-e2e-[a-z-]+@example\.test$/;
const SHARED = {
  E2E_EMAIL: "pp-e2e-shared@example.test",
  E2E_USER_B_EMAIL: "pp-e2e-user-b@example.test",
};
const PASSWORD_OF = { E2E_EMAIL: "E2E_PASSWORD", E2E_USER_B_EMAIL: "E2E_USER_B_PASSWORD" };

process.loadEnvFile(".env.local");
if (existsSync(ENV_E2E)) process.loadEnvFile(ENV_E2E);

function fail(message) {
  console.error(`e2e-accounts: ${message}`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let host = "";
try {
  host = new URL(url).host;
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL in .env.local isn't a URL.");
}
if (host !== `${V2_REF}.supabase.co`) {
  fail(`refusing to run: .env.local points at ${host || "nothing"}, not the V2 project ${V2_REF}.`);
}
const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) fail("SUPABASE_SECRET_KEY is missing from .env.local.");

/** Rewrites .env.e2e.local: sets each key, keeping a replaced line as a comment. */
function setEnv(values) {
  try {
    execFileSync("git", ["check-ignore", "-q", ENV_E2E]);
  } catch {
    fail(`${ENV_E2E} isn't ignored by git; refusing to write credentials into it.`);
  }
  const lines = existsSync(ENV_E2E) ? readFileSync(ENV_E2E, "utf8").split(/\r?\n/) : [];
  const out = lines.map((line) => {
    const key = /^\s*([A-Z0-9_]+)\s*=/.exec(line)?.[1];
    return key && key in values
      ? `# Not in V2, replaced by npm run e2e:accounts: ${line.trim()}`
      : line;
  });
  while (out.length && out.at(-1) === "") out.pop();
  for (const [key, value] of Object.entries(values)) out.push(`${key}=${value}`);
  writeFileSync(ENV_E2E, `${out.join("\n")}\n`);
  Object.assign(process.env, values);
}

if (!process.env.E2E_LEDGER_PASSWORD) {
  setEnv({ E2E_LEDGER_PASSWORD: `Pp-${randomBytes(18).toString("base64url")}-9` });
  console.log(`Wrote a new E2E_LEDGER_PASSWORD to ${ENV_E2E} (not shown).`);
}
const password = process.env.E2E_LEDGER_PASSWORD;

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function check(query, what) {
  const { data, error } = await query;
  if (error) fail(`${what} failed: ${error.code ?? error.message}`);
  return data;
}

async function existingUsers() {
  const byEmail = new Map();
  for (let page = 1; ; page += 1) {
    const data = await check(admin.auth.admin.listUsers({ page, perPage: 1000 }), "listing users");
    for (const user of data.users) if (user.email) byEmail.set(user.email.toLowerCase(), user.id);
    if (data.users.length < 1000) return byEmail;
  }
}
const users = await existingUsers();

// The shared account and user B: keep whatever is configured if it exists in V2.
const replace = {};
for (const [key, email] of Object.entries(SHARED)) {
  const configured = (process.env[key] ?? "").toLowerCase();
  if (configured && users.has(configured)) continue;
  replace[key] = email;
  replace[PASSWORD_OF[key]] = password;
}
if (Object.keys(replace).length) {
  setEnv(replace);
  console.log(`Pointed ${Object.keys(replace).join(", ")} in ${ENV_E2E} at new V2 test accounts.`);
}

const ledger = JSON.parse(readFileSync("e2e/ledger-accounts.json", "utf8"));
const emails = [
  ...Object.entries(ledger).flatMap(([spec, viewports]) =>
    viewports.map((viewport) => `pp-e2e-${spec}-${viewport}@example.test`),
  ),
  ...Object.entries(SHARED)
    .filter(([key]) => key in replace)
    .map(([, email]) => email),
];

for (const email of emails) {
  if (!OURS.test(email)) fail(`${email} isn't a test-account address.`);
  let id = users.get(email);
  let made = "kept";
  if (id) {
    // Keeps the password in step with .env.e2e.local (it may have been regenerated).
    await check(admin.auth.admin.updateUserById(id, { password }), `updating ${email}`);
  } else {
    const data = await check(
      admin.auth.admin.createUser({ email, password, email_confirm: true }),
      `creating ${email}`,
    );
    id = data.user.id;
    made = "created";
  }

  const wallets = await check(
    admin.from("accounts").select("id").eq("owner_id", id),
    `reading ${email}'s wallets`,
  );
  if (wallets.length === 0) {
    await check(
      admin.from("accounts").insert({
        owner_id: id,
        name: "Cash",
        kind: "cash",
        opening_balance_paise: OPENING.paise,
        opening_balance_date: OPENING.date,
        is_default: true,
      }),
      `adding ${email}'s wallet`,
    );
    made += ", wallet added";
  }
  await check(
    admin
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", id)
      .is("onboarding_completed_at", null),
    `finishing ${email}'s onboarding`,
  );
  console.log(`${email}: ${made}`);
}
console.log(`${emails.length} accounts ready on ${V2_REF}.`);
