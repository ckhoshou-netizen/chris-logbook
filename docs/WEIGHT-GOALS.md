# Weight goals

In Check-in, tap **Set Weight Goal**, enter pounds, choose a future Sunday and save. The form shows the required loss in lb/week before saving. Goal weight and Target Sunday are the two regular inputs. Starting Weight opens only when no usable Sunday reference is available, or when the user chooses to change it. Calories and macros remain separately editable in Check-in.

The calculation is `(starting weight − goal weight) / number of Sunday intervals`. A 132 lb reference on November 1, 2026 and a 126 lb goal for December 13, 2026 span six intervals and produce exactly 1 lb/week. At 135.8 lb and a 130 lb goal, the full-precision rate is `(135.8 − 130) / 6`, displayed as 0.97 lb/week. Equal weights produce zero. Goal weights above the reference are rejected because this feature calculates a weight-loss rate.

Dates must be Sundays and the target must follow the starting date and be in the future when saved. Calendar-date arithmetic uses UTC noon to count whole Sunday intervals, including daylight-saving changes; local diary dates still follow the configured timezone. The picker offers the next 104 Sundays and retains an existing later target.

The default starting point is the latest Sunday's saved check-in median, or its live seven-calendar-day median when a Sunday weigh-in exists. Incomplete windows retain their sample count. Without either, the form requires an explicit starting reference: use the available Sunday-ending median, select the last saved calorie plan's reference, or enter a starting weight and Sunday. An existing goal retains its original reference until explicitly changed. Daily weigh-ins never recalculate the saved rate.

Saving a goal takes effect on the current local date and appends a version. It does not edit calorie/macro plans, previous goals, food records, or saved reviews. Existing manually entered lb/week or %/week plan goals remain intact; a deadline goal becomes the intended rate from its effective date. A target that has passed stays visible until explicitly revised.

Schema v6 adds `weightGoals`; the IndexedDB upgrade and old-backup migration add an empty collection without changing existing records. Complete JSON backup, merge/replace restore and a weight-goals CSV include all goal versions, formulas and saved reference snapshots. Validation rejects inconsistent calculated values, missing or inconsistent reference windows, conflicting snapshot versions and invalid dates.

New check-ins use calculation version `chris-v3-weight-goal`. Each contains dated reviewed-period weight goals plus the goal applicable to the next Sunday–Saturday plan. Plain-text export separates these from reviewed calorie/macro targets and the next plan. Later goal edits and weight backfills update live summaries without altering saved check-ins or exports. Older v1/v2 saved reviews keep their existing content and export format.
