# PocketPulse V2 — Product Brief

This file holds the product decisions for V2. Claude Code reads it at the start of every V2 phase.

## 1. What V2 is

PocketPulse V1 is finished, tested and live. V2 is one update to the same app that does three things:

1. Strengthens the financial foundation (loans, credit cards, reconciliation).
2. Redesigns the whole app and simplifies navigation.
3. Adds a deterministic Intelligence Feed and weekly/monthly reviews, plus an optional AI Analyst at the very end.

Reviewers of V1 said the app feels overwhelming and looks generic. So V2 must end up feeling **simpler** than V1, even though it does more. Every screen shows less at once.

Goal: the simplest reliable PocketPulse, not the most complicated one.

## 2. Which document wins

If documents disagree, follow them in this order:

1. The latest explicit instruction from the user in chat.
2. This file (`doc/V2_BRIEF.md`).
3. `doc/REDESIGN_V2.md`, Part A only (design direction). Its prompts in Part B are old and must not be executed as written.
4. `PROJECT_SPEC.md`. It still applies in full for everything this brief does not change: money invariants, security, privacy, offline sync, testing subjects.

Older files such as `START_HERE_PROMPT.md`, `claude/PHASE_PROMPTS.md`, `doc/REDESIGN_BRIEF.md` and `doc/DESIGN_PLAN.md` are history. Read them for context only.

When you find a conflict, say so in your report. Do not silently pick one.

## 3. Priorities

1. Financial correctness.
2. Keeping existing working features working.
3. Simpler, clearer experience.
4. Design quality.
5. Gamification and polish.

## 4. Adding

| # | Feature | What it means |
|---|---|---|
| 1 | Loans | Money borrowed or lent is tracked and affects account balances, but is never counted as income or expense. Repayments are not expenses or income either. |
| 2 | Credit card handling | A credit card is an account that can hold a negative balance. A card purchase is the expense. Paying the card bill is a transfer from another account, never a second expense. |
| 3 | Balance reconciliation | The user enters the real balance of an account. The app shows the difference and lets the user either find the missing entry or record one clearly labelled correction. |
| 4 | Intelligence Feed | A feed of spending discoveries built from the existing deterministic insight functions. No AI. Each item links to the transactions behind it. No repetitive or weak items. |
| 5 | Weekly and monthly reviews | A summary of the period: income, spending, category changes, patterns, comparison with the previous period. Deterministic. |
| 6 | Data labels | Figures are marked Recorded (real entries), Estimated (clearly separate, never shown as real transactions) or Unknown (completeness cannot be checked). |
| 7 | Learned habits | The app may suggest a pattern or category rule from the user's history. Nothing is applied until the user approves it. The user can view, edit and delete every learned item. |
| 8 | Redesign | New design tokens, hub navigation, simpler Home, Player Status and Missions screens, custom SVG rank emblems and achievement badges, then every remaining screen. See section 9. |
| 9 | AI Analyst (optional, last) | Natural-language questions about the user's own records. See section 8. |

## 5. Removing

These are forecasts. V2 explains recorded history and the present; it does not predict.

1. Expected end-of-period balance in Safe to Spend.
2. Future projections in Survival Mode. Current status stays.
3. The "you may run out early" pace warning in Safe to Spend.
4. The estimated finish date on savings goals.

Staying, because they describe today or are plain arithmetic on user inputs:

- Suggested daily and weekly limit in Safe to Spend.
- Budget pace (share of budget used vs share of period elapsed).
- Suggested periodic allocation toward a goal with a user-set target date.

Remove these cleanly: domain function, UI, tests and copy together. Do not leave dead code.

## 6. Keeping, with simpler UX

Nothing here is deleted. Review each one and reduce what it shows at once.

- Quick add, full form, typed entry, voice entry.
- Transactions history, edit, delete, undo.
- Insights and Money Leak Detector.
- Budgets, savings goals, Safe to Spend, Survival Mode (current status only).
- Recurring items and commitments.
- Parent reports with PDF, CSV and text export.
- XP, levels, streaks, missions, achievements, rewards.
- Reminders, settings, data export, account deletion.
- PWA install and offline sync.
- Dark and light themes.

## 7. Not in V2

Do not build these and do not add placeholders for them:

- Android APK or any native app. V2 stays a web app/PWA.
- Payment notification capture, SMS capture and automatic saving. These need a native app and are postponed. Keep the single mutation layer clean so a new entry source could be added later, but build nothing for it now.
- Investments, crypto, bank synchronization, social leaderboards.
- Multiple AI agents, forecasting, autonomous financial actions.
- Any feature not listed in this brief.

## 8. Financial and AI rules

### Financial rules

All ten invariants in `PROJECT_SPEC.md` section 7 still apply. In addition:

1. Loans are not income. Loan repayments are not expenses.
2. Credit card bill payments never double-count spending.
3. Refunds reduce the original expense, following the convention already documented in the code.
4. Account balances are always calculated from records, never stored as a typed-in number. A reconciliation creates a labelled correction record.
5. Every duplicate-prone operation stays idempotent.
6. All money math is deterministic application code in the existing domain layer. Integer paise only.
7. The user stays in control of every correction. Corrections are reversible and keep history.

### AI rules (Phase 5 only)

1. Off by default. The user turns it on, after a plain explanation of what is sent and to whom.
2. No financial data leaves the app unless the user has opted in.
3. It must work on a free tier. If no free option is workable, report that and stop; do not add a paid dependency.
4. The provider key lives on the server only. The provider must be replaceable behind one small interface.
5. Send the minimum context needed for the question.
6. The AI never does arithmetic. Numbers come from the domain layer and are passed to it.
7. Every answer shows the transactions and figures it used.
8. The AI never creates, edits or deletes records, and never invents data. If the records cannot answer the question, it says so.
9. One assistant. No multi-agent setup.

Phases 1 to 4 use no AI at all.

## 9. Design direction

`doc/REDESIGN_V2.md` Part A is the detailed design direction. Summary:

- Money screens: premium, calm, minimal, information first.
- Progression screens (Player status, Missions, Achievements, Rewards): cinematic, dark, restrained, geometric.
- One design system for both. Geist typography. Violet as a restrained identity colour. Dark and light themes.
- Rank emblems and badges are custom SVG drawn in code.
- Each screen has one clear main element. Fewer cards, fewer borders, fewer icons than today.
- Short, rare motion. Reduced-motion respected. Accessible contrast, focus, labels and touch targets.

Must avoid: childish or cartoon styling, anime or Solo Leveling names/symbols/assets, gacha or casino styling, purple gradients everywhere, generic dashboard templates, decorative controls that do nothing, fake or demo numbers.

### Navigation

Desktop sidebar: Home, Transactions, Insights, Plan, Player, Reports, Manage, Settings. One prominent Add Expense action.

- Plan hub: Budgets, Goals, Safe to Spend, Survival Mode, Recurring.
- Player hub: Player status, Missions, Achievements, Rewards.
- Insights hub: Insights, Intelligence Feed, Reviews, Money Leak Detector.
- Manage hub: Wallets/Accounts, Categories, Reminders.

Mobile: five bottom destinations plus a fast Add button.

Use the label "Safe to Spend".

If this navigation differs from `doc/REDESIGN_V2.md`, flag it in the Phase 1 spec and recommend one.

## 10. Size, speed and optimization

1. Phase 1 records a baseline: production build output (first-load JS per route) and build time.
2. Every later phase reports the same numbers. They must not get worse without a stated reason.
3. Screens and heavy components (charts, PDF export, voice) load only when needed.
4. No new dependency without a written reason. Prefer what is already installed.
5. Emblems and badges are inline SVG, not image files.
6. The earlier speed fixes stay intact: single RPC for balances, caching, Vercel region config. Never go back to downloading the whole ledger per screen.

## 11. Testing rules

The full browser suite takes about an hour. That is not acceptable as a routine step.

1. While working: run unit tests and only the tests related to what changed.
2. At the end of each phase: lint, typecheck, unit tests, production build, and the smoke set (about 20 key browser tests, a few minutes).
3. The full browser suite runs only when the phase prompt says so: once after Phase 2 and once in the final check.
4. Phase 2 includes making the suite faster (target: full run under 15 minutes).
5. Never delete or weaken a test to make it pass. Fix flaky tests at the root cause, not with longer timeouts.
6. Never claim a check passed unless it was run. Show real numbers.

## 12. Database and safety

1. V2 has its own Supabase project (ref `qdoyqcvzhxfsmwrcbsjs`). The V1 project is live and holds real data. Never connect to, modify or run anything against V1.
2. Claude Code writes migrations as files and reports them. The user pushes them with `npx supabase@2.120.0 db push`. Claude Code never pushes.
3. Migrations are additive where possible. Never reset the database or drop financial data.
4. RLS on every new private table. No `security definer` shortcuts. Use `auth.uid()`, never a client-supplied user id.
5. Real data moves from V1 to V2 once, at the end of V2. Every schema change must therefore be something V1 data can be loaded into. Note the mapping in the spec.

## 13. Cost

Everything must be free: hosting, database, AI, tools. Flag anything that would cost money before using it.

## 14. Phase plan

| Phase | Work | Prompts |
|---|---|---|
| 1 | Inspection and `doc/V2_SPEC.md`. No code changes. | 1 |
| 2 | Financial foundation (loans, credit cards, reconciliation, forecast removals) and faster tests | 2 |
| 3 | Redesign and navigation | 6 |
| 4 | Intelligence Feed, reviews, data labels, learned habits | 2 |
| 5 | Optional AI Analyst | 1 |
| 6 | Final check and V1 to V2 data move | 1 |

One phase prompt per Claude Code session. Each prompt ends with a report, then stops.
