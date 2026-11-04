# Road to the Stage

An independent iPhone Home Screen web app. It requires no ChatGPT subscription, ChatGPT login, paid AI API or server database.

## Hosting

This repository is prepared for GitHub Pages on the main branch. Enable Pages with GitHub Actions as the build source; the workflow publishes only app/. Public app files and repository code contain no personal records or credentials. Hosting remains subject to GitHub's current plan terms and usage limits. The app is served at https://ckhoshou-netizen.github.io/chris-logbook/. Changes pushed to main are published by the included workflow.

## iPhone setup after publication

Open the confirmed Pages URL in Safari, tap Share → Add to Home Screen, and open the app from its new icon. Use that stable address/icon for records.

## Move existing records safely

Before changing addresses, open your existing installed logbook and use Settings → Create Complete JSON Backup. Save that file in Files. Open the independent app from its new Home Screen icon, use Settings → Restore JSON Backup, review the file and choose Replace or Merge explicitly. Verify foods, quantities, weights, targets, food plans, exercises, checkmarks, cardio balances and Sunday snapshots. Do not clear the old app or browser data until the new copy is verified.

Personal records live in device IndexedDB, not GitHub or ChatGPT. Keep complete JSON backups in Files; losing the phone or clearing website data may require restoring a backup. Safari and Home Screen storage can differ.

The app code has been checked for relative asset URLs and remote API/key dependencies. Actual iPhone installation and storage behavior must be verified on the target phone. This is an installable web app; a native App Store release is outside the current build.

## Navigation

Nutrition contains the food diary and food planning. Training contains the workout split, exercise library, cardio and steps. Check-in contains daily weights, weight trends, current goals and the weekly Sunday review. Existing Today, Trends and Sunday links still open the corresponding destination. This navigation update does not change the database schema, records or saved snapshots.

## Development checks

Run `npm ci` then `npm test` with Node.js 22 or later. Tests use synthetic records and check calculations, immutable history, storage migrations, backup/restore, food planning, exercise assignments, cardio rollover and saved weight comparisons. GitHub Pages serves app/ directly; no build tool or runtime service is required.

The app title uses Barlow Condensed Bold Italic, bundled locally under the SIL Open Font License (see app/fonts/OFL-BarlowCondensed.txt). Body text and controls use the system font.

## Food logging and Canadian foods

Add Food searches your own foods and 3,620 Canadian Nutrient File (2026) foods. Tap a result to change its amount, or tap **+** beside a previously used food to log the displayed portion immediately. Search stays open for adding multiple repeat foods, with Undo available inside the sheet. Date/time, source details, favourites and library editing are available under expandable options. New custom foods continue directly to their logging amount after saving. Future food remains planned until explicitly marked eaten; Mark Eaten now records its saved amount directly, with Undo.

The complete catalogue is bundled locally and cached for offline search. Only foods referenced by logs or favourites are retained in the structured device backup. Every diary entry contains its own nutrition/provenance snapshot. Schema v5 upgrades earlier backups, changes live Unfinished day labels to Completed, and preserves saved entries, target history, check-ins and exported snapshots. Earlier JSON backups remain readable.

For source selection, nutrient units, source energy, copyright notices, reproducible import commands and updating the catalogue, see [Food Data](docs/FOOD-DATA.md).

Food Day Status now offers Completed (default) and Untracked. Empty defaults do not count as zero intake or dilute averages; Record Zero Intake is an optional explicit confirmation. See [Day Status](docs/DAY-STATUS.md) for migration and historical-review behavior.

The usability pass places backup/restore first in Settings and weekly review before the weight chart; groups less-used workout actions; and keeps enlarged navigation clear of content and Undo.

Weekly Review uses one date control, a compact two-median comparison and a signed pound change. Weight windows, percentage change, intended loss, food/activity review and target editing stay available in expandable sections. The date chooser commits only a valid past Sunday, so an invalid draft cannot disagree with the displayed comparison. This layout update does not change stored records or saved reviews.

Check-in now starts with **Weight Goal**: enter the desired weight, choose a Sunday and review the calculated lb/week. The saved starting reference stays fixed until explicitly edited. Calories & Macros are in a separate expandable section and never change when a weight goal is saved. Schema v6 adds goal history while preserving older records and saved reviews; complete backups include it. See [Weight Goals](docs/WEIGHT-GOALS.md) for calculation, reference selection and historical-data behavior.

Nutrition uses one hourly food timeline, from 12 AM through 11 PM. Tap **+** beside an hour, choose a food, enter the amount and save. That hour carries through search, custom-food creation and Quick Add; Date & Logging Options still allows exact minutes. Existing entries retain their original times and nutrition snapshots. Future dates use the same timeline for planned food, which remains separate from recorded intake. This layout update does not change the data schema or existing records.

Training cardio uses direct daily editing: tap a day, change its Minutes total, and tap Update. There are no session, planning or coverage controls on the card. Zero clears that day's saved minutes, with Undo available for ten seconds. Future days use the same editor, and their saved amounts count toward that week immediately. No later confirmation is required. Weekly progress includes rollover, with carried minutes labelled separately from the daily numbers.

Edit Split opens a compact list of workouts; expand one workout to change its name, weekday and ordered exercises. Choose Exercises provides searchable multi-selection and returns to the same draft. Cancel in that picker leaves prior selections intact. Exercise options hold reordering/removal, and workout removal has Undo. Applies From keeps the effective date visible while its editor stays expandable. Saving still appends a schedule version and preserves earlier checkmarks and snapshots.

Applying an exercise selection sorts that workout's exercises alphabetically, matching the picker and ignoring letter case. Numbered names use natural order (Exercise 2 before Exercise 10). Move Up/Down remains available afterward. Viewing existing splits does not reorder saved schedules or historical checkmarks.

Sheets use one scrollable content area with a fixed header and primary form action. The background page is locked only while the sheet is open and restored afterward. Reordering retains the current scroll position, controls use sheet-specific focus spacing, and viewport resizing keeps the footer reachable. No storage schema changes are required.

Daily cardio edits replace the aggregate total rather than add another copy. All saved dates count immediately, including future dates and amounts saved by older versions. If legacy records include both logged entries and planned copies on one date, logged entries take precedence to avoid counting duplicate plans. A day containing only older planned entries counts its saved amount. Increases update the newest relevant entry; decreases reduce newest entries first and reconcile dependent credits. Zero clears the selected day; Undo restores its original records unless newer edits conflict.

Cardio uses calculation version `saved-minutes-v2`. Weekly totals count entered minutes regardless of calendar date, and calendar rollover still transfers only from closed weeks. Check-in exports label new totals as entered minutes. Existing `surplus-v1` and older saved check-ins and exported text retain their original values and calculation rules. The storage schema is unchanged, and no records are rewritten merely by opening the app.

Each exercise assigned to a split can have its own optional whole-number Sets count. Existing exercises start unset; adding one does not invent a count. Counts remain attached to the exercise through alphabetical selection, reordering and split/library navigation. They are displayed in workout references and coaching check-in exports, and preserved in schedule versions, dated workout snapshots, complete JSON backup/restore and training CSV exports. Renaming an exercise does not change its counts; completed workouts and saved check-ins retain their original counts. No reps, load, per-set completion or exercise performance fields are added. This is an optional assignment field and needs no rewrite of older records.

The mobile usability audit adds direct date navigation, tappable food/weight entries and targets, focused numeric editors, in-picker exercise creation, direct workout date changes and copying saved check-ins from Weekly Review. See [UX Audit](docs/UX-AUDIT.md) for the reviewed flows, reduced action counts, safeguards and validation.
