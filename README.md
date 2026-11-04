# Chris’ Logbook

An independent iPhone Home Screen web app. It requires no ChatGPT subscription, ChatGPT login, paid AI API or server database.

## Hosting

This repository is prepared for GitHub Pages on the main branch. Enable Pages with GitHub Actions as the build source; the workflow publishes only app/. Public app files and repository code contain no personal records or credentials. Hosting remains subject to GitHub's current plan terms and usage limits. The app is served at https://ckhoshou-netizen.github.io/chris-logbook/. Changes pushed to main are published by the included workflow.

## iPhone setup after publication

Open the confirmed Pages URL in Safari, tap Share → Add to Home Screen, and open the app from its new icon. Use that stable address/icon for records.

## Move existing records safely

Before changing addresses, open your existing installed logbook and use Settings → Create Complete JSON Backup. Save that file in Files. Open the independent app from its new Home Screen icon, use Settings → Restore JSON Backup, review the file and choose Replace or Merge explicitly. Verify foods, quantities, weights, targets, food plans, exercises, checkmarks, cardio balances and Sunday snapshots. Do not clear the old app or browser data until the new copy is verified.

Personal records live in device IndexedDB, not GitHub or ChatGPT. Keep complete JSON backups in Files; losing the phone or clearing website data may require restoring a backup. Safari and Home Screen storage can differ.

The app code has been checked for relative asset URLs and remote API/key dependencies. Actual iPhone installation and storage behavior must be verified on the target phone. This is an installable web app; a native App Store release is outside the current build.

## Development checks

Run `npm ci` then `npm test` with Node.js 22 or later. Tests use synthetic records and check calculations, immutable history, storage migrations, backup/restore, food planning, exercise assignments, cardio rollover and saved weight comparisons. GitHub Pages serves app/ directly; no build tool or runtime service is required.
