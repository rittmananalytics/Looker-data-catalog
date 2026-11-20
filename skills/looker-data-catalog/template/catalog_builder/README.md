# Data Catalog builder

Builds the snapshot that the Data Catalog Looker Data App (`apps/data-catalog/app.js`) shows.

A Looker Data App can only run Looker queries when someone opens it. It cannot read LookML or dbt files. So this script reads the repos, writes one JSON snapshot, and injects it into the app (gzip-compressed and base64-encoded, to stay under Looker's 900 KB limit per app). Usage figures are not in the snapshot: the app reads them live from Looker System Activity.

## What it reads

| Source | Gives the catalog |
|---|---|
| LookML views, the model file's explores, LookML dashboards | Views, fields, metrics and their SQL, joins and join conditions, dashboard tiles |
| dbt project (parsed with `dbt parse`, no warehouse login) | Sources, staging, integration and warehouse models, seeds, descriptions, columns, tests, lineage |
| BigQuery `INFORMATION_SCHEMA` (with `--refresh-warehouse`) | Every column and its type, BigQuery column descriptions, nested fields, row count, size, last modified, partitioning and clustering |
| `catalog.yml` | Client name, logo, colours, fonts, domains, source-system names, warehouse project |
| `glossary.yml` | Business terms, each linked to the metrics that calculate it |
| `knowledge.yml` | Data products; business rules with category, why, the assets they apply to, where they are implemented (`implemented_in`) and the dbt tests that check them (`tested_by`); verified questions; search synonyms; context graph presets |
| git history of both repos | The "Recently changed" list on the home page (needs history in the clone: `git fetch --shallow-since=<date>`) |

## Run it

From the folder that holds `apps/` and `catalog_builder/`:

```bash
catalog_builder/.venv/bin/python -I catalog_builder/build_metadata.py \
    --config catalog_builder/catalog.yml --parse \
    --source apps/data-catalog/src/app.src.js --inject apps/data-catalog/app.js
```

Edit the readable source in `apps/data-catalog/src/app.src.js`. With `--source`, the builder writes `apps/data-catalog/app.js` from it: it injects the snapshot and fonts and strips indentation, blank lines and comment-only lines to save space. The JSDoc header is kept byte for byte. Never edit `app.js` by hand.

To refresh the warehouse column lists and table facts (needs `gcloud auth login` and the `bq` CLI):

```bash
catalog_builder/.venv/bin/python -I catalog_builder/build_metadata.py \
    --config catalog_builder/catalog.yml --parse --refresh-warehouse --inject apps/data-catalog/app.js
```

This runs read-only metadata queries, three per dataset (`INFORMATION_SCHEMA.COLUMNS`, `INFORMATION_SCHEMA.COLUMN_FIELD_PATHS` and `__TABLES__`). They cover only the tables the catalog references and do not scan table data. Each query runs in its dataset's own region, taken from `bq ls`. The result is saved to `catalog_builder/warehouse_snapshot.json`. Builds without the flag use that file, so they need no login. Set the project, region and limits under `warehouse:` in `catalog.yml`.

Then copy the app into Google's Looker Data Apps toolkit (`~/looker-data-apps` by default) and check it from there:

```bash
mkdir -p ~/looker-data-apps/apps/data-catalog
cp apps/data-catalog/app.js ~/looker-data-apps/apps/data-catalog/app.js
cd ~/looker-data-apps
python3 skills/data-app-creator/tools/verify-app.py apps/data-catalog/app.js --no-browser
```

Set up the virtual environment once with `uv`:

```bash
uv venv --python 3.12 catalog_builder/.venv
uv pip install --python catalog_builder/.venv/bin/python lkml pyyaml "dbt-core~=1.10.0" "dbt-bigquery~=1.10.0"
```

Use the dbt adapter that matches the client's warehouse (for example `dbt-snowflake`) and set `dbt.adapter` in the config.

## Point it at another client

1. Copy `catalog.yml` and `glossary.yml` to a new folder.
2. Set `client` (name, tagline, logo SVG paths) and `brand` (colours and font files).
3. Set `lookml.root`, `lookml.model`, `lookml.model_file` and the view and dashboard globs.
4. Set `dbt.project`, `dbt.package`, `dbt.profile_name`, `dbt.database` and `dbt.schema` (the production target, so table names match what Looker reads).
5. Set `warehouse.project` (the billing project, also used for two-part table names). Leave `warehouse.location` empty to use each dataset's own region. Only BigQuery is supported for the warehouse refresh.
6. Map the client's dbt folders to layers (`dbt.layers`) and warehouse folders to domains (`dbt.domain_folders`), and list the domains.
7. Set a Lucide-style icon per domain (`icon:` under `domains`) and `usage.show_people` (false hides names for client deployments).
8. Write the glossary and `knowledge.yml` with the client's owners. Every item shows "Draft, needs an owner" until its `status` is `confirmed`.
9. Copy `apps/data-catalog/src/app.src.js` to the client's repo and run the builder against it. The app takes its name, logo, colours and fonts from the snapshot, so the code does not change.

## Limits

- Looker links: a tile cannot open a new tab or move the Looker page. Explore pages use the runtime's drill menu (the same one Looker uses for drilling) when the host allows it. Dashboards get a link with a copy button.

- Column lists come from BigQuery only after a `--refresh-warehouse` run. Without the cache, columns come from dbt schema files and the columns Looker views use.
- A column counts as described when dbt or a Looker field describes it. Descriptions that exist only in BigQuery are shown, marked BigQuery, but do not count.
- Looker views that take their dataset from a user attribute are checked against `lookml.default_schema`. A column or table reported missing may exist in another user's dataset.
- Tables in datasets the account cannot see are listed with no warehouse details. The builder prints which datasets those are.
- Nested fields are capped at `warehouse.max_nested_fields` per table. BigQuery descriptions are cut to `limits.column_description_chars`. For layers listed in `warehouse.names_and_types_only`, columns keep only their names and types. All three limits keep the app under 900 KB.
- dbt model SQL is cut to the length set in `limits.model_sql_chars`, for the same reason.
- Dashboards built in Looker (not in the repo) appear only through System Activity, so a viewer needs access to it to see them.
