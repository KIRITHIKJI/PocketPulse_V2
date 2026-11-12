# PocketPulse — Redesign V2 (6 prompts for Claude Code)

How to use:
1. Save this file in the repo as `doc/REDESIGN_V2.md`.
2. Open a NEW Claude Code session for each prompt. Paste one prompt at a time, in this order: 1, 2, 3A, 3B, 4A, 4B.
3. When a prompt finishes, check the app yourself, then commit: `git add . && git commit -m "Redesign V2 - prompt N"`.
4. Only then start the next prompt.
5. Prompt 3A stops twice to ask you something (which emblem style, and whether Player status looks right). Answer honestly; this is where the look gets decided.

---

## PART A — Design direction (Claude Code reads this in every prompt)

### What the product should feel like
A finance app for an adult, with a progression system that is enjoyable but grown-up.

- Money screens: premium, calm, minimal. Like a high-end banking or investing app.
- Progression screens (Player status, Missions, Achievements, Rewards): cinematic, dark, immersive, but quiet and elegant. Think of the menu of a serious console RPG or the look of a luxury watch face: deep surfaces, fine lines, engraved-metal details, strong typography, lots of space.
- Both moods share one design system. Violet is the identity colour and is used sparingly.

### What it must NOT look like
Not a kids' game:
- No cartoon characters, mascots, stickers, emoji as decoration, bubbly shapes, bouncy animation, confetti showers, bright candy colours.

Not a free-to-play / gacha mobile game:
- No ornate gold-and-red frames, glowing loot, treasure chests, gems, coins raining, spinning rays behind items.
- No flashing "Claim" buttons, red notification dots on everything, daily login pop-ups, VIP tiers, countdown timers that pressure the user.
- No crowded HUD with many small icons around the screen edges.
- No anime-style art, no fantasy fonts, no fake shop.

Not a generic template:
- No page built only from identical rounded outlined boxes.
- No stock outline icons used as the main visual of a progression screen.
- No purple gradient on every card.

### What "gamified but adult" means here
- IMPORTANT: gamified does NOT mean more badges, more progress bars and more cards. That is how a generic game dashboard happens. Each progression screen has ONE dominant visual and fewer elements than it has today. The game feeling comes from composition, artwork, typography and a few well-placed moments, not from quantity.
- Rank emblems and achievement badges are custom SVG drawn in code: geometric, precise, mostly monochrome with a muted metallic tone (steel, graphite, soft silver, a little warm bronze), with violet only as a small accent. Higher ranks add detail and layers, not more colour.
- Typography does a lot of the work: big rank names, small uppercase labels with letter spacing, tabular numbers.
- Depth comes from layered dark surfaces, a soft light behind the main object, a faint pattern and thin 1px highlights. No heavy glow, no glassmorphism.
- Motion is short and rare: the XP arc filling, an emblem revealing once on level-up, a mission getting a quiet "completed" mark. Always respect reduced motion. Never block expense entry.
- Copy is calm and adult. One short helper line at most per card. Move long explanations behind an info icon.

### Gaps found in the current app (from screenshots, 11 Nov 2026)
1. Sidebar: about 22 links in two columns under 7 headings. Quick add / Type it / Say it / Full form are four links for one job. The four Progress links are repeated as tabs on the page.
2. Home: Safe to Spend is a small card at the bottom right. 13 quick-add tiles, each with a pencil icon and "Set amount". The level shows twice (sidebar and right column). Every block is the same outlined box.
3. Player status: a "1" in a small square, one progress bar, three boxes showing 0, an empty Milestones box. It reads like a settings page.
4. Missions: three columns of checklists with text buttons ("Quick add", "Skip"). It reads like a to-do list. The XP reward is tiny corner text.
5. Wallets and other money screens: clear but generic, wide empty space, long helper sentences under numbers.
6. Whole app: one box style, thin stock icons, a disclaimer line on almost every card.

### Rules for every prompt
1. Read `CLAUDE.md`, `PROGRESS.md`, `doc/REDESIGN_BRIEF.md`, `doc/DESIGN_PLAN.md` and Part A of this file before changing anything. Inspect the real code for the screens you will touch.
2. This is a visual and layout redesign. Do not change financial logic, the domain layer, XP/reward rules, API contracts or the database schema. Every number on screen keeps coming from the existing domain functions; never recalculate money in a component. If you believe a schema change is truly needed, stop and ask. Never run `db push` yourself.
3. Keep every existing route and URL working. Keep every feature reachable. Do not hide any financial tool behind a level.
4. Keep the existing confirmation dialogs and Undo behaviour.
5. No fake buttons, no static mockups, no hardcoded numbers. Everything shows real data, including honest empty states.
6. Both dark and light themes must look deliberate. On progression screens in light theme, use a deep-toned header band rather than forcing the whole page dark.
7. Accessibility stays: contrast, keyboard navigation, focus rings, labels, 44px touch targets, reduced motion.
8. Everything must stay free: no paid fonts, icon packs, image services or libraries. Draw emblems and badges as SVG components in code.
9. If a change breaks an e2e test because a label or selector moved, update the test to match the new UI. Never delete or weaken a test.
10. While working, run only related tests. At the end run lint, typecheck, unit tests and the production build. Run the full e2e suite only where the prompt says so.
11. Do the "Screen review" below for every screen you change. A screen is not finished until it passes.
12. Update `PROGRESS.md` at the end. Finish with: what changed, commands actually run with results, anything not done. Do not start the next prompt.

### Screen review (required for every changed screen)
Before coding a screen: write 5–8 lines in `doc/DESIGN_PLAN.md` describing its composition: what the one dominant element is, what is secondary, what was removed or moved, and how it differs from the old version.

After coding: take screenshots at 1440px and 375px, in dark and light. Open and look at each image. Then answer these questions in writing:
1. Is there exactly one dominant element, visible in the first second?
2. How many bordered boxes are visible at once? More than three on a desktop screen means the layout is still a card grid: redo it.
3. If the logo were removed, could this be any template app? If yes, say what is missing and add it.
4. Is anything from "What it must NOT look like" present?
5. Does it use the same tokens, type scale and spacing as the screens already finished? Put it next to one of them and compare.
6. Is the 375px version designed for a phone, or a shrunk desktop page? Is light theme deliberate?

Fix what fails, take new screenshots, and check again. Do at least one fix round per screen; "it passed first time" is not accepted. Record the answers and the fixes briefly in `PROGRESS.md`.

---

## PART B — The prompts

### Prompt 1 — Design system and navigation

```
Read CLAUDE.md, PROGRESS.md, doc/REDESIGN_BRIEF.md, doc/DESIGN_PLAN.md and doc/REDESIGN_V2.md (Part A fully; in Part B only "Prompt 1"). Follow the "Rules for every prompt" and the "Screen review" in Part A. This is Prompt 1 of 6. Do only Prompt 1.

Goal: build the shared design foundation and fix the overwhelming navigation. Do not redesign individual pages yet, except what is needed so they still work with the new shell. Do not create rank emblems or badges yet; that is Prompt 3A.

1. Design tokens
- Review the current tokens. Extend them into two surface families in one system: "finance" (calm, flat, minimal) and "progression" (deeper, layered, cinematic). Add tokens for the muted metallic tones, the 1px highlight line, the background light/pattern, and a small set of elevation levels.
- Reduce violet use: it stays for the primary action, the active nav item and small accents. Remove violet gradients from ordinary cards.
- Typography scale with clear steps: page title, hero number, section title, body, small uppercase label. Money always uses tabular numbers. Keep Geist.

2. Layout primitives (reusable, used by all later prompts)
- Hero area, plain section with a divider (no box), compact panel, stat row, data list row, page header with tabs.
- Rule for the whole redesign: a box with a border is used only when the content really is a separate object. Sections on a page are separated by space and dividers, not by more boxes.

3. Desktop sidebar
- One column, 8 links, no group headings: Home, Transactions, Insights, Plan, Player, Reports, Manage, Settings.
- One "Add expense" button. It opens the existing entry choice (Quick add, Type it, Say it, Full form). Remove those four from the sidebar links.
- Hubs use the page-header tabs:
  - Insights: Insights, Money leaks
  - Plan: Budgets, Savings goals, Safe to spend, Survival mode
  - Player: Player status, Missions, Achievements, Rewards
  - Manage: Wallets, Categories, Income & recurring, Reminders
- All existing URLs keep working. The hub link opens the first tab. The active state stays correct on every sub-page.
- The level widget in the sidebar becomes one slim line (the existing level mark, level, thin XP bar) that links to Player. It must be readable on 1366x768 and 1440x900 without the sidebar scrolling.

4. Mobile navigation
- Keep the 5 bottom tabs and the fast Add button. Make sure Player, Manage and Settings are reachable in at most two taps (for example from the header and from a level strip on Home).
- Sub-pages of a hub use the same tabs, scrollable sideways on small screens.

5. Copy clean-up (global)
- Find the repeated disclaimer/helper lines on cards. Keep the meaning the spec requires (for example that a tracked balance is not a verified bank balance, and that a budget is a target), but show it once per page in a short line or behind an info icon, not on every card.

Do the Screen review for the app shell (sidebar, header, mobile nav) on three different pages. Checks: related e2e tests for navigation, then lint, typecheck, unit tests, production build. Update PROGRESS.md. Report and stop.
```

---

### Prompt 2 — Home

```
Read CLAUDE.md, PROGRESS.md, doc/DESIGN_PLAN.md and doc/REDESIGN_V2.md (Part A fully; in Part B only "Prompt 2"). Follow the "Rules for every prompt" and the "Screen review". This is Prompt 2 of 6. Do only Prompt 2. Use the tokens and layout primitives from Prompt 1; do not create a second set.

Goal: Home becomes a premium "financial command centre" with an obvious hierarchy. Finance first, progression present but small.

1. Hero (top, full width, no ordinary card look)
- Two primary numbers side by side: Tracked balance, and Safe to Spend (daily amount when it can be calculated). Large tabular numbers, small uppercase labels with the scope ("all wallets · now").
- Safe to Spend uses the existing domain function and its existing explanation, unchanged. Only the placement and styling change. Link the number to the Safe to spend page where the inputs are shown.
- When the next income date is missing, the Safe to Spend side shows an honest prompt with one action to add the date. Never invent a number.
- Under them, one quiet row: Spent today, Spent this month, and month budget progress as a thin bar.
- The "not a bank balance" note appears once, small, with an info icon.

2. Quick add
- Show the 6 most used tiles (fall back to the user's order when there is no history), plus a "More" tile that reveals the rest.
- Remove the pencil icon from every tile. "Edit tiles" switches to an edit mode where amounts and tiles can be changed.
- A tile without a saved amount shows just its name; tapping it asks for the amount. Remove the "Set amount" text.
- One-tap save and Undo must work exactly as now. Type it and Say it stay next to this section.

3. Recent activity
- A plain list section (rows with dividers, not a box per row): last 5 entries, link to Transactions. Real empty state.

4. Side column (desktop) / below (mobile)
- Budget and savings goals as compact panels with a thin progress bar and one line of text each.
- One slim player strip: the existing level mark, level, XP to next level, streak count. It links to Player. The level must not appear a second time on this page.

5. Mobile
- Order: hero, quick add, recent activity, budget, goals, player strip. Hero numbers stay large and readable at 375px. Quick add is reachable with the thumb.

6. Motion
- Balance number transition and the new-entry feedback stay short and subtle. Nothing full-screen.

Do the Screen review for Home with data and for a new empty account. Checks: the Journey A e2e test (quick-add) at mobile and desktop widths and any Home-related tests, then lint, typecheck, unit tests, production build. Update PROGRESS.md. Report and stop.
```

---

### Prompt 3A — Rank emblems and Player status (stops twice for my approval)

```
Read CLAUDE.md, PROGRESS.md, doc/DESIGN_PLAN.md and doc/REDESIGN_V2.md (Part A fully; in Part B only "Prompt 3A"). Follow the "Rules for every prompt" and the "Screen review". This is Prompt 3A of 6. Do only Prompt 3A. Use the "progression" tokens from Prompt 1.

Goal: create the visual language of the progression side and prove it on ONE screen, Player status. Read "What it must NOT look like" and the IMPORTANT line under "What gamified but adult means" again before starting. Do not change XP, level, streak or achievement rules.

STEP 1 — Emblem directions, then STOP
- Design three clearly different RankEmblem style directions as SVG drawn in code. For each, draw the first rank, a middle rank and the top rank, so I can see how it grows.
- All three: geometric, precise, engraved-metal feel, mostly monochrome with a small violet accent, readable at 24px and at 240px. Higher ranks add layers and detail, not colours. Examples of directions (use your own judgment): faceted shield or crest; concentric rings like a watch bezel or a coin; angular monogram/sigil built from the pulse line in the logo.
- Show them on a temporary dev-only page on the progression background, take a screenshot, show it to me, say which one you recommend and why, and WAIT for my choice. Remove the temporary page afterwards.

STEP 2 — Build the chosen system
- RankEmblem component (rank/level, sizes 24–240px) and AchievementBadge component (rarity, locked/unlocked) in the chosen style. Locked is a dim outline.
- Replace the level mark in the sidebar line and in the Home player strip with the small RankEmblem.

STEP 3 — Player status, composed like a character profile
Composition (this matters more than the list of parts):
- The header is not a card. It runs edge to edge of the content area and takes about 60% of the first screen on desktop.
- The emblem (about 220–260px on desktop) is the single brightest object on the page. Everything else is lower contrast.
- Depth behind it, in three layers: the near-black base; one large, very soft light directly behind the emblem; a faint fine pattern (for example concentric contour rings or a grid) that fades out toward the edges, with the corners slightly darker. No glow effects on the emblem itself.
- XP is a thin ring (3–4px) concentric with the emblem, with a small gap between them. It starts at 12 o'clock, has a faint track, small tick marks at each quarter, and a violet fill. This ring is the only strong violet on the page.
- Beside or under the emblem: a small uppercase spaced label ("RANK"), the rank name very large (about 48–64px on desktop), then one line "Level 1 · 20 / 100 XP" in tabular numbers.
- Rank path directly under the header: a thin horizontal line with a small emblem at each rank. Reached ranks are filled, the current one is highlighted, future ones are dim outlines with the XP needed. The page is therefore never empty at level 1.
- Above the fold there are only these: emblem, ring, rank name, level line, rank path. Nothing else.
Below the fold:
- Habit stats in one quiet row with dividers (current streak, longest streak, lifetime XP, days logged). No boxes. One short calm line about streaks.
- Achievement showcase: the latest unlocked badges, or the three closest to unlocking with progress.
- History: a simple timeline of levels and achievements with dates. Honest empty state.
Mobile (375px): emblem about 120–140px with the ring, rank name under it, rank path scrolls sideways. Light theme: deep-toned header band.
Motion: on page open the ring fills once, quickly. Nothing loops.

STEP 4 — Review, then STOP
- Do the Screen review for Player status with a level 1 account and with an account that has progress. Do at least two fix rounds.
- Show me the final screenshots (desktop and mobile, dark and light) and WAIT for my approval or change requests before finishing.

Checks: related tests, lint, typecheck, unit tests, production build. In PROGRESS.md record the chosen emblem direction and a short "progression visual language" note (background layers, ring, type sizes, spacing) that Prompt 3B must follow. Report and stop.
```

---

### Prompt 3B — Missions, Achievements, Rewards and feedback moments

```
Read CLAUDE.md, PROGRESS.md (especially the "progression visual language" note), doc/DESIGN_PLAN.md and doc/REDESIGN_V2.md (Part A fully; in Part B only "Prompt 3B"). Follow the "Rules for every prompt" and the "Screen review". This is Prompt 3B of 6. Do only Prompt 3B. Open the finished Player status screen first and match its language exactly; these three screens must look like its siblings. Do not change mission, achievement or reward rules.

1. Missions — a quest journal, not a task list
Composition:
- No checkbox circles and no grid of equal columns.
- Top: one "current objective", the active mission closest to completion, shown large with its emblem-style glyph, title, progress and reward. This is the dominant element.
- Below: the other missions as compact journal rows joined by a thin vertical rail on the left, like entries in a log. Each row: a small glyph in an engraved frame, title, one line of description, progress, and the reward as a clear engraved tag on the right ("+20 XP").
- One main action per mission. "Skip" lives in a small overflow menu.
- Three states that look clearly different: active (full contrast), completed (dimmed, with a small engraved seal), not started (outlined).
- Daily, Weekly, Long-term as tabs or clear sections with "x of y done" and the reset time as small text. On desktop: a main column plus a narrow summary column.
- No pressure wording, no countdown timers.

2. Achievements — a collection worth looking at
Composition:
- Large badges (about 96px or more), few per row (about 4 on desktop, 2 on mobile), generous space around each, the name under it in a small label. No descriptions in the grid.
- Rarity is shown by material and amount of detail, not by bright colour. Locked badges are dim outlines.
- Grouped into sets with a small heading and "x of y". A total counter at the top is the page's main number.
- Opening a badge shows it large with its description, date earned or progress to unlock.

3. Rewards — an inventory
- Clear categories, owned / not yet owned states, a short description for each. Same calm collection feel as Achievements. It must not look like a shop: no prices, no "buy", no flashing "claim".

4. Feedback moments
- Level up and achievement unlock: one short, elegant reveal of the emblem or badge (under about 1.5 seconds, dismissible, off with reduced motion). No confetti showers, no stacking pop-ups.
- Normal XP gains show as a small quiet "+5 XP" near the level strip.

5. Mobile and light theme
- Each screen keeps its dominant element at 375px. Light theme uses the same deep-toned header band as Player status.

Do the Screen review for all three screens, each compared side by side with Player status. Checks: related unit and e2e tests for rewards, missions and achievements, then lint, typecheck, unit tests, production build. Update PROGRESS.md. Report and stop.
```

---

### Prompt 4A — Insights and Plan screens

```
Read CLAUDE.md, PROGRESS.md, doc/DESIGN_PLAN.md and doc/REDESIGN_V2.md (Part A fully; in Part B only "Prompt 4A"). Follow the "Rules for every prompt" and the "Screen review". This is Prompt 4A of 6. Do only Prompt 4A. Use the "finance" tokens and layout primitives from Prompt 1, and open the finished Home screen first so these screens match it.

Screens: Insights, Money leaks, Budgets, Savings goals, Safe to spend, Survival mode.

For each one:
- Give it a layout that fits its job. Do not reuse one template for all.
- One clear main number or main visual at the top. Stronger numbers, shorter helper text.
- Replace box-inside-box layouts with sections, dividers and data rows. Use the page width well on desktop.
- Keep every function, filter, dialog and drill-down exactly as it works now. All numbers still come from the domain layer.

Specific notes:
- Insights and Money leaks: fewer, sharper charts with restrained colours; one plain-language observation near each chart; honest sparse-data states.
- Budgets and Savings goals: progress is the hero; "target, not reserved money" appears once per page. The goal-completion moment uses the same quiet reveal style as Prompt 3B.
- Safe to spend and Survival mode: the result is the hero; the inputs and explanation sit below in a calm breakdown. Missing next-income date is handled honestly.

Do the Screen review for all six screens. Checks: related tests including Journeys C, D and E, then lint, typecheck, unit tests, production build. Update PROGRESS.md. Report and stop.
```

---

### Prompt 4B — Remaining screens, mobile pass and final QA

```
Read CLAUDE.md, PROGRESS.md, doc/DESIGN_PLAN.md and doc/REDESIGN_V2.md (Part A fully; in Part B only "Prompt 4B"). Follow the "Rules for every prompt" and the "Screen review". This is Prompt 4B of 6, the last one.

1. Screens: Transactions, Wallets, Categories, Income & recurring, Parent report, Reminders, Settings, onboarding and the auth pages.
Same approach as Prompt 4A: a layout that fits each job, one clear main element, sections and rows instead of nested boxes, shorter helper text, all functions unchanged.
- Transactions: day-grouped list; cards on mobile, table on desktop.
- Wallets: total as the hero, wallets as rows or compact panels that use the width.
- Parent report: the on-screen preview should look like the printed report. PDF/CSV exports unchanged.
Do the Screen review for each.

2. Mobile pass over the whole app at 375px and 414px: nothing is a shrunk desktop layout, tabs scroll sideways, charts and tables are readable, touch targets are 44px.

3. Consistency pass: look at every screen in dark and light, one after another, for leftover old box styles, repeated disclaimers, stock icons used as main visuals on progression screens, violet overuse, and uneven spacing or type sizes. Fix them. The app must feel like one product, not pages made separately.

4. Compare the result with "What it must NOT look like" in Part A and with the six gaps listed there. Write a short honest note in PROGRESS.md for each gap: fixed, partly fixed, or not fixed and why.

5. Final checks, each run once after the work is done: lint, typecheck, unit tests, DB tests, the FULL e2e suite in one run, production build. Fix real failures at the root cause (no added timeouts to hide them) and repeat until one clean full run passes.

Final report: what changed in each prompt, commands actually run with results, screenshots list, known limitations. Do not claim anything you did not verify.
```

---

## After each prompt, check these yourself
1. Open the app on laptop and phone. Does it feel like an adult product?
2. Add one expense with Quick add. Is it still one tap, with Undo?
3. Click every sidebar link and every tab. Does each page still work?
4. Switch light and dark. Does anything look broken?
5. If something looks childish, flashy or template-like, tell Claude Code exactly which screen and which part before committing.
