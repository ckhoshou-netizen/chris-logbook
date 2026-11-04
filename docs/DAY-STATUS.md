# Food Day Status: two choices

User decision: **Completed** and **Untracked**, with **Completed as the default**. This supersedes the previous three-status interface.

The internal value `Complete` remains for compatibility; the interface says Completed. Live records accept only `Complete` and `Untracked`. A missing status defaults to Completed. Future food remains planned, is not eligible for actual intake totals, and has no day-status selector.

## Empty days and averages

An empty default Completed day displays unavailable intake rather than claiming zero. It is excluded from calorie/macro averages until food has been logged or the user explicitly confirms zero intake through Record Zero Intake. This is an optional action, not an extra step required for ordinary logging or the status default.

Live reviews show Completed/Untracked counts out of seven, and separately show the denominator and exact dates of Completed days with recorded intake. They disclose the count of empty Completed days excluded from averages. Untracked days retain entries and weigh-ins, and never enter intake averages. Weight eligibility, targets, training, cardio and steps remain independent of food status.

Adding food on an Untracked day leaves that explicit choice in place. Deleting the final food entry leaves Completed selected, makes intake unavailable again, and does not create a third status. Undo restores the original entry once. An earlier zero-intake confirmation is cleared when actual food is logged.

## Migration and saved history

Schema/database v5 accepts older exports and safely upgrades v1–v4. Existing explicit Unfinished labels become Completed in **live** diary records, as disclosed during this change. Explicit Complete and Untracked records retain their status. Explicit old Complete days with no entries retain the prior zero-intake confirmation. Other record IDs, quantities, nutrition snapshots, weights, target versions, exercise assignments, activity records and settings are retained.

Saved check-ins and exported snapshots are not rewritten. The validator and text formatter continue to read `chris-v1` reviews with their original three statuses, counts and denominator. New snapshots use `chris-v2-day-status`, two statuses and explicit intake availability. Revising a check-in creates a new version and retains the old one.

Automatic storage upgrade is transactional; validation failures abort it without replacing existing data. Full backup/restore tests include both CNF editions and both check-in calculation versions.
