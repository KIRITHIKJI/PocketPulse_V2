# PocketPulse V2 — Specification

Written in Phase 1 (2026-11-12) from the code at commit `6e15776`, `doc/V2_BRIEF.md`,
`doc/REDESIGN_V2.md` Part A, `PROJECT_SPEC.md`, `CLAUDE.md` and `PROGRESS.md`. Where the code and a
document disagreed, the code was taken as the truth and the difference is listed in section 14.

---

## 1. One-page summary

**What V2 is.** One update to the existing app. It adds loans, credit cards and balance checks
(reconciliation); removes four forecasts; redesigns every screen around eight sidebar destinations;
then adds an Intelligence Feed, weekly and monthly reviews, data labels and learned habits; and,
last and optional, an AI Analyst. Every screen must end up showing less at once than it does today.

**What the code already gives us.** V1 is in good shape and most of V2 builds on what exists:

- The ledger already has the right shape. Six transaction types, positive integer paise, soft
  delete, client ids as idempotency keys, a database trigger that enforces the money rules, and one
  balance function (`wallet_balances`) that the domain layer mirrors and tests against.
- **Credit cards need almost nothing new.** Accounts already have a `card` kind and may have a
  negative opening balance. A card purchase is already an ordinary expense on that account, and a
  bill payment is already an ordinary transfer, which never counts as spending.
- **Loans need no new transaction type.** A loan becomes an account (who you borrowed from or lent
  to). Borrowing, lending and repaying are transfers between that account and a wallet, so they are
  never income or expense, by the rules that already exist.
- **Reconciliation needs one new pair of transaction types** (`adjustment_in` / `adjustment_out`,
  shown as "Balance correction") and one small history table. This is the only change to the core
  money formulas, and the spec already allows for it ("adjusted for any explicitly supported
  corrections", invariant 2).
- **The Intelligence Feed and reviews need no new arithmetic.** Insight cards, unusual changes,
  recurring signals, money leaks, period comparison and the report model already exist, each with a
  link to the entries behind it. V2 ranks, de-duplicates and presents them.
- **Forecast removal is small and contained:** three domain outputs (`expectedEndBalancePaise`,
  `runOutInDays`, `goalForecast`), four screens, four unit-test files.

**Navigation decision.** Use the brief's structure (section 9 of V2_BRIEF): eight sidebar links,
four hubs, one Add button. It is newer than REDESIGN_V2 and covers the new screens. REDESIGN_V2's
details (slim level line, hub tabs, all URLs kept) still apply. See section 6.

**Baseline (this machine, 2026-11-12):** lint 110 s, typecheck 65 s, unit tests 78 s (36 files,
918 tests), production build 53 s. All four pass. First-load JS: 787–848 KB raw (246–267 KB
gzip) on signed-in screens, almost all of it the shared shell (section 9).

**Tests.** The recorded full browser runs took 10–15 minutes when green and 39 minutes in the worst
run, not an hour; the hour was an earlier estimate that included reruns (D3). The slow part is
structural: about 120 money tests run one at a time on one shared account, first at desktop size and
then again at phone size. Giving each money spec its own test account lets them run in parallel;
with a few smaller fixes the full run should take about 6–9 minutes. A 20-test smoke set is defined
in section 10.

**Phases.** 2 (two prompts): faster tests (2A, test infrastructure only), then forecast removal,
loans, cards and reconciliation (2B). 3 (six prompts): redesign. 4 (two prompts): feed, reviews, labels, learned habits.
5 (one prompt): AI Analyst, only if a free provider passes the privacy test. 6 (one prompt): final
check and the V1 to V2 data move.

**Decisions (approved 2026-11-12, section 15):** "Tracked balance" is the net position; Safe to Spend
starts from that net position but ignores money you lent out until it comes back; V1 `card` wallets
stay debit cards; balance corrections get their own "Corrections" line in reports; the V2 Supabase
project is in ap-south-1 (Mumbai). Only the AI provider question is still open (Phase 5).

---

## 2. Final scope

### In V2

| # | Feature | Phase |
| --- | --- | --- |
| 1 | Loans (borrowed and lent), tracked as accounts; movements are transfers | 2 |
| 2 | Credit cards: a card account that may go negative; bill payment is a transfer | 2 |
| 3 | Balance reconciliation: enter the real balance, find the gap or record one labelled correction | 2 |
| 4 | Removal of four forecasts (section 3.2) | 2B |
| 5 | Faster browser tests and a smoke set | 2A |
| 6 | Redesign: tokens, hub navigation, every screen, SVG emblems and badges | 3 |
| 7 | Intelligence Feed | 4 |
| 8 | Weekly and monthly reviews | 4 |
| 9 | Data labels: Recorded, Estimated, Unknown | 4 |
| 10 | Learned habits: suggested, approved by the user, viewable, editable, deletable | 4 |
| 11 | AI Analyst, opt-in, free tier only, read-only | 5 (optional) |
| 12 | Final check, V1 to V2 data move | 6 |

Everything in V2_BRIEF section 6 is kept, with simpler screens.

### Not in V2

Native apps, SMS or payment-notification capture, automatic saving, investments, crypto, bank sync,
leaderboards, multiple AI agents, forecasting, autonomous actions, anything not in the brief. No
placeholders for any of them.

---

## 3. Adding and removing: item by item

### 3.1 Adding (V2_BRIEF section 4)

#### 1. Loans

- **Exists:** accounts with signed opening balances; `transfer` (two different own accounts, no
  category, never income or spending); `wallet_balances`; the `create_transaction` RPC; transfers in
  the full form; history, reports and exports that already list transfers as "moved between own
  wallets".
- **Reuse:** all of the above. A loan is an account. "I borrowed ₹1,000 from Ravi into Cash" is a
  transfer from the account *Ravi (borrowed)* to *Cash*. "I repaid ₹400" is a transfer from *Cash*
  to *Ravi (borrowed)*. Lending is the mirror image with a *lent* account.
- **Must change:**
  - Two new account kinds, `loan_borrowed` and `loan_lent`, plus an optional `counterparty` name.
  - A loan screen (under Manage › Accounts) with four actions — Borrow more, Repay, Lend more, Got
    money back — each of which builds an ordinary transfer command.
  - Loan accounts are left out of the quick-add and expense wallet pickers (they aren't where money
    is spent from), and are shown in the transfer pickers.
  - Labels: a borrowed account at −₹600 reads "You owe Ravi ₹600"; a lent account at +₹500 reads
    "Priya owes you ₹500". The sign is never shown raw.
  - Interest is a separate, ordinary expense (or income, if received). The loan screen offers it as
    a second step, never folded into the repayment.
  - Two rare cases need a clear, labelled choice: a loan you lent that will never come back
    ("Write it off" = an expense from the loan account, category Other › Written off) and a loan
    that is forgiven ("They let me keep it" = income on the loan account, category Gift). Both are
    real changes to your money, so they are the only loan actions that count as spending or income.
    **Decided:** each happens only when you confirm it yourself in a dialog that names the amount
    and says it will count as spending (write-off) or income (forgiven). The app never proposes it
    on its own schedule.
- **Database:** widen the `accounts.kind` check; add `accounts.counterparty text null`. No new
  transaction type, no change to `wallet_balances`, the trigger or any RPC.
- **Risks:** see "Balance basis" below; the main risk is what "Tracked balance" means once accounts
  can hold debt. A second risk is Safe to Spend double-counting a loan repayment if it is also entered
  as a bill (section 4, invariant 5).

#### 2. Credit cards

- **Exists:** account kind `card` (labelled "Card"), negative opening balances ("Use a minus sign
  if it's overdrawn"), expenses on any account, transfers, refunds to the account they were paid
  from.
- **Reuse:** all of it. A card purchase = an `expense` on the card account. Paying the bill = a
  `transfer` from the bank account to the card account. A refund to the card = a `refund` on the card
  account. None of this needs new math.
- **Must change:**
  - New kind `credit_card`; the existing `card` kind is relabelled "Debit card" (it behaves like a
    bank account). **Decided:** V1 `card` rows stay `card` (debit). Nothing converts them; you can
    change a wallet's type yourself later.
  - Optional `credit_limit_paise`; the card screen shows "Owed on card" (the balance, sign removed)
    and "Available credit" (limit − owed). Both are plain arithmetic on your inputs and your records.
  - A "Pay card bill" action that opens a transfer with the card as the destination, prefilled with
    the amount owed (editable).
  - An optional statement day and due day per card for a reminder. **The bill is never added as a
    commitment in Safe to Spend:** the card purchases already lowered your balance, so subtracting
    the bill again would count the spending twice.
- **Database:** widen `accounts.kind`; add `credit_limit_paise bigint null` (positive, only for
  `credit_card`), `statement_day smallint null`, `due_day smallint null` (1–28). A reminder kind
  `card_due` added to `notifications.kind`.
- **Risks:** users may still "pay the card" by recording an expense. The form should notice an
  expense whose description looks like a card payment and the user has a card account, and offer the
  transfer instead ("This looks like paying your card bill. Record it as a transfer so your
  spending isn't counted twice?"). Deterministic word match, user decides.

#### 3. Balance reconciliation

- **Exists:** `wallet_balances(p_closing)` gives any account's balance at any instant; history can
  already filter by wallet and date; soft delete and Undo; the mutation layer with idempotent
  commands; the "entries before opening date" explanation.
- **Reuse:** the balance function for the computed side; history filters for "find the missing
  entry"; the mutation layer and Undo for the correction; `validateLedger` for hints.
- **Must change:**
  - A "Check balance" action on every account: you type what your bank, UPI app or wallet actually
    shows (and when, default now). The screen shows recorded, real, and the difference.
  - **If the difference is zero:** save a "matched" check. The account then shows "Checked 12 Nov".
  - **If it isn't:** two choices, side by side.
    - *Find it:* history for that account since the last check, plus deterministic hints: an entry of
      exactly the difference recorded on another account; two identical entries on the same day; an
      entry dated before the account's opening date; a transfer in only one direction. After fixing,
      check again.
    - *Record a correction:* one entry of type `adjustment_in` or `adjustment_out` for exactly the
      difference, dated at the check's time, labelled "Balance correction" everywhere. It is not
      income, not spending, not in Insights, budgets, leaks or rewards. It has Undo and can be
      deleted later like any entry, which puts the check back to "difference not resolved".
  - Every check is kept as history on the account ("12 Nov: off by ₹40, corrected").
  - **Reports and exports show a "Corrections" line** (net of corrections in and out, with the two
    parts in the CSV). Corrections are never income and never spending, so the report reads:
    opening + income + refunds − spending ± corrections = closing. `reportDifferences` checks this
    identity, and the Phase 2B reconciliation tests assert it for a period with a correction in each
    direction, one dated inside the period and one before it.
- **Database:**
  - Transaction types gain `adjustment_in` and `adjustment_out` (shape: an account, no category,
    no goal, no refund link, no from/to). The type gives the direction, so invariant 1 still holds.
  - `source` gains `reconciliation`.
  - New table `reconciliations`: client id, owner, account, `as_of`, stated balance, recorded balance
    at that instant, difference, optional `correction_id` (same-owner FK to the transaction),
    status (`matched`, `corrected`, `open`), note, timestamps. Owner-only RLS.
  - `wallet_balances` gains the two new types in its `moves` step (`create or replace`).
  - New RPC `record_reconciliation(p_check jsonb, p_correction jsonb)`, SECURITY INVOKER, writes the
    check and the correction in one transaction, idempotent by both client ids. **It works out the
    recorded balance and the difference itself, at `as_of`, from `wallet_balances`, and never
    trusts those figures from the client.** If the client's correction (amount or direction), or
    the difference the screen showed, isn't the server's difference, it writes nothing and returns
    `{status: "stale"}` with the current figures, so the screen can show them (change 2, Phase 2B
    prompt).
  - **A balance check needs a connection** (change 1, Phase 2B prompt). Saving a check or a
    correction is never queued offline, because the correction depends on the recorded balance,
    which can be stale on a device that's been offline. Offline, Check balance says so and saves
    nothing. Undoing or deleting an existing correction stays an ordinary (queueable) command.
  - **Cards and loans take positive amounts** (change 3). On a credit card or loan the user types
    what they owe, or are owed, as a positive amount (opening balance and the real balance in a
    check alike); the app converts the sign (`balanceFromEntered`, unit-tested for every kind).
- **Risks:**
  - It touches the core formula, so `ledgerBalances`, `wallet_balances`, `summarizePeriod`, the
    report model, CSV and data export must all change together, with the DB equivalence test
    extended to the new types before anything else.
  - A correction is an easy way to hide a mistake. The screen leads with *Find it*, and the history
    keeps every correction visible.
  - A check dated in the past puts a correction into a past period; that period's closing balance
    changes. That is correct (it reconstructs history), but the screen says so before saving.

#### 4. Intelligence Feed

- **Exists:** `buildInsights` and `buildCards` (repeat, change, small, biggest, unassigned),
  `unusualChanges`, `recurringSignals`, `leakReport` and `whatIf`, `comparePeriods` with
  `mainDriver`, budget alerts, and a `SpendingScope` on every figure that `historyHref` turns into a
  link to the exact entries.
- **Reuse:** every one of those as the item source. No new money math.
- **Must change:** a thin domain module `feed.ts` that:
  - gives each item a stable key (kind + subject + period), so the same finding is never shown twice;
  - drops weak items using the thresholds the domain already uses (sparse rules, `MIN_REPEATS`, the
    small-purchase threshold as the minimum impact);
  - merges items about the same subject and keeps the strongest;
  - ranks by money impact, then recency; shows at most a few new items per week;
  - remembers what you dismissed.
  Screen: Insights › Feed, one column, each item one sentence plus a link "See the N entries".
- **Database:** table `feed_dismissals (owner_id, item_key, dismissed_at)`, unique per owner and key,
  owner-only RLS.
- **Risks:** repetition across periods ("you bought tea 20 times" every week). The key includes the
  period, and an item only reappears in a new period if it changed meaningfully. This rule needs
  tests with several weeks of data.

#### 5. Weekly and monthly reviews

- **Exists:** `buildReport` (income, spending, refunds, categories, opening and closing balances,
  comparison with the previous period, all reconciled), `buildInsights`, the `weekly_review` mission
  and the Weekly Review Complete achievement, the weekly-review reminder.
- **Reuse:** the report model for the figures; feed items for "patterns"; the existing reward for
  marking a week reviewed.
- **Must change:** a Reviews screen (Insights › Reviews) with Week / Month, previous/next, and a
  "Done reviewing" button that records the review (weekly: the existing award; monthly: a zero-XP
  `monthly_review:<month>` fact, like `daily_review`). The reminder links here.
- **Database:** none.
- **Risks:** low. It must not become a second report screen; it shows five things only (in, out,
  biggest changes, two or three patterns, versus last period) and links to Reports for export.

#### 6. Data labels

- **Exists:** `--money-estimate` colour token; "estimate" copy on Safe to Spend; untracked accounts
  (`tracked: false`) and windows before tracking (`firstSpendingDate`) in the domain; sparse-data
  messages.
- **Reuse:** those signals.
- **Must change:** one domain type `DataLabel = recorded | estimated | unknown` with a reason, returned
  next to figures by the functions that make them, and one small component that shows it.
  - **Recorded:** sums of real entries (balances, spending, income).
  - **Estimated:** anything that includes something not yet recorded — Safe to Spend (it subtracts
    scheduled recurring bills), suggested daily/weekly limits, suggested goal allocation.
  - **Unknown:** a figure whose window starts before tracking began, or that includes an account not
    yet tracked at that time, or a period with no entries on some days where completeness can't be
    told. Unknown figures say what is missing instead of showing ₹0.
  - Estimated figures are never listed as transactions and never enter a total of recorded figures.
- **Database:** none.
- **Risks:** label noise. Recorded is the default and is shown only where confusion is possible
  (beside an Estimated figure); Estimated and Unknown are always shown.

#### 7. Learned habits

- **Exists:** `category_rules` (user rules, with a live tester), `suggestCategory` (rules → your past
  choices → similar words → keywords, each with a plain reason), `recurringSignals`, `frequentExpenses`,
  quick-add tiles with saved usual amounts.
- **Reuse:** all of them as sources.
- **Must change:** a "Suggestions" list (Manage › Categories › Learned) with three kinds:
  - a category rule: "You've put 'chai' under Food › Tea 6 times. Always do that?";
  - a tile amount: "You logged Tea at ₹15 the last 5 times. Make ₹15 its usual amount?";
  - a recurring item: "Rent looks monthly (₹4,000 on the 1st, 3 times). Add a reminder?"
  Approving creates an ordinary rule, tile change or recurring template (reminder mode). Dismissing
  stores the dismissal so it doesn't come back. Approved items are listed and can be edited or
  deleted like any other rule, tile or template.
- **Database:** `category_rules.origin text not null default 'user'` (`user` | `learned`); table
  `learned_suggestions (owner_id, fingerprint, kind, status, decided_at, result_id)` with owner-only
  RLS, holding only decisions (pending suggestions are worked out on the fly).
- **Risks:** the existing history-based prefill in `suggestCategory` already "learns" without being
  approved. It only prefills the picker with a reason, and nothing saves until you press Save, so I
  keep it (decided, D7).

#### 8. Redesign

- **Exists:** Design 1–4 tokens (three layers in `globals.css`), `Surface`, `Progress`, `StatePanel`,
  `Notice`, the feedback ladder, one navigation config (`src/lib/navigation.ts`) driving sidebar,
  bottom bar, You sheet and section tabs, `loading.tsx` per route, an a11y spec over every route.
- **Reuse:** the token layers, components and navigation config; the feedback ladder and level-up
  dialog; all routes.
- **Must change:** see sections 6 and 8. New: progression surface tokens, layout primitives, hub
  navigation, `RankEmblem` and `AchievementBadge` SVG components, every screen's composition.
- **Database:** none.
- **Risks:** visual changes break e2e selectors (fix the test to the new UI, never weaken it);
  first-load JS grows (track per route); `doc/DESIGN_PLAN.md`, which REDESIGN_V2's rules tell every
  prompt to read and update, was deleted in the V2 setup commit (section 14).

#### 9. AI Analyst (optional, Phase 5)

- **Exists:** nothing AI. The domain layer can already answer every number the analyst would need.
- **Reuse:** domain functions as the only source of figures, `SpendingScope` links as citations.
- **Must change:** opt-in setting with a plain disclosure; a server-only provider interface (one
  function: question + compact facts → answer text + cited ids); an "Ask" panel in Insights.
- **Database:** `profiles.ai_enabled boolean default false`, `profiles.ai_consent_at timestamptz`.
- **Risks:** see Q9. Free tiers of hosted models commonly allow the provider to use submitted data
  for training. If no free option avoids that, Phase 5 stops and reports, as the brief requires.

### 3.2 Removing (V2_BRIEF section 5)

| # | Forecast | Where it lives now | Remove | Keep |
| --- | --- | --- | --- | --- |
| 1 | Expected end-of-period balance | `calculateSafeToSpend` → `expectedEndBalancePaise`, `endBalanceAssumption`; `/safe-to-spend` "Expected balance before next income" | Both fields, the figure row, their tests in `savings-safe-to-spend.test.ts` and `plan.test.ts` | Flexible money, daily and weekly limits |
| 2 | Survival Mode projections | `survivalPlan`: the "may run out a little early" branch, which reads `runOutInDays` | That branch and its copy | Current status: needs a date, tight now (flexible ≤ 0), a bigger day today, on track, too early |
| 3 | "May run out early" pace warning | `calculateSafeToSpend` → `runOutInDays` and its warning | The field, the warning, tests | The past-due and over-committed warnings |
| 4 | Goal estimated finish date | `goalForecast` in `savings.ts`; goal page "At your pace so far" | The function, its type, the figure row, tests in `plan.test.ts` | Suggested weekly/monthly amount toward a target date you set |

Also, to keep the rule "V2 does not predict" consistent:

- **Budget "at this pace you'd reach about ₹X" — decided: drop it.** Keep the status "Ahead of
  pace", defined exactly as *share used > share elapsed* (the same condition as today,
  algebraically). `projectedPaise`, its explanation clause and the budget-page line go.
- **Survival "on track" — decided: keep, worded about the past.** It compares your average daily
  spending over the last 14 complete days with today's daily amount. New wording, e.g. "Over the
  last 14 days you spent about ₹X a day, within today's ₹Y a day." No "you'll make it", "on course"
  or "would carry you" phrasing. `recentDailySpendingPaise` stays for this.
- **The word "Forecast" on recurring items** means "scheduled, not happened yet". Rename the label to
  "Scheduled" to avoid confusion with what was removed. No behaviour change.

All of this is Phase 2B (2A is test infrastructure only). Removal is one change per item: domain
function, UI, tests and copy together.

---

## 4. Money rules (the 10 invariants with loans, cards and corrections)

Notation: an account's balance = opening + income + refunds + transfers in + adjustments in −
expenses − transfers out − adjustments out, counting active entries dated on or after its opening
date. "Consolidated" sums every account the user owns, including cards and loans.

| # | Invariant (PROJECT_SPEC §7) | Loans | Credit cards | Reconciliation |
| --- | --- | --- | --- | --- |
| 1 | Positive integer paise; the type gives direction | Transfers, positive | Expenses, refunds, transfers, positive | `adjustment_in` / `adjustment_out`, positive; the type gives direction |
| 2 | Per-account balance formula; transfers net to zero | Borrow: loan −X, wallet +X. Repay: wallet −Y, loan +Y | Purchase: card −X. Pay bill: bank −Y, card +Y | Adds ± the correction to that one account. This is the "explicitly supported correction" the invariant names |
| 3 | Consolidated = opening total + income + refunds − expenses; transfers don't change it | Borrowing and repaying don't change it (net position) | Purchase lowers it once; paying the bill doesn't change it again | Becomes opening total + income + refunds + adjustments in − expenses − adjustments out. Corrections are not income or spending |
| 4 | Allocations don't change total money | Unaffected | Unaffected | Unaffected |
| 5 | Safe to Spend never subtracts a paid expense twice | Debt you owe is already inside the base, so a repayment must never also be a bill (reminder only). Money you **lent** is left out of the base until it comes back (see "Balance basis") | Card debt is already inside the base; the bill is a reminder, never a commitment | The corrected balance flows in through `wallet_balances` |
| 6 | Same boundaries and functions everywhere | Transfers are already excluded from spending/income in every aggregate | Card purchases are ordinary expenses in Insights, budgets, leaks, reports | Corrections are excluded from spending/income and shown as their own "Corrections" line in period summaries, reports and CSV: opening + income + refunds − spending ± corrections = closing |
| 7 | Edits/deletes recalculate; no duplicates on retry | Ordinary idempotent transfer commands | Same | `record_reconciliation` is idempotent by check id and correction id; deleting the correction reopens the check |
| 8 | No floating point | Unchanged | Available credit is integer subtraction | Difference is integer subtraction |
| 9 | Label scope and time of every balance | "You owe Ravi ₹600 · now" | "Owed on card ₹2,300 · now" | "Checked 12 Nov 18:20" on the account |
| 10 | Historical closing balances reconstructable | Yes, transfers are dated | Yes | The correction is dated at the check's time, so balances before that are unchanged |

**Balance basis (decided).**

- **Tracked balance = net position:** every account, cards and loans included. This keeps invariant
  3 exact. Home shows the net figure as the hero and, when you have any card or loan, one quiet line
  beneath it: "In wallets ₹X · You owe ₹Y · Owed to you ₹Z".
- **Safe to Spend base = cash in wallets − card debt − loans you owe.** Money other people owe you
  (positive balances on `loan_lent` accounts) is **not** counted until it comes back, because you
  can't spend it yet. Written as one rule:

  ```
  safe-to-spend base = net tracked balance − Σ max(0, balance of each loan_lent account)
  flexible           = base − savings set aside − unpaid bills due by the horizon − reserve
  ```

  When the friend repays, the transfer moves the money from the lent account into a wallet, and only
  then does it enter Safe to Spend. A `loan_lent` account that has gone negative (they paid back
  more than they owed) is treated as money you owe, so it stays in the base.
- **Tests (Phase 2B):** a unit test in the domain (`calculateSafeToSpend`) with ₹1,000 cash, a
  ₹300 card debt, a ₹200 loan owed and ₹500 lent: tracked balance ₹1,000 (1,000 − 300 − 200 + 500;
  corrected in Phase 2B, the Phase 1 text said ₹0), Safe to Spend base ₹500 (lent money excluded). Then the friend repays ₹200: base ₹700, tracked
  balance unchanged. Plus the negative-lent edge case. The DB test checks the same figures from
  `wallet_balances`.
- The `inputs` of a Safe to Spend result gain `lentOutPaise`, and its explanation gets a line:
  "Money you lent (₹500) isn't counted until it comes back."

Brief rules 1–7 (V2_BRIEF section 8) map onto this table: 1 (loans), 2 (cards), 3 (refunds, unchanged
convention in `schemas.ts`), 4 (balances only from records; corrections are records), 5 (idempotent:
client ids and the new RPC), 6 (all in `src/domain`, integer paise), 7 (corrections are reversible
and kept in history).

---

## 5. Data model changes

All changes are additive. No column is dropped, no type narrowed, no data rewritten.

### Phase 2 — migration `…_v2_loans_cards_reconciliation`

| Change | Detail |
| --- | --- |
| `accounts.kind` check | add `credit_card`, `loan_borrowed`, `loan_lent` (drop and re-create the check with the wider list) |
| `accounts.counterparty` | `text null`, ≤ 60 chars, only meaningful for loan kinds |
| `accounts.credit_limit_paise` | `bigint null`, > 0, only when `kind = 'credit_card'` (check) |
| `accounts.statement_day`, `due_day` | `smallint null`, 1–28, only for `credit_card` |
| `transactions.type` check | add `adjustment_in`, `adjustment_out` |
| `transactions_shape` check | new branch: account required; no category, goal, refund link, from/to |
| `transactions.source` check | add `reconciliation` |
| `transactions_guard` | adjustments skip the category check (they have none) |
| `reconciliations` table | as in 3.1 #3; same-owner FKs to `accounts` and `transactions`; owner-only RLS; index `(owner_id, account_id, as_of desc)` |
| `wallet_balances` | `create or replace`, adds the two adjustment types to `moves` |
| `record_reconciliation` RPC | SECURITY INVOKER, `auth.uid()` owner, idempotent, returns `{status}` like the others |
| `notifications.kind` check | add `card_due` |

Domain and app changes that go with it: `TRANSACTION_TYPES`, `ACCOUNT_KINDS`, `accountDelta`,
`summarizePeriod` (+ `adjustmentsInPaise`, `adjustmentsOutPaise`), report model and CSV, data export,
mappers, entry view, history filters, the mutation layer (a `reconcile` operation beside the ledger
commands, deliberately **outside** the queued `LedgerCommand` union so it can't be queued; its Undo
is an ordinary `delete` command), rewards (corrections earn nothing).

### Phase 4 — migration `…_v2_feed_habits`

| Change | Detail |
| --- | --- |
| `feed_dismissals` | `(owner_id, item_key)` unique, `dismissed_at`; owner-only RLS |
| `learned_suggestions` | `owner_id, id, fingerprint, kind, status, decided_at, result_id`; `(owner_id, fingerprint)` unique; owner-only RLS |
| `category_rules.origin` | `text not null default 'user'`, check `user`/`learned` |

### Phase 5 — migration `…_v2_ai_optin` (only if Phase 5 goes ahead)

`profiles.ai_enabled boolean not null default false`, `profiles.ai_consent_at timestamptz null`.

### Rules for every migration

RLS on every new private table; SECURITY INVOKER for every new function; `auth.uid()`, never a
client-supplied user id; files only — you run `npx supabase@2.120.0 db push` against the V2 project
(`qdoyqcvzhxfsmwrcbsjs`). Nothing is ever run against V1. Each migration ships with DB tests on local
PostgreSQL 18 (the existing `npm run test:db` harness).

---

## 6. Screens and navigation

### 6.1 Comparing the two navigation plans

| | V2_BRIEF §9 | REDESIGN_V2 (Part B, Prompt 1) | Today |
| --- | --- | --- | --- |
| Sidebar | Home, Transactions, Insights, Plan, Player, Reports, Manage, Settings | same eight | 7 groups, ~22 links, Record as 4 links |
| Add | one prominent Add Expense | one Add expense, opens the entry choice | Record grid + mobile docked Add |
| Insights hub | Insights, **Intelligence Feed, Reviews**, Money Leak Detector | Insights, Money leaks | Insights, Money leaks |
| Plan hub | Budgets, Goals, Safe to Spend, Survival Mode, **Recurring** | Budgets, Savings goals, Safe to spend, Survival mode | same as REDESIGN |
| Player hub | Player status, Missions, Achievements, Rewards | same | Progress group |
| Manage hub | Wallets/Accounts, Categories, Reminders | Wallets, Categories, **Income & recurring**, Reminders | split across Activity and You |
| Mobile | five destinations + Add | keep 5 tabs + Add; Player, Manage, Settings within two taps | Home, Activity, Add, Insights, Plan, You |
| Label | "Safe to Spend" | "Safe to spend" | "Safe to spend" |

They agree on the eight destinations. They differ on where Recurring lives, on the Insights hub's new
tabs, and on capitalisation.

**Recommendation: the brief's version**, for three reasons. It is the higher-priority document. It
already includes the Phase 4 screens, so navigation won't be reshuffled twice. And Recurring belongs
in Plan: recurring bills are an input to Safe to Spend, which sits in the same hub. From REDESIGN_V2,
keep the parts the brief doesn't contradict: Add opens the existing entry choice; hub tabs on every
hub page; the slim one-line level widget linking to Player; every existing URL keeps working; the
sidebar fits 1366×768 without scrolling.

Two additions the brief implies but doesn't spell out: **Wallets becomes "Accounts"** (it now holds
cards and loans), and the Insights hub's Feed and Reviews tabs appear in Phase 4, when the screens
exist (no empty tabs in Phase 3).

### 6.2 Final map

| Sidebar | Hub tabs (route) |
| --- | --- |
| Home | `/home` |
| Transactions | `/transactions` (detail `/transactions/[id]`, edit, new) |
| Insights | Insights `/insights` · Feed `/insights/feed` (P4) · Reviews `/insights/reviews` (P4) · Money leaks `/insights/leaks`; category drill-down `/insights/category/[id]` |
| Plan | Budgets `/budgets` · Goals `/goals` · Safe to Spend `/safe-to-spend` · Survival Mode `/survival` · Recurring `/recurring` |
| Player | Player status `/rewards/status` · Missions `/rewards/missions` · Achievements `/rewards/achievements` · Rewards `/rewards` |
| Reports | `/reports` (export `/reports/export`) |
| Manage | Accounts `/accounts` (card and loan detail `/accounts/[id]`, check balance) · Categories `/categories` (rules, learned) · Reminders `/reminders` |
| Settings | `/settings`, privacy, sync, data |
| **Add** (button) | sheet: Quick add `/add` · Type it `/add/text` · Say it `/add/voice` · Full form `/transactions/new` |

`/accounts/[id]` is the only new route in Phase 2; Feed and Reviews in Phase 4; an Ask panel inside
Insights in Phase 5.

**Mobile:** bottom bar Home · Transactions · **Add** (docked) · Insights · Plan · More. More opens
a sheet: Player, Reports, Manage, Settings. Player is also one tap from the Home level strip, so
everything is within two taps. Safe to Spend is on Home.

---

## 7. How V1 data maps into V2

V2's schema is V1's plus additions, so every V1 row loads unchanged.

| V1 table | V2 | Notes |
| --- | --- | --- |
| `profiles` | same | new columns take defaults (`ai_enabled = false`) |
| `accounts` | same | `kind` values all still valid. `card` rows stay `card` ("Debit card"); the import converts nothing. New columns null |
| `transactions` | same | no V1 row uses the new types. Ids, idempotency keys, versions and batch ids keep their values |
| `categories`, `category_rules` | same | rules get `origin = 'user'` |
| `budgets`, `savings_goals`, `commitments`, `recurring_templates`, `quick_add_presets` | same | |
| `notification_preferences`, `notifications` | same | |
| `xp_events`, `user_achievements`, `user_quests`, `streak_state` | same | written only by the server |
| `sync_operations`, `sync_devices` | not moved | device-local bookkeeping; the queue on each device is empty after the move |
| — | `reconciliations`, `feed_dismissals`, `learned_suggestions` | start empty |

**How the move works (Phase 6).** Claude Code never connects to V1. You download the JSON export
from the live V1 app (Settings › Data › Export, which already covers all 16 user tables above). You
sign up once on V2. A one-time import script, run by you on your machine against V2 only, loads the
file for your V2 user id, in foreign-key order, inside one transaction, and then runs the money check
(V1's figures from the export vs V2's from `wallet_balances` and the domain) before it commits.

Two things the import must handle, found in the code:

1. **`created_at` is reset by the `transactions_guard` trigger on insert.** Daily XP and streaks
   count by when an entry was *logged* (`createdAt`). A naive import would make every V1 entry look
   logged on import day. The import must keep the original timestamps (a server-only import function
   that sets them after insert, or a guarded bypass), and the DB test must prove streaks come out
   the same.
2. **Owner ids change.** Every `owner_id` is replaced with the V2 user's id; all other ids stay, so
   composite same-owner foreign keys still line up.

---

## 8. Design plan by screen

Applies REDESIGN_V2 Part A: one dominant element per screen; sections separated by space and
dividers, not boxes; at most three bordered boxes visible on desktop; one helper line per card,
the rest behind an info icon; violet only for the primary action, the active nav item and small
accents; progression screens cinematic and quiet; both themes deliberate.

| Screen | Dominant element | Remove or move | Phase |
| --- | --- | --- | --- |
| App shell | One Add button | ~22 links → 8; Record links into the Add sheet; level shown once as a slim line | 3A |
| Home | Net tracked balance + Safe to Spend side by side | 13 tiles → 6 most used + More; pencils and "Set amount" text; level shown only once; disclaimer once behind an info icon | 3B |
| Player status | Rank emblem with XP ring | settings-page look; empty Milestones box | 3C |
| Missions | Current objective | three checklist columns; "Skip" moves to an overflow menu | 3D |
| Achievements | Badge collection, total count | descriptions in the grid | 3D |
| Rewards | Inventory | shop-like cues | 3D |
| Insights | Period total with comparison | box-in-box; extra charts | 3E |
| Feed | The newest strong finding | — (new) | 4A |
| Reviews | This week's in/out | — (new) | 4A |
| Money leaks | The biggest leak with its what-if | one row per group, what-if on open | 3E |
| Budgets | Total budget progress | "target, not reserved money" on every card → once per page (e2e updated, not weakened) | 3E |
| Goals | Active goal progress | estimated finish date (removed in P2) | 3E |
| Safe to Spend | Daily amount | expected end balance (removed in P2); inputs into a calm breakdown below | 3E |
| Survival Mode | Current status headline | run-out projection (removed in P2) | 3E |
| Recurring | Next due item | "Forecast" label → "Scheduled" | 3E |
| Transactions | Day-grouped list | filters behind one "Filters" control on phones | 3F |
| Accounts | Net total with wallets / owed / owed to you | long helper sentences; cards and loans grouped | 3F |
| Account detail (new in P2) | Balance and "Check balance" | — | 2B (functional), 3F (styled) |
| Categories | Category list | rules and learned items as tabs | 3F |
| Reports | Paper-like preview | options collapsed on phones | 3F |
| Reminders, Settings, Privacy, Sync, Data | The list itself | per-section boxes → sections with dividers | 3F |
| Welcome, auth, onboarding | The one form | — | 3F |

Rank emblems and achievement badges: inline SVG components, geometric, mostly monochrome, violet
only as an accent, readable at 24 px and 240 px. Prompt 3C shows three directions and waits for your
choice.

---

## 9. Performance baseline and targets

### Baseline (2026-11-12, this machine, commit `6e15776`, nothing else running)

| Check | Result | Time |
| --- | --- | --- |
| `npm run lint` | pass, 0 problems | 110 s |
| `npm run typecheck` | pass | 65 s |
| `npm test` | pass, 36 files / 918 tests | 78 s (vitest: 66.5 s, of which 69 % jsdom environment setup, 2 % running tests) |
| `npm run build` | pass, 42 pages generated, Turbopack compile 25.8 s | 53 s |

**First-load JS per route.** Next 16 with Turbopack no longer prints sizes in the build output, so
they were computed from the build's own manifests: the root main files plus every chunk that the
route's layouts, page, loading, error and not-found segments reference
(`page_client-reference-manifest.js`). Code loaded later on demand (Recharts, PDF export, the offline
queue) is not included. Sizes are uncompressed / gzip, in KB. The same script is used in every phase
so the numbers compare like for like; it is kept as `scripts/route-js.mjs` from Phase 2A (it's a
read-only measurement script, in the scratchpad for Phase 1).

| Route | Chunks | Raw KB | Gzip KB |
| --- | --- | --- | --- |
| `/` (redirect), `/_not-found` | 9 | 462 | 139 |
| `/offline` | 10 | 465 | 141 |
| `/welcome` | 14 | 596 | 187 |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | 14 | 604 | 189 |
| `/onboarding` | 17 | 796 | 250 |
| `/home` | 20 | 848 | 267 |
| `/add` | 19 | 844 | 266 |
| `/add/text` | 19 | 816 | 256 |
| `/add/voice` | 19 | 819 | 258 |
| `/transactions` | 19 | 827 | 259 |
| `/transactions/new` | 19 | 822 | 258 |
| `/transactions/[id]` | 18 | 791 | 248 |
| `/transactions/[id]/edit` | 18 | 821 | 257 |
| `/accounts` | 18 | 791 | 247 |
| `/categories` | 20 | 848 | 267 |
| `/recurring` | 18 | 810 | 253 |
| `/insights` | 18 | 795 | 248 |
| `/insights/category/[id]` | 19 | 820 | 256 |
| `/insights/leaks` | 19 | 823 | 257 |
| `/budgets` | 18 | 794 | 248 |
| `/goals` | 18 | 810 | 254 |
| `/goals/[id]` | 18 | 836 | 262 |
| `/safe-to-spend` | 18 | 790 | 247 |
| `/survival` | 18 | 790 | 247 |
| `/reports` | 18 | 794 | 248 |
| `/rewards` | 18 | 790 | 247 |
| `/rewards/status` | 18 | 789 | 247 |
| `/rewards/missions` | 18 | 796 | 249 |
| `/rewards/achievements` | 18 | 790 | 247 |
| `/reminders` | 18 | 806 | 252 |
| `/settings` | 18 | 808 | 253 |
| `/settings/privacy` | 18 | 800 | 250 |
| `/settings/sync` | 18 | 808 | 253 |
| `/settings/data` | 18 | 787 | 246 |

What this says: the signed-in app shell (root + `(app)` layout) is about 787 KB raw / 246 KB gzip,
and every signed-in screen adds only 0–61 KB on top. The biggest pages are Home, Categories and Add
(~848 KB). So the place to save is the shell (providers, `motion`, Radix, the sidebar and sheets),
not individual screens; the new hub navigation in Phase 3A should make the shell smaller, not bigger.

### Targets

1. No route's first-load JS grows by more than 5 % in a phase without a written reason.
2. Recharts, the PDF code, and the voice code load only on the screens that use them (true today for
   Recharts and PDF; check voice).
3. Emblems and badges are inline SVG; no image files, no new icon package.
4. No new dependency without a written reason.
5. The speed fixes stay: one balance RPC, per-screen slices, intent-only sidebar prefetch, `bom1`.
   The V2 Supabase project (`pocketpulse-v2`) is in **ap-south-1 (Mumbai)**, checked with
   `supabase projects list` on 2026-11-12, so `bom1` still sits next to the database.
7. **Shared signed-in shell: from 246 KB to at most 200 KB gzip by the end of Phase 3** (787 KB →
   about 640 KB raw), measured on `/settings/data`, the smallest signed-in page, which is almost
   only the shell. Why 200 is realistic:
   - About 130 KB of the 246 is the framework (React DOM and the Next runtime) and can't move.
   - The app's own ~116 KB includes a **38 KB `zod` chunk**, about **40 KB of Radix** and about
     **16 KB of `motion`** (from the Phase 1 chunk breakdown).
   - Validation the shell needs only when saving (the ledger commands for the Undo toast and the
     offline queue) can load on first use, as the Dexie queue already does: about −30 KB. The
     slimmer eight-link navigation, with the sheets loaded when opened, can lose about −10 KB of
     Radix. Doing the page fade and balance count-up in CSS and dropping `MotionConfig` from the
     shell can lose about −10 KB.
   - That is about 50 KB, so 200 leaves a little margin. A stretch goal of 185 KB is possible only
     if `zod` leaves the shell entirely.
   No signed-in page may add more than 70 KB gzip on top of the shell.
6. Cheap wins found while measuring, for Phase 2: ESLint scans `.pgtest/` (the local PostgreSQL
   data directory, not in `ignores`; not yet measured whether that is what makes lint take 110 s),
   and the unit tests set up jsdom for every file (69 % of their run time), including the 12 domain
   test files and other pure ones that could use the `node` environment.

---

## 10. Test speed-up plan and smoke set

### Why the full browser run is slow

- **Five projects, 407 tests.** `desktop` and `mobile` run every non-money spec; `ledger-desktop`
  and `ledger-mobile` run the eight money specs.
- **The money specs are strictly serial.** They assert exact balance changes on one shared test
  account, so each ledger project has `workers: 1`, and `ledger-mobile` depends on `ledger-desktop`.
  About 120 tests run one after another. While `ledger-mobile` runs, three of the four workers sit
  idle. This chain is most of the wall-clock time.
- **Every page hits the hosted Supabase project** from your machine (session check, profile, data).
  A signed-in page costs several round trips; the a11y spec alone loads 26 routes × 2 themes ×
  2 viewports and runs axe on each (128 tests), and `shell.spec` and `auth.spec` load the same routes
  again for heading/overflow/console checks.
- **The web server builds first** (`npm run build && next start`, about 1 minute here), and
  `reuseExistingServer` can silently reuse a stale server on port 3100.
- **One failure stops the chain.** If a ledger-desktop test fails, ledger-mobile doesn't run, and
  leftover entries on the shared account have broken later specs (Design 4 runs 3, 4 and 6).
- **Recorded times:** 6.0 min (desktop only), 10.1–14.8 min for green or nearly green full runs,
  39.4 min when the sidebar prefetched every route. Not an hour in any recorded run; the hour
  was an earlier estimate that included reruns (D3).

### Plan (Phase 2A)

1. **One test account per money spec.** A setup script creates (or reuses) one account per ledger
   spec file in the V2 project, signs each in once, and saves one storage state per account. The
   money specs then run in parallel: file-level parallelism, `serial` only inside a file where tests
   share state. Removes the 120-test serial chain and the cross-spec leftovers.
2. **Run each money journey once, at the viewport where it matters.** Most money assertions don't
   depend on screen size. Keep both viewports for Journeys A and G and the navigation/entry UI;
   the rest run on desktop only. About 50 fewer tests, no lost coverage of logic.
3. **Visit each route once per theme and viewport.** Merge the per-route checks of `shell.spec`
   (heading, overflow, console errors) and `auth.spec` into the a11y visit that already loads the
   same page. About 50 fewer page loads per viewport.
4. **Build once.** `test:e2e` expects a fresh `next start` and refuses to reuse a server it didn't
   start unless asked, so a stale build can't decide a result.
5. **No fixed waits.** Replace the 3 `waitForTimeout` calls and `networkidle` in the a11y spec with
   waits for the page's own ready signal.
6. **Workers stay at 4** (measured in 2A: at 6, long money journeys queued behind other pages on
   the one `next start` server and ran out of their 30 s), with at most three money specs at once.

Expected: about 6–9 minutes for the full run on this machine, measured and reported in Phase 2A, not
assumed.

### Smoke set (about 20 tests, tagged `@smoke`, `npm run test:smoke`)

| # | Test | Spec | Viewport |
| --- | --- | --- | --- |
| 1 | sign in once (setup) | auth.setup | — |
| 2 | root sends signed-out visitors to welcome | auth | desktop |
| 3 | sign-in validates input on the server and keeps the email | auth | desktop |
| 4 | signed-in users skip the sign-in page and can sign out | shell | desktop |
| 5 | navigation: sidebar on desktop, bottom tabs + sheet on mobile | shell | both |
| 6 | Journey A: quick-add updates balance, feed and today's spending; Undo | transactions | both |
| 7 | one-tap tile: double tap saves once; Undo | transactions | mobile |
| 8 | full form → search → detail → edit → undo edit → delete | transactions | desktop |
| 9 | another user's transaction id is a 404 | transactions | desktop |
| 10 | Journey B: typed entries reviewed, saved together, undone together | transactions-batch | desktop |
| 11 | voice: unsupported browsers get the typed route | transactions-batch | desktop |
| 12 | Journey C: Insights, leaks and history agree | insights | desktop |
| 13 | Journey D: setting money aside isn't spending; a purchase counts once | plan | desktop |
| 14 | Journey E: limits follow the saved date; a paid bill counts once | plan | desktop |
| 15 | Journey F: review, choose, export a report that adds up | report | desktop |
| 16 | another user's reports and exports never hold this user's data | report | desktop |
| 17 | Journey G: add offline, reload, sync once, correct on another device | offline | desktop |
| 18 | daily XP follows entries; achievements stay; re-adding never earns twice | rewards | desktop |
| 19 | a11y: `/home` in dark | a11y | mobile |
| 20 | a11y: `/transactions` in light | a11y | desktop |

From Phase 2B on, add one smoke test each for: a card purchase plus bill payment (spending counted
once), a loan borrowed and repaid (no income or spending), and a balance check with a correction and
its Undo.

### Where each test level runs

While working: unit tests for what changed, plus the related spec. End of each phase: lint,
typecheck, unit, build, smoke. Full browser suite: end of Phase 2 and Phase 6 only. DB tests
(`npm run test:db`) whenever a migration changes.

---

## 11. Phases 2 to 6, as prompts

| Prompt | Work | Stops for you |
| --- | --- | --- |
| **2A** | Test infrastructure only: per-spec test accounts (created by a script that refuses any project but V2), parallel money specs, one viewport for most money journeys, one visit per route, smoke set + script, faster unit-test setup. No app code, money logic, migration or schema change | — |
| **2B** | Remove the four forecasts and the budget rupee projection; reword Survival "on track" about the past; rename "Forecast" to "Scheduled". Migration (section 5, Phase 2) + DB tests; Safe to Spend base without lent money; domain changes; loans, cards, reconciliation (with the report's Corrections line) in the mutation layer and offline queue; account detail screen with Check balance, Pay card bill and loan actions, functional and plainly styled; the full browser suite once | You run `db push` on V2 before the e2e run |
| **3A** | Tokens (finance + progression surfaces), layout primitives, the eight-link sidebar, Add sheet, hubs with existing tabs, mobile bar, copy clean-up | — |
| **3B** | Home | — |
| **3C** | Emblem directions → **stop for your choice**; RankEmblem and AchievementBadge; Player status → **stop for your approval** | twice |
| **3D** | Missions, Achievements, Rewards, feedback moments | — |
| **3E** | Insights, Money leaks, Budgets, Goals, Safe to Spend, Survival, Recurring | — |
| **3F** | Transactions, Accounts (incl. cards, loans, check balance), Categories, Reports, Reminders, Settings, auth, onboarding; mobile and consistency passes | — |
| **4A** | Feed and Reviews (domain, migration for dismissals, screens, nav tabs) | `db push` |
| **4B** | Data labels and learned habits (migration, domain, screens) | `db push` |
| **5** | Provider check against the AI rules → **stop and report if none is free and private**; otherwise opt-in, server-only provider interface, Ask panel | possibly |
| **6** | Final checks incl. full browser suite; V1 → V2 import script and runbook; you run it; money check; size report | you export from V1 and run the import |

---

## 12. Acceptance criteria per phase

Every phase also: lint, typecheck, unit tests, build pass; smoke set passes; first-load JS per route
reported against section 9; `PROGRESS.md` updated; no TODO/FIXME/placeholder; nothing claimed that
wasn't run.

**Phase 2A**
- [ ] No file under `src/`, `supabase/` or `public/` changed.
- [ ] Every money spec runs on its own V2 test account; the account script refuses any project ref
      but `qdoyqcvzhxfsmwrcbsjs`, reads the key from `.env.local`, prints no key.
- [ ] No test deleted or weakened; every test still runs in the full suite (counts reported).
- [ ] Full browser suite measured under 15 minutes (target 6–9); smoke set measured, with its own
      npm script.

**Phase 2B**
- [ ] The four forecasts and the budget rupee projection are gone from domain, UI, tests and copy;
      grep finds no `expectedEndBalance`, `runOutInDays`, `goalForecast`, `projectedPaise`.
- [ ] Survival "on track" copy describes the past 14 days only.
- [ ] Safe to Spend base excludes money lent out (unit test with cash, card debt, loan owed, money
      lent; repayment case; negative-lent case) and the DB test agrees.
- [ ] Report: opening + income + refunds − spending ± corrections = closing, with a "Corrections"
      line, for a period holding a correction in each direction (unit and DB).
- [ ] Write-off and forgiveness happen only from a confirmation the user makes.
- [ ] Safe to Spend, Survival and goal suggestion results unchanged for every remaining field
      (existing tests still pass unmodified, except removed assertions on removed fields).
- [ ] Loans: borrowing and repaying change wallet and loan balances and never income, spending,
      budgets, insights or reports' spending lines (unit, DB and e2e).
- [ ] Cards: a ₹500 card purchase and a ₹500 bill payment lower consolidated money and month
      spending by ₹500 once (unit, DB, e2e).
- [ ] Reconciliation: a check of +₹40 creates one `adjustment_in` of ₹40, the account then matches,
      spending and income are unchanged, Undo removes it and reopens the check, a replayed save is
      `duplicate` (unit, DB, e2e).
- [ ] `wallet_balances` equals `ledgerBalances` on data that includes adjustments, cards and loans.
- [ ] RLS: another user can't read or write `reconciliations` or call the RPC for someone else.
- [ ] Offline: a balance check made offline is not queued; nothing is saved and the screen says
      it needs a connection (changed in Phase 2B: checks are never queued).
- [ ] `record_reconciliation` works out the recorded balance and difference itself; a correction
      that doesn't match writes nothing and returns `stale` with the current figures (DB test).
- [ ] Cards and loans: typed amounts are positive and the sign is converted (a unit test per
      account kind).
- [ ] Full browser suite: one clean run.

**Phase 3**
- [ ] Sidebar has eight links and one Add button; it fits 1366×768 and 1440×900 without scrolling.
- [ ] Every V1 URL still works; every feature is reachable in ≤ 2 taps on mobile.
- [ ] Each screen passes the REDESIGN_V2 screen review (one dominant element, ≤ 3 bordered boxes on
      desktop, phone layout designed, light theme deliberate) with screenshots at 375 and 1440 px.
- [ ] a11y spec: no axe violations, no horizontal overflow, 44 px touch targets.
- [ ] Emblems and badges are inline SVG; you approved the direction and Player status.
- [ ] No money logic, domain function or schema changed (diff check).
- [ ] Shared signed-in shell ≤ 200 KB gzip (section 9, target 7); no page more than 70 KB on top.

**Phase 4**
- [ ] Every feed item links to the exact entries behind it, and their sum equals the figure shown.
- [ ] No item repeats within its period; a dismissed item never returns; sparse data gives no item.
- [ ] Weekly and monthly reviews reconcile with Reports for the same period.
- [ ] Every Estimated figure is labelled and never inside a Recorded total; Unknown never shows ₹0.
- [ ] Learned suggestions change nothing until approved; approved items can be edited and deleted;
      dismissed ones don't return.

**Phase 5**
- [ ] Off by default; the disclosure names the provider and what is sent; no request is made before
      opt-in (tested).
- [ ] Key on the server only; provider behind one interface; free tier.
- [ ] Every number in an answer comes from the domain and is shown with its entries; the analyst can't
      write records; unanswerable questions say so.
- [ ] Or: a report that no free option meets the rules, and nothing built.

**Phase 6**
- [ ] Full browser suite and DB tests pass once on the final code.
- [ ] The import loads your V1 export into V2 with every balance, period total, goal earmark, streak
      and XP figure equal to V1's, checked by script before commit.
- [ ] Size report against the Phase 1 baseline.
- [ ] Setup docs (README) match the V2 project.

---

## 13. Known gaps carried from V1 (unchanged by V2 unless listed)

- V1 is deployed on Vercel (corrected in Phase 2B; the Phase 1 text said "Not deployed"). Real-phone
  install, offline on a phone, Safari/iOS and speech on a phone are unverified.
- Reminders only appear while the app is open (no push service).
- `npm audit`: a moderate `minimatch` advisory via ESLint tooling.
- Sidebar clicks are sometimes ~1 s (cause unknown, PROGRESS "Test fixes").
- Supabase's built-in email sends only a few emails an hour; custom SMTP needed before other users.

---

## 14. Where documents and code disagree

| # | Disagreement | Which wins / plan |
| --- | --- | --- |
| 1 | `CLAUDE.md`: "no V1/V2 releases or deferred feature phases" vs V2_BRIEF's six phases | Your instruction for this session (V2 Phase 1 of 6) and the brief. Suggest updating that line in `CLAUDE.md` |
| 2 | `PROJECT_SPEC` §14 requires an expected end-of-period balance and a run-out warning; Journey D says goal "forecast update" | The brief removes them; PROJECT_SPEC is lower priority |
| 3 | REDESIGN_V2 Part A rules tell each prompt to read `doc/REDESIGN_BRIEF.md` and `doc/DESIGN_PLAN.md` and write screen notes there; both (with `CODEBASE_REPORT`, `PHASE_PROMPTS`, `FEATURE_REPORT`) were deleted in commit `6e15776` | **Resolved:** all five restored unchanged from `b8669a3` in the Phase 1 commit (`doc/home-before.png`, deleted in the same commit, was not restored: it's an image, not one of the docs). Phase 3 writes its screen notes into `doc/DESIGN_PLAN.md` as REDESIGN_V2 says |
| 4 | REDESIGN_V2 navigation vs the brief | Section 6.1: the brief |
| 5 | "Safe to spend" (code, nav, REDESIGN_V2) vs "Safe to Spend" (brief) | The brief; Home already says "Safe to Spend" |
| 6 | V2_BRIEF §11: the full browser suite "takes about an hour" vs PROGRESS: 10–15 min green, 39 min worst | **Resolved:** the hour was an earlier estimate including reruns; the measured numbers stand; target 6–9 min |
| 7 | PROGRESS describes the hosted project as `qzmqvytrekenzciasvph` (V1); `.env.local` now points at `qdoyqcvzhxfsmwrcbsjs` (V2) | **Resolved:** PROGRESS's history is about V1; you confirmed the test accounts exist in V2 and all 13 migrations are pushed there |
| 8 | PROJECT_SPEC §18 / CLAUDE.md: "lime/green" accent; Design 1 moved positive green from lime to a restrained green | Code (Design 1, your earlier approval) |
| 9 | `CLAUDE.md` mobile nav: Home, Transactions, Insights, Budgets/Goals, Reports; brief: five destinations + Add | Brief (section 6.2); Reports is two taps away via More |
| 10 | V2_BRIEF §12 "No security definer shortcuts"; V1 has three SECURITY DEFINER seed functions (`seed_user_defaults`, `handle_new_user`, `ensure_my_defaults`) | They stay (sign-up seeding needs them and they only touch the caller); V2 adds none |
| 11 | Account kind `card` is labelled "Card" with no credit/debit meaning | Relabel "Debit card", add `credit_card`; existing `card` rows stay debit (decided) |

---

## 15. Decisions, open questions and risks

**Decisions (your answers, 2026-11-12):**

- **D1. Balance basis.** Tracked balance = net position (wallets minus card debt and loans owed,
  plus money owed to you). Safe to Spend's base leaves out money you lent until it comes back, with a
  unit test (section 4).
- **D2. V1 cards.** `card` wallets are debit cards and stay as they are; nothing is converted.
- **D3. Test time.** "About an hour" was an earlier estimate with reruns; the measured 10–15 min is
  the baseline; target 6–9 min.
- **D4. V2 project.** All 13 migrations pushed; test accounts exist in V2; region ap-south-1
  (Mumbai), checked with the CLI. Phase 2A may create more test accounts with a script on your
  machine that refuses any project but `qdoyqcvzhxfsmwrcbsjs`, reads the secret key from
  `.env.local`, and never prints or commits keys.
- **D5. Budget projection.** Dropped; "Ahead of pace" stays (share used vs share elapsed).
- **D6. Survival "on track".** Kept, worded about the past 14 days.
- **D7. Category prefill.** Kept.
- **D8. Loans ending early.** A written-off loan you gave counts as spending; a forgiven loan you
  took counts as income; each only when you confirm it yourself.
- **D9. Corrections in the parent report.** Their own "Corrections" line; never income or spending.
- **D10. Deleted docs.** Restored unchanged.
- **D11. Shell size.** Target ≤ 200 KB gzip by the end of Phase 3 (section 9).

**Still open:**

- **Q9 (before Phase 5). AI provider.** Free tiers I would evaluate: Google Gemini API, Groq,
  Cloudflare Workers AI, OpenRouter free models. Several free tiers allow the provider to use
  submitted data for training or human review. Decide in Phase 5 whether that is acceptable if
  disclosed; if not and nothing qualifies, Phase 5 ends with a report.

**Risks:**

- **Reconciliation touches the core balance formula** (domain, SQL function, reports, CSV, export,
  queue). Mitigation: extend the domain-vs-SQL equivalence test first; one migration; money check of
  every screen before/after as in Speed fixes 1 and 2.
- **Double counting card bills or loan repayments** if someone adds them as bills. Mitigation: no
  commitment type for them; a deterministic nudge in the form; a DB test.
- **Import resets `created_at`**, changing streaks and daily XP (section 7).
- **Visual churn breaks e2e selectors** across Phase 3. Mitigation: role/label selectors, update tests
  to the new UI in the same prompt, never weaken.
- **Free-tier limits:** Supabase free projects pause after a week without activity; Vercel Hobby is
  for non-commercial use. Fine for a personal app; worth knowing.
- **First-load JS growth from SVG emblems and new screens.** Mitigation: per-route numbers every phase.
