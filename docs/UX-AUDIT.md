# Mobile usability audit — 4 November 2026

Audited Nutrition, Training, Check-in, their editors, and backup/restore using synthetic data. The existing dark surfaces, baby-blue accent, body font and three tabs remain the visual system.

## Changes

| Flow | Previous friction | Updated flow |
| --- | --- | --- |
| Repeat food | Open search, choose a food, review the same quantity and save each item | Open search once; tap **+** beside each displayed recent portion; tap Done when finished. Tap the food name when an amount needs changing. |
| Mark planned food eaten | Open an amount form and confirm an unchanged portion | **Mark Eaten** records the displayed portion immediately, with Undo. Tap the entry first to change its amount. Future food remains planned. |
| Edit logged food | Find the separate Edit action | Tap the food entry itself. Copy and Delete remain under More. |
| Change dates | Open a separate form, choose a date, then press View | Native date controls commit the choice directly. Arrows move by a day, or a week on Training. Today returns to the current date. |
| Save long forms | Scroll past additional options to reach Save | Primary form actions stay in the sheet footer. The content has one scroll area; the header remains visible. Settings keeps its Save action with its optional preferences. |
| Log weight or steps | Open the editor, locate/focus the input and scroll to Save | Open the editor, type in the automatically selected input and save. Date/unit controls are expandable. |
| Edit targets | Navigate to another tab or open unrelated fields | Tap the calorie, weekly cardio or daily step target to open its own editor. Effective dates and prior versions are retained. |
| Move a workout | More → Move Date → choose a date → Save | Use **Move** beside the workout and choose its date directly, within the same week. |
| Create an assigned exercise | Leave selection, open the library, add an exercise, return and select it | Search in Choose Exercises; **Create & Add** saves the new library exercise and returns it to the same workout draft. Other selections and set counts stay intact. |
| Copy a saved check-in | Open the saved report, then Copy | **Copy Check-in** is available directly in Weekly Review once a check-in is saved. It copies the frozen saved version. |

Actions are reduced where no additional decision is needed. For example, recording an unchanged planned food takes one app action instead of two; copying a saved check-in takes one instead of two. Logging N repeat foods from Nutrition takes N+2 actions (open, N additions, Done) instead of 3N. Typing and native picker interactions are excluded from those counts.

Cardio retains the previously simplified tap-day → Minutes → Update flow, including future dates counting immediately. Exercise set counts remain optional, and workout completion remains one checkmark.

## Data safeguards

- Food shortcuts use the newest known portion and the current food profile. Existing entries and plans retain their own nutrition snapshots. Unknown unit conversions do not get a shortcut.
- Repeating food on a future date creates planned intake. Mark Eaten uses the plan's saved snapshot and cannot record future food early.
- The new food actions offer Undo. Undo restores/removes exactly one original record and refuses to overwrite an intervening edit. Explicit zero-intake status is restored when applicable. An in-sheet Undo remains reachable while food search is open.
- Rapid repeat activation is guarded while an addition or confirmation is saving. Forms retain their submission guard.
- Weight references, macro overrides, target versions, dated training completion and saved check-ins are preserved. Opening screens does not rewrite records. Viewing future cardio uses that date's target without transferring surplus from an open week.
- Restore still validates the whole backup and requires an explicit Merge/Replace choice and confirmation. Empty-day zero-intake confirmation is retained.
- No schema migration, remote database, new service or personal-data upload is introduced.

## Verification

`npm test` covers calculations, storage upgrades, historical snapshots and complete backup/restore. Additional regression fixtures cover repeat-food scaling, future planning, one-tap confirmation, Undo conflicts, explicit zero intake and future target dates.

The browser walkthrough exercised food addition/editing/planning, custom foods, quick add, target edits, fractional/future cardio, steps, workout movement/completion, inline exercise creation, weight editing, saved-report copy, date validation, clean-store JSON restore and offline reopen. It compared every restored collection with the exported backup and checked that older plans, check-ins and exports stayed unchanged.

Responsive checks used 320, 390 and 430 px widths, normal/200% text, and a 460 px keyboard-sized viewport. Controls retain visible focus, new buttons have at least 44 px tap height, primary form actions stay reachable, and closing a sheet restores the page position and action focus. These are automated Chromium checks with touch emulation; actual iPhone Safari/Home Screen behavior still needs Chris's device verification.

## iPhone date-picker correction — 5 November 2026

Day/week arrows now update the selected date without programmatically focusing the native date input, which was opening its calendar on iPhone. The calendar remains available by tapping the date itself. Selecting a date no longer refocuses and reopens the picker. Regression tests cover both directions on Nutrition, Training and Check-in, including calendar stepping across the daylight-saving boundary and unchanged stored records.
