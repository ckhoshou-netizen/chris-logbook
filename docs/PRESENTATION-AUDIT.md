# Presentation audit — Road to the Stage

Completed locally on November 4, 2026. Source: `ckhoshou-netizen/chris-logbook`, base `191e0de`, local branch `audit/presentation-overhaul`.

The overhaul is implemented and runnable. It covers Nutrition, Training, Check-in, hourly food entries, search and portions, workout references, cardio, steps, weekly review, charts, settings and shared sheets. The audit was completed locally before publication. The user subsequently authorized publishing this release through the existing GitHub Pages workflow.

## Findings and changes

| Area | Finding | Implemented result |
| --- | --- | --- |
| Visual hierarchy | Most sections shared the same flat treatment; targets and actions competed for attention. | Summary cards, larger primary numbers, consistent spacing, clearer secondary text and a shared graphite/ice-blue palette. |
| Navigation | Large text buttons dominated the bottom bar; tabs always reset the page. | Labelled icons, a selected-state indicator beyond colour, independent scroll memory and a wider desktop layout. |
| Animation | Screens and sheets appeared abruptly. Full redraws also cut progress updates short. | Brief page entrances, sheet/backdrop transitions, touch feedback, toast entrances and progress scaling that resumes from the visible value through redraws. |
| State continuity | Saving replaced the screen and could collapse expanded content or lose keyboard focus. | Stable disclosure identities, preservation of open sections, and restoration of focused action controls and workout checkboxes. Native date fields are deliberately excluded from automatic focus restoration. |
| Food saving in WebKit | Blurring an amount field rewrote the Save button text even when unchanged; WebKit could drop the first tap. | Update that text node only when its label changes. A single-tap amount-and-save regression is included in the browser audit. |
| Reduced motion | The new sheet backdrop initially continued to fade after reduced motion was enabled. | Both CSS effects, including `::backdrop`, and JavaScript animations now respect reduced motion. Changing the preference also finishes active animations. |
| iPhone focus zoom | Smaller label typography would have inherited into editable fields. | Inputs, selects and text areas retain at least 16px text at the standard text setting; visible labels can remain secondary in size. |
| Small screens and enlarged text | Fixed columns risked overflow with larger text. | Reflowing macro, cardio-day and weekly comparison grids, wrapping calorie totals, and one scrollable sheet body with a fixed primary action. |
| Dates | Raw numeric dates and small picker icons were harder to scan and target. | Readable date labels, a full native-picker target, separate previous/next controls, and a year label when outside the current year. |
| Offline presentation | Installed theme colours and cached presentation assets needed to match the redesign. | Matching manifest/theme colours, preloaded local brand font and a new service-worker cache version. No external fonts, animation libraries or runtime services were added. |
| Local verification | The existing UI harness did not strip module imports after Windows CRLF checkout. | Normalise line endings before the VM test setup. The target-disclosure assertion also accepts presentation attributes while still checking that it starts closed. |

## Motion specification

| Interaction | Duration | Behaviour |
| --- | --- | --- |
| Enter a tab | 220 ms | 8px vertical entrance and opacity; ordinary saves do not replay the whole screen. |
| Progress update | 360 ms | Transform scaling, clamped to 0–100%; continues from the visible state through redraws. |
| Button press | 140 ms | Subtle scale and colour feedback. |
| Sheet | 240 ms transform / 180 ms opacity | Native dialog with discrete-transition support; older engines receive a 280 ms entrance fallback. |
| Backdrop fallback | 220 ms | Opacity only. |
| Toast | 200 ms | Short entrance above navigation. |
| Reduced motion | No animated transitions | Includes progress, pages, sheets, backdrops and toasts. |

Saves and cancellation execute immediately. No artificial wait, number counter, endless animation, blur filter or animation dependency was introduced. The existing numerical value is shown immediately; only the progress bar's visual scale interpolates.

## Validation

**101 existing automated tests pass.** They cover arithmetic, historical snapshots, target versions, food planning, exercise assignments and sets, cardio rollover, migrations, backup/restore and navigation. Syntax and whitespace checks also pass.

The repeatable browser audit uses Playwright 1.62.1 and synthetic records in isolated browser contexts. It does not load the published app or touch personal records.

| Engine | Passed | Environment-blocked | Failed |
| --- | ---: | ---: | ---: |
| Chromium / Edge | 17/17 | 0 | 0 |
| WebKit 26.5 on Windows | 16/17 | 1 | 0 |

Browser checks cover:

1. All three screens render, and viewing/navigation does not write records.
2. 320, 390, 430, 768 and 1440px layouts, including expanded weekly review, have no document overflow.
3. 200% text fits at 320px, including the expanded weekly review.
4. Each tab restores its own scroll position.
5. Keyboard workout completion preserves open exercises and checkbox focus.
6. Previous/next date arrows do not focus or reopen the native calendar.
7. Progress stays animated through save/broadcast redraws.
8. Hour → search → amount → save records the exact portion and hour with one Save tap.
9. Food deletion and Undo restore the original entry.
10. Cardio editing and Undo restore the original records and focused day.
11. The split editor has one scrolling body, a reachable footer, a working Tab loop and Escape cancellation.
12. Cancelling the exercise picker retains the unsaved split draft.
13. Reduced motion suppresses the actual running animations.
14. Editable controls maintain at least 16px text.
15. Empty views do not invent zero intake or records.
16. Offline launch, retained records, local font and Canadian food search work in Chromium.
17. No uncaught browser errors occur through the audit.

For WebKit, offline navigation fails internally in the Windows test browser before a document loads. That check is recorded as **environment-blocked**, not passed. Offline iPhone launch still needs a real-device check. The other 16 WebKit checks pass.

Measured route-start → next animation-frame timings over 18 synthetic-data tab changes:

| Engine | Median | Maximum |
| --- | ---: | ---: |
| Chromium / Edge | 15 ms | 20 ms |
| Windows WebKit | 44 ms | 48 ms |

These are desktop test observations with 28 days of synthetic weights, not a phone frame-rate guarantee or a before/after performance benchmark.

## Data and deployment

The domain calculations and storage module are unchanged. The schema remains v6. The hourly food timeline still contains all 24 hours; recorded and planned food remain separate. Earlier targets, dated workouts, saved check-ins, exports and the complete backup format retain their existing behaviour. The fixtures used for this review are not loaded by the app.

The app is a static local/offline web app. The optional browser audit is development tooling only. During the audit, the public GitHub Pages app and its records were not edited. Publishing updates app assets at the existing address; personal records remain in device storage. Records at `127.0.0.1:4173` are separate from records at the published address; moving real records still requires the existing complete JSON backup/restore process.

## Run and review

From the project folder, run `node scripts/serve.mjs`, then open `http://127.0.0.1:4173`. `npm start` runs the same preview. For the existing test suite, run `npm ci` then `npm test`, or `node --test tests/*.test.mjs` once dependencies are installed.

For the optional browser audit, install Playwright 1.62.1 as development tooling without changing the production dependency list (`npm install --no-save --package-lock=false playwright@1.62.1`), start the local preview and run `node scripts/audit-presentation.mjs`. It uses installed Edge by default. Set `BROWSER_ENGINE` to `webkit` after installing the Playwright WebKit browser to repeat the Safari-engine checks. Screenshots and JSON results are written to the ignored `audit-output/` folder. `PLAYWRIGHT_MODULE`, `AUDIT_URL` and `AUDIT_OUTPUT` are optional overrides.

Before publishing, the remaining practical checks are Safari and installed Home Screen use on the target iPhone: the real software keyboard, safe-area insets, native date picker, app reopening with retained records, and launch/search in Airplane Mode after the first online load. No claim of complete real-device or screen-reader certification is made by this desktop audit.
