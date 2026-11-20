# Live refresh: BigQuery, LookML and the daily job

Without this, the app shows the catalog built into it, and a rebuild means a republish. With it, a daily job rebuilds the catalog into BigQuery and the app reads the latest build through Looker, so it updates without a republish. Each step below needs the client's approval: it creates objects in their cloud project, their LookML repo and their GitHub.

## 1. BigQuery dataset and tables

`bigquery_tables.sh` (written by `new_client.py`) creates the dataset and six empty tables. Put the dataset in the client's warehouse region. Cost: loads are free, storage is a few MB, and the metadata queries cost pennies a month (each capped at 1 GB billed).

## 2. Service account and GitHub access

- Service account, for example `data-apps-builder@<project>`, with `roles/bigquery.jobUser` and `roles/bigquery.metadataViewer` on the warehouse project, and WRITER on the data_apps dataset only (dataset ACL; `bq add-iam-policy-binding` may need allowlisting).
- Workload identity federation: a provider in the client's GitHub pool, with the condition `assertion.repository == '<owner>/<lookml repo>' && assertion.ref == 'refs/heads/<production branch>'`, and `roles/iam.workloadIdentityUser` for that principal on the service account. No key files.
- A read-only deploy key on the dbt repo, with the private half in the LookML repo's secret `DBT_REPO_DEPLOY_KEY`. Delete any local copy of the private key.

## 3. LookML

Copy into the client's LookML repo, on a branch:

- `lookml/views/data_apps/*.view.lkml` into `views/data_apps/`
- `lookml/data_apps/data_apps.explore.lkml` into `data_apps/`
- `catalog_builder/` (builder, requirements, catalog.yml with repo-relative paths, glossary.yml, knowledge.yml, brand files) into `data_apps/catalog_builder/`
- `ci/data-apps-catalog.yml` into `.github/workflows/`
- One line in the model file: `include: "/data_apps/*.explore.lkml"`

The explore file must keep its own `include: "/views/data_apps/*.view.lkml"`. Looker checks an explore file against its own includes; without the line every data_apps explore fails validation.

In the repo copy of `catalog.yml`, `lookml.root` is the repo itself and the dbt path comes from `DBT_PROJECT_DIR` (the job checks the dbt repo out into `dbt/`).

## 4. Validate, merge, deploy

1. Validate the branch in Looker development mode (the client's Looker IDE, or the API through the toolkit's helpers). Expect 0 errors and the six explores to load.
2. Open a pull request with the client's reviewers. Merge only with their approval.
3. Deploy to production. Merging does not deploy unless the client has a deploy webhook or advanced deploy mode. Deploy from a clean development branch that matches the production branch. Never deploy someone's personal development branch with unsaved work in it.
4. Run the job once (`workflow_dispatch`) and check that the `catalog_snapshot` explore returns the new build.

## When the job runs

| Trigger | Picks up |
|---|---|
| Daily at 05:30 UTC (`schedule` in the workflow) | Everything, including dbt changes and warehouse metadata |
| A push to the production branch touching `views/`, `models/`, `dashboards/`, `explores/` or `data_apps/` | LookML changes and glossary or knowledge edits |
| `workflow_dispatch` (run by hand) | Anything, on demand |

The explores use a datagroup on `MAX(built_at)`, so Looker's cache clears when a new build lands. Usage figures are read live from System Activity and need no job. App code changes still need a rebuild and a republish.

## 5. Model name

The app queries `catalog_snapshot` in the model named in `lookml.model`. Include the explore file in that model.
