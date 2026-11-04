# Canadian whole-food data

This release bundles 3,570 records from **Canadian Nutrient File, Health Canada, 2015**. This is the 2015 edition, not the newest CNF release. There is no paid API, account or runtime request to Health Canada. Search and portions work offline after the app assets have been cached.

The current 2026 dataset was located at https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109. Its downloads redirect to an Azure Blob host that the development workspace could not access. The complete official 2015 archive was available directly from Health Canada. The release does not substitute unofficial or invented food values.

## Source and selection

Overview: https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-about-us.html

Complete archive: https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/zip/nutrition/fiche-nutri-data/cnf-fcen-csv.zip

SHA-256: `fb77503d88186844cc2c27b39432d755505f97a789c97fc5973a30d0cd4b0367`

The source contains 5,690 foods. This app selects CNF groups 1, 2, 4, 5, 9, 10, 11, 12, 13, 15, 16, 17 and 20: dairy/eggs, spices, fats/oils, poultry, fruit, pork, vegetables, nuts/seeds, beef, fish, legumes, lamb/veal/game and grains/pasta. It excludes the other 2,120 records (baby foods, mixed dishes, fast foods, branded breakfast-cereal groups, snacks, sweets, etc.). This is a group-based whole-food selection, not a claim that every included record is an unprocessed food. Generic preparation variants remain distinct. Explicit branded descriptions are also excluded by the importer; none of the selected records matched its brand exclusions in this source.

The importer requires four published nutrients to make a food loggable. All 3,570 selected records have calories, protein, total carbohydrate and fat. Missing optional values stay `null`; they are never filled with zero. The original source ZIP and its guides should be retained when updating the catalogue.

## Nutrients and portions

All source values are per 100 g **edible portion**. Source nutrient IDs and units are retained in each normalized profile:

| Field | CNF nutrient ID | Source unit |
| --- | --- | --- |
| Calories | 208 | kCal |
| Protein | 203 | g |
| Total carbohydrate | 205 | g |
| Total fat | 204 | g |
| Fibre | 291 | g |
| Total sugars | 269 | g |
| Sodium | 307 | mg |

Energy uses only nutrient 208. Kilojoules (268) are not added or substituted. Calories are not rebuilt from 4/4/9 arithmetic. Fibre is not subtracted from total carbohydrate. Precision is kept in calculations and rounded only for display.

Each profile preserves the food ID/code, version, original English and French descriptions (including preparation), food group/source, nutrient source IDs, original units and nutrient dates. `nutrition` is the normalized per-100-g profile. Source-defined household measures use the documented conversion factor multiplied by 100 to obtain grams. The complete archive contains 146 conversion records with an unresolved measure ID; those measures are omitted instead of inventing a name or conversion. Gram logging remains available.

Government records are read-only in the UI and in custom-food mutation logic. Make Custom Copy creates a distinct Custom record with its source reference. Logging or favouriting a Canadian food retains its full profile in device storage. Diary entries always keep their own profile, nutrients and portion snapshot. A saved check-in/export remains immutable when the live diary or catalogue changes.

## Rebuild and update

From the repository root:

```
python3 scripts/import-cnf.py --download
npm ci
npm test
```

To use a previously downloaded **complete** archive:

```
python3 scripts/import-cnf.py --zip /path/to/cnf-fcen-csv.zip
```

Do not supply the change-only `cnf-fcen-csv-update-miseajour.zip`; it is not a full catalogue. Pass `--retrieved-at` with the saved metadata timestamp for a reproducible rebuild. Review the source hash, counts, units and source-data tests before committing an update.

Adopting 2026 requires adapting the importer to its documented CSV structure, reviewing the new nutrient/energy definitions, accepting the new version in validation, using distinct versioned food IDs and updating the app/service-worker asset references. Do not relabel 2015 data as 2026. Catalogue replacement must not overwrite custom foods, favourites, diary snapshots, plan history or saved check-ins.

## Copyright and acknowledgement

See `app/data/CNF-NOTICE.txt`. The source guide allows commercial and non-commercial use without further permission, requests due diligence and Health Canada attribution, and says not to modify the nutrient values (serving-size conversion is allowed). The app labels edited copies as Custom. This independent reproduction is not an official version and is not affiliated with or endorsed by Health Canada. CNF is supplied as is, may contain errors, and is a reference tool rather than medical advice.
