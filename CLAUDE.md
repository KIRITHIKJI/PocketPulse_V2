# PocketPulse — Persistent Claude Code Instructions (V2)

## Read first
Before making changes, read these files completely, in this order:

1. `doc/V2_BRIEF.md` — the V2 product decisions. This is the authority for V2.
2. `PROJECT_SPEC.md` — the original product spec. Still applies for everything the V2 brief does not change.
3. `PROGRESS.md` — current project state.
4. `doc/V2_SPEC.md` — once it exists (created in V2 Phase 1).

If documents conflict, follow the order in `doc/V2_BRIEF.md` section 2. If an instruction in the chat conflicts with the documents, call out the conflict and follow the latest explicit user instruction.

## Product mandate
PocketPulse V1 is complete, tested and deployed. This repository is **V2**: one update to the existing app, built in the phases listed in `doc/V2_BRIEF.md` section 14.

- Work on exactly one phase prompt per session. When the prompt says "Report, then stop", stop. Do not start the next phase.
- Do not rebuild the app from scratch. Adapt the existing code.
- Only build what `doc/V2_BRIEF.md` lists. Do not add features, and do not remove features unless the brief says so.
- V2 must feel simpler than V1. When in doubt, show less on a screen.

PocketPulse is primarily for the student to understand spending, control it, and save money. Parent-ready reports are important but secondary. Recording tiny expenses must stay extremely fast, money calculations must stay trustworthy, and the app must work on laptop and mobile with synchronized data.

## How to work in this repository
1. Start by inspecting the working directory, git status, and the files relevant to the phase. Do not overwrite or delete existing work blindly.
2. Inspect the relevant source files before discussing or changing them. Do not trust documentation over the actual code. Never claim a feature, test, migration, integration, or build works unless you actually verified it.
3. Build end-to-end: database/schema, authorization, validation, business logic, UI, empty/loading/error states, and tests. A visible button must perform its advertised action.
4. Follow the testing rules in `doc/V2_BRIEF.md` section 11. Run only related tests while working. Run the full browser suite only when the phase prompt asks for it. If a check cannot run, state exactly what was blocked and the exact next command.
5. Do not hardcode dashboard numbers, fake successful saves, fake authentication, or use demo records as a real user's data.
6. Do not leave `TODO`, `FIXME`, "coming soon", disabled placeholder actions, or static mock screens.
7. Do not ask the user to make decisions that can be safely resolved from `doc/V2_BRIEF.md` or `PROJECT_SPEC.md`. Ask only for a genuine blocker, a destructive or irreversible choice, or when the phase prompt tells you to stop and ask.
8. Keep code focused and maintainable. Avoid needless abstractions, giant components, duplicate calculation logic, and unnecessary dependencies. Reuse the single financial domain layer for every screen and report.
9. Never use floating-point arithmetic for currency. Use integer paise for INR, and test rounding/formatting boundaries.
10. Never expose Supabase secret keys or other secrets in browser code. Enforce data ownership in the database, not only in UI filters.
11. Offline support must not silently lose or duplicate money entries. Keep stable client-generated transaction IDs/idempotency keys, visible sync state, and conflict handling.
12. Database: this repository uses the V2 Supabase project only. Never connect to or change the V1 project. Write migrations as files and report them; the user pushes them. Never reset the database or drop financial data.
13. Performance: follow `doc/V2_BRIEF.md` section 10. Report build size numbers at the end of each phase.
14. Everything must stay free of cost. Flag anything that would cost money before using it.
15. Maintain `PROGRESS.md` as durable project state: completed work, decisions, checks run with real results, known blockers, and the next concrete tasks. Update it at the end of every phase.
16. Do not use `--dangerously-skip-permissions` or bypass safety/permission prompts as a shortcut.

## Product/design standards
- Follow `doc/V2_BRIEF.md` section 9 and `doc/REDESIGN_V2.md` Part A.
- Premium, calm finance screens. Cinematic but restrained progression screens. Not a generic admin template, not a childish game, not a gacha game.
- Geist typography. Violet as a restrained identity colour. Light and dark themes.
- Responsive, accessible laptop and mobile layouts.
- Fast entry takes priority over decorative motion. Animations must be brief, meaningful, accessible, and respect reduced-motion preferences.
- INR (₹), Indian number formatting, and Asia/Kolkata timezone by default.
- Treat financial data as private. No automatic sharing with parents. No external AI transmission unless the user has opted in to the AI Analyst. No bank integration.

## Definition of done (per phase)
A phase is done when everything in its prompt is implemented and connected, the checks listed in the prompt were actually run and pass, `PROGRESS.md` is updated, and no known broken journey is hidden. Finish with a truthful report: what changed, commands actually run with real results, build size numbers, any migration the user must push, and any unresolved limitation.
