# Canadian whole-food data

This release bundles **3,620 records from Canadian Nutrient File, Health Canada, 2026**. The tables are downloaded from the official Open Canada DataStore API during development and bundled with the app. There is no paid API, account, or runtime government request. Search and portions work offline after app setup.

## Official source and reproducible import

Dataset: https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109

Overview: https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-about-us.html

The archive download redirects to an Azure Blob host that the development environment could not access. The **official published DataStore tables** on open.canada.ca provide the same resource records through their documented public API; this release uses those 2026 tables directly rather than an older substitute. The importer paginates by `_id`, checks record totals and unique row IDs, and saves receipt JSON files for replay.

From the repository root:

```
python3 scripts/import-cnf.py --download
npm ci
npm test
```

To rebuild from saved table receipts:

```
python3 scripts/import-cnf.py --cache-dir /path/to/cnf-2026-api --retrieved-at TIMESTAMP_FROM_CATALOGUE
```

The normalized file includes source resource IDs, table row totals, filters, SHA-256 receipts and a combined source hash. `retrievedAt` records catalogue preparation time, separately from original food/nutrient update dates. Reusing that timestamp with the same receipts reproduces the file exactly. Before publishing updates, review hashes, counts, source units, measure types and representative portions.

The full 2026 food table contains **5,993 foods**. Selection uses the existing whole-food groups: CNF 1, 2, 4, 5, 9, 10, 11, 12, 13, 15, 16, 17 and 20 (dairy/eggs, spices, fats/oils, poultry, fruit, pork, vegetables, nuts/seeds, beef, fish, legumes, lamb/veal/game and grains/pasta). The other 2,373 records are outside those groups. Generic preparations remain distinct. Explicit branded descriptions are excluded as well; none of the selected records matched the importer’s brand exclusions. This is a group-based selection, not a claim that every included food is unprocessed.

Only the seven tracked nutrient codes are fetched from the 565,409-row nutrient table: 40,725 source records across all foods. Missing values remain missing. The importer requires calories, protein, total carbohydrate and fat to make a record loggable; all 3,620 selected foods have these four values. Optional unknowns stay `null` and propagate as unavailable in totals.

## Nutrients and portions

All normalized profiles use the source's **100 g edible portion** basis. Published precision is retained; rounding occurs only for display.

| Field | CNF nutrient code | 2026 source unit |
| --- | --- | --- |
| Calories | 208 | kilocalorie |
| Protein | 203 | Gram |
| Total carbohydrate | 205 | Gram |
| Total fat | 204 | Gram |
| Fibre | 291 | Gram |
| Total sugars | 269 | Gram |
| Sodium | 307 | Milligram |

Calories use only source code 208. Kilojoules (268) are neither added nor substituted. Energy is never rebuilt from 4/4/9 arithmetic. Fibre is not subtracted from total carbohydrate.

CNF 2026 joins tables by `Food_Code`, `Nutrient_Code` and `Measure_Code`. Profiles retain the original English/French food descriptions, alternative descriptions, food code, group/source, scientific name, USDA code where provided, update dates, and the units and source code/description for each tracked nutrient. The app's `nutrition` object is the normalized per-100-g profile.

**2026 measure weights are already grams.** They must not be multiplied by 100 as in the 2015 conversion-factor format. Only measure type **6 (User-defined)** is offered as a household portion. Type 3 (Refuse) and type 9 (Yield) are excluded from logging units. One type-6 conversion has an unresolved measure label and is omitted rather than invented. Gram logging remains available. Custom volume-only foods never gain an invented gram conversion.

## Historical data and updates

New searches and selections use 2026. Existing CNF 2015 food references, favourites, custom copies, diary snapshots, copied entries and already-planned food remain reconstructable. A favourite/Recent view resolves the same government food code to its current catalogue record for a new log, while keeping the original favourite reference and historical profiles intact. If a saved code has no current record, its retained source profile remains explicitly labelled with its original edition.

2026 uses distinct versioned IDs (`cnf-2026-...`). Historical entries retain `cnf-2015-...` snapshots and the original stated nutrients and portions. Neither a catalogue update nor a new weigh-in rewrites saved entries, targets, check-ins or exported snapshots. Government profiles remain read-only; Make Custom Copy creates a separate Custom record with its original source reference.

The small 2015 fixture in tests verifies backward-compatible restores. `scripts/import-cnf-2015.py` is retained for reproducing legacy profiles, not for the live catalogue.

## Copyright and acknowledgement

Canadian Nutrient File, Health Canada, 2026. The dataset is published under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). See `app/data/CNF-NOTICE.txt`, including the retained 2015 attribution for historical profiles. This independent app is not an official government version and is not affiliated with or endorsed by Health Canada. Values are reference averages, supplied as is, and are not medical advice.
