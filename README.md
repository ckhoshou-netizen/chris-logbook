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

Add Food searches your own foods and 3,620 Canadian Nutrient File (2026) foods. Tap a result, enter the amount and tap Log Food. Recent foods reuse the last visible portion as a starting point. Date/time, source details, favourites and library editing are available under expandable options. New custom foods continue directly to their logging amount after saving. Future food remains planned until explicitly marked eaten.

The complete catalogue is bundled locally and cached for offline search. Only foods referenced by logs or favourites are retained in the structured device backup. Every diary entry contains its own nutrition/provenance snapshot. Schema v5 upgrades earlier backups, changes live Unfinished day labels to Completed, and preserves saved entries, target history, check-ins and exported snapshots. Earlier JSON backups remain readable.

For source selection, nutrient units, source energy, copyright notices, reproducible import commands and updating the catalogue, see [Food Data](docs/FOOD-DATA.md).

Food Day Status now offers Completed (default) and Untracked. Empty defaults do not count as zero intake or dilute averages; Record Zero Intake is an optional explicit confirmation. See [Day Status](docs/DAY-STATUS.md) for migration and historical-review behavior.

The usability pass places backup/restore first in Settings and weekly review before the weight chart; groups less-used workout actions; and keeps enlarged navigation clear of content and Undo.

Weekly Review uses one date control, a compact two-median comparison and a signed pound change. Weight windows, percentage change, intended loss, food/activity review and target editing stay available in expandable sections. The date chooser commits only a valid past Sunday, so an invalid draft cannot disagree with the displayed comparison. This layout update does not change stored records or saved reviews.

Check-in now starts with **Weight Goal**: enter the desired weight, choose a Sunday and review the calculated lb/week. The saved starting reference stays fixed until explicitly edited. Calories & Macros are in a separate expandable section and never change when a weight goal is saved. Schema v6 adds goal history while preserving older records and saved reviews; complete backups include it. See [Weight Goals](docs/WEIGHT-GOALS.md) for calculation, reference selection and historical-data behavior.

Nutrition uses one hourly food timeline, from 12 AM through 11 PM. Tap **+** beside an hour, choose a food, enter the amount and save. That hour carries through search, custom-food creation and Quick Add; Date & Logging Options still allows exact minutes. Existing entries retain their original times and nutrition snapshots. Future dates use the same timeline for planned food, which remains separate from recorded intake. This layout update does not change the data schema or existing records.

The Training cardio day row displays actual minutes logged on each date, including fractional minutes and multiple sessions. Zero means no performed minutes logged for that date. Planned sessions, day-coverage allocations and carried credit do not add daily performed minutes; coverage and credit remain available separately. Weekly targets, rollover, existing sessions and saved check-ins are unchanged.
