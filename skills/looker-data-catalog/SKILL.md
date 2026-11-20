---
name: looker-data-catalog
description: Build a branded Data Catalog and knowledge catalog as a Looker Data App for an organisation or a client, with search, domains, tables, Looker model, metrics, dashboards, lineage, data products, glossary, business rules, verified questions, context graph, documentation health and usage, in their own logo, colours, fonts and words. Reads a LookML repo, a dbt project and BigQuery metadata. Use when someone asks for a data catalog, metadata catalog, knowledge catalog or Looker data catalog, wants to rebrand or redeploy the catalog for another client, or wants to update an existing catalog. Covers setup, branding, knowledge content, build, checks, live refresh and publishing.
---

# Looker Data Catalog

One Looker Data App (`ra-data-catalog`) that reads an organisation's LookML repo, dbt project and BigQuery metadata, plus a knowledge layer written with the people who own the numbers. The app code is shared by every deployment. Everything specific to one organisation lives in one folder: `catalog_builder/catalog.yml`, `glossary.yml`, `knowledge.yml` and `brand/`.

In this guide, `<skill>` means the folder this file is in.

| Path | What it is |
|---|---|
| `template/app/src/app.src.js` | The app source. Shared; the brand comes from the config |
| `template/catalog_builder/` | Builder (`build_metadata.py`), pinned `requirements.txt`, `catalog.yml` template, empty `glossary.yml` and `knowledge.yml` |
| `template/lookml/` | Views and explore file for the live refresh |
| `template/ci/data-apps-catalog.yml` | Daily GitHub Actions job |
| `template/bigquery_tables.sh` | Creates the dataset and tables |
| `scripts/new_client.py` | Sets up a project folder from the templates |
| `scripts/check_brand.py` | Checks colours, contrast, logo, fonts, privacy defaults and placeholders |
| `reference/branding.md` | What to collect and how to derive the colour tokens |
| `reference/knowledge.md` | How to draft, check and confirm knowledge content |
| `reference/rollout.md` | BigQuery, service account, LookML, deploy and the daily job |

## What you need

- A Looker-hosted instance on 26.18 or later, with Data Apps switched on (Admin, General, Previews). See https://docs.cloud.google.com/looker/docs/data-apps.
- Google's Looker Data Apps toolkit, installed and configured for that instance: `bash <(curl -fsSL https://dl.google.com/looker-data-apps/install.sh)`. It installs to `~/looker-data-apps` by default. This guide calls that folder `<toolkit>`.
- The LookML repo and the dbt project, cloned locally.
- BigQuery for warehouse metadata and the live refresh (optional; see Step 5).
- Python 3.10 or later, and `uv` (or `pip`) for the builder's environment.

## Rules

- **One organisation per folder, one toolkit per Looker instance.** Never point one client's build at another client's repos, toolkit or Looker instance, and never copy one client's knowledge content, logos or names into another's.
- **Never read, print or copy the toolkit's `data-apps-config.json`.** It holds Looker API credentials. Use the toolkit's own scripts, which read it themselves.
- **Publish only after a person confirms** the instance, the folder and whether it is a first publish or a republish. Check who can see the target Looker folder before the first publish.
- **Privacy by default:** `usage.show_people: false`. Turn it on only with the organisation's written agreement.
- **Knowledge is draft until checked:** see `reference/knowledge.md`. Never mark an item confirmed without code evidence and a named owner.
- **Brand through config only.** Do not edit `app.src.js` for one organisation. A fix or feature goes into this skill's template and into each deployment's copy, then each one is rebuilt.
- Commit, push, open pull requests or change a cloud project only when the user asks.
- Run Python that reads cloned repos with `python3 -I`.

## Step 1. Set up the project folder

Clone the LookML and dbt repos (for example into `<folder>/sources/`), then:

```bash
python3 -I <skill>/scripts/new_client.py \
  --client "Acme Retail" --out ~/data-catalogs/acme \
  --looker-instance https://acme.cloud.looker.com \
  --lookml ../sources/<lookml repo> --dbt ../sources/<dbt repo> \
  --dbt-package <dbt project name> --dbt-profile <profile> \
  --model <looker model> --model-file models/<model>.model.lkml \
  --default-schema <main dataset> --warehouse-project <gcp project> \
  --bq-project <gcp project for the catalog tables> --bq-location <region>
```

Paths for `--lookml` and `--dbt` are relative to `catalog_builder/`. The script lists any placeholders left to fill in. Then create the builder environment:

```bash
cd ~/data-catalogs/acme
uv venv --python 3.12 catalog_builder/.venv
uv pip install --python catalog_builder/.venv/bin/python -r catalog_builder/requirements.txt
```

Use the dbt adapter that matches the warehouse (for example `dbt-snowflake`) and set `dbt.adapter` in `catalog.yml`.

## Step 2. Brand

Follow `reference/branding.md`: put `logo.svg`, `mark.svg` and any licensed fonts in `brand/`, set the colour tokens and fonts in `catalog.yml`, and write the search prompts, domains and source system names in the organisation's own words. Then:

```bash
catalog_builder/.venv/bin/python -I <skill>/scripts/check_brand.py catalog_builder/catalog.yml
```

Fix every error. Each warning gets a decision.

## Step 3. Map the model

In `catalog.yml`: `dbt.layers` (dbt folder names to staging, integration, warehouse), `dbt.domain_folders`, `domains`, `domain_keywords`, `lookml.dashboards` and `dashboards_in_model`. Build once (Step 5) and look at the Domains page: anything under Other needs a folder or keyword rule.

## Step 4. Knowledge content

Draft, check and confirm as `reference/knowledge.md` describes. Start with drafts, so the first build has Knowledge pages to review with the owners.

## Step 5. Build

```bash
catalog_builder/.venv/bin/python -I catalog_builder/build_metadata.py \
  --config catalog_builder/catalog.yml --parse --refresh-warehouse \
  --source apps/data-catalog/src/app.src.js --inject apps/data-catalog/app.js
```

`--refresh-warehouse` runs read-only BigQuery metadata queries (needs `gcloud auth login`); later builds reuse `warehouse_snapshot.json`. The builder prints the app size: keep it under 900 KB, the Looker limit per app. If it is over, add layers to `warehouse.names_and_types_only`, set `limits.hidden_fields: brief` and `limits.column_descriptions_skip_layers` (these save the most on large projects), lower the other `limits`, or drop a font weight.

Warehouse metadata and the live refresh support BigQuery only. For another warehouse, build without `--refresh-warehouse`; the catalog then has dbt and LookML metadata but no warehouse columns, sizes or freshness.

## Step 6. Check and preview

Copy the built app into the toolkit and run Google's checks from the toolkit folder:

```bash
mkdir -p <toolkit>/apps/data-catalog
cp apps/data-catalog/app.js <toolkit>/apps/data-catalog/app.js
cd <toolkit>
python3 skills/data-app-creator/tools/check-credentials.py --json
python3 skills/data-app-creator/tools/verify-app.py apps/data-catalog/app.js --no-browser
python3 skills/data-app-previewer/tools/start-preview.py apps/data-catalog/app.js
```

`check-credentials.py` must pass before anything else. `verify-app.py` checks the syntax, the tile sandbox rules and a dry run of every query against Looker. The preview opens the app in a browser in sandbox mode, as a published tile runs. Look at Home, Search, a table page, a metric page, Lineage, the Knowledge pages and Documentation health at desktop and narrow widths. Check the logo and colours, and that no other organisation's name appears anywhere. Stop the preview with `python3 skills/data-app-previewer/tools/stop-preview.py`.

## Step 7. Live refresh (recommended)

Follow `reference/rollout.md`: dataset and tables, service account, LookML explores, the daily job, then validate, merge and deploy with the owner's approval. After that the app reads each day's build from BigQuery and shows "Catalog updated <time>". Without it, the app shows "Built-in copy from <date>" and each update needs a rebuild and a republish.

## Step 8. Publish

Show the user the Looker instance, the target folder and whether this is a first publish or a republish, and publish only when they confirm. From the toolkit folder:

```bash
# First publish: creates a dashboard with one full-screen tile
python3 skills/data-app-publisher/tools/publish-data-app.py --def apps/data-catalog/app.js --title "Data Catalog"

# Every later publish: update the same dashboard in place
python3 skills/data-app-publisher/tools/publish-data-app.py --def apps/data-catalog/app.js --dashboard-id <id>
```

Without `--dashboard-id`, each publish creates another dashboard. The publisher writes tags such as `@looker-dashboard-id` into the header of the toolkit's copy of `app.js`. Copy those header lines into the header of `apps/data-catalog/src/app.src.js` (the builder keeps the source header), so later builds carry the dashboard id.

If the publisher reports that the dashboard was last updated by someone else, stop and ask the user. Run again with `--confirm-replace` only on an explicit yes.

## Updating a catalog later

- Content changes (new models, fields, docs): the daily job picks them up. Without the job, rebuild (Step 5) and republish.
- Knowledge changes: edit the YAML, rebuild, and either let the job load it or republish.
- App fixes and features: change this skill's `template/app/src/app.src.js` (and builder) first, copy into each deployment's folder, rebuild and republish each one.

## What to tell the people who use it

- The catalog shows metadata, not table data. Usage comes from Looker System Activity for the model.
- Looker Data Apps are a preview feature: Looker-hosted instances, 26.18 or later, with the preview switched on. Viewers need access to www.gstatic.com.
- No PDF export or scheduled delivery.
- Copies of the published dashboard share one app: a republish changes every copy.
