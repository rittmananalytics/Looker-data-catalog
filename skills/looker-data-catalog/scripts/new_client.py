"""Set up a branded Data Catalog project for one client from the skill's templates.

Creates, under --out:
    apps/data-catalog/src/app.src.js     the app source (never edit app.js by hand)
    catalog_builder/                     builder, catalog.yml (filled in), glossary.yml, knowledge.yml
    brand/                               put logo.svg, mark.svg and licensed font files here
    lookml/                              files to copy into the client's LookML repo
    ci/data-apps-catalog.yml             GitHub Actions job for the client's LookML repo
    bigquery_tables.sh                   creates the dataset and tables (run once)
    .gitignore

Placeholders that the arguments do not cover stay as {{NAME}} and are listed at the end.
Refuses to write into a folder that already has a catalog_builder/catalog.yml.

    python3 -I new_client.py --client "Acme Retail" --out ~/data-catalogs/acme \
        --looker-instance https://acme.cloud.looker.com --lookml ../sources/acme_lookml \
        --dbt ../sources/acme_dbt --model analytics --model-file models/analytics.model.lkml \
        --warehouse-project acme-prod --default-schema analytics \
        --bq-project acme-prod --bq-dataset data_apps --bq-location EU
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL / "template"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--client", required=True, help="client name as it should appear in the app")
    ap.add_argument("--out", required=True, type=Path, help="new project folder")
    ap.add_argument("--looker-instance", default="{{LOOKER_INSTANCE}}")
    ap.add_argument("--lookml", default="{{LOOKML_ROOT}}", help="LookML repo, relative to catalog_builder/")
    ap.add_argument("--dbt", default="{{DBT_ROOT}}", help="dbt project, relative to catalog_builder/")
    ap.add_argument("--dbt-package", default="{{DBT_PACKAGE}}")
    ap.add_argument("--dbt-profile", default="{{DBT_PROFILE}}")
    ap.add_argument("--model", default="{{LOOKER_MODEL}}")
    ap.add_argument("--model-file", default="{{MODEL_FILE}}")
    ap.add_argument("--default-schema", default="{{DEFAULT_SCHEMA}}")
    ap.add_argument("--warehouse-project", default="{{BQ_WAREHOUSE_PROJECT}}")
    ap.add_argument("--bq-project", default="{{BQ_PROJECT}}", help="project for the data_apps dataset")
    ap.add_argument("--bq-dataset", default="data_apps")
    ap.add_argument("--bq-location", default="{{BQ_LOCATION}}")
    ap.add_argument("--dbt-repo", default="{{DBT_REPO}}", help="owner/name of the dbt repo, for the CI job")
    ap.add_argument("--prod-branch", default="master", help="LookML production branch")
    ap.add_argument("--wif-provider", default="{{WIF_PROVIDER}}")
    ap.add_argument("--service-account", default="{{SERVICE_ACCOUNT}}")
    a = ap.parse_args()

    out = a.out.expanduser().resolve()
    if (out / "catalog_builder" / "catalog.yml").exists():
        sys.exit(f"{out} already has catalog_builder/catalog.yml; not overwriting")

    values = {
        "CLIENT_NAME": a.client, "LOOKER_INSTANCE": a.looker_instance.rstrip("/"),
        "LOOKML_ROOT": a.lookml, "DBT_ROOT": a.dbt, "DBT_PACKAGE": a.dbt_package, "DBT_PROFILE": a.dbt_profile,
        "LOOKER_MODEL": a.model, "MODEL_FILE": a.model_file, "DEFAULT_SCHEMA": a.default_schema,
        "BQ_WAREHOUSE_PROJECT": a.warehouse_project, "BQ_PROJECT": a.bq_project, "BQ_DATASET": a.bq_dataset,
        "BQ_LOCATION": a.bq_location, "DBT_REPO": a.dbt_repo, "PROD_BRANCH": a.prod_branch,
        "WIF_PROVIDER": a.wif_provider, "SERVICE_ACCOUNT": a.service_account,
    }
    # Values given as their own placeholder stay unfilled.
    values = {k: v for k, v in values.items() if v != "{{" + k + "}}"}

    def fill(text: str) -> str:
        return re.sub(r"\{\{([A-Z_]+)\}\}", lambda m: values.get(m.group(1), m.group(0)), text)

    plan = [
        ("app/src/app.src.js", "apps/data-catalog/src/app.src.js", False),
        ("catalog_builder/build_metadata.py", "catalog_builder/build_metadata.py", False),
        ("catalog_builder/requirements.txt", "catalog_builder/requirements.txt", False),
        ("catalog_builder/README.md", "catalog_builder/README.md", False),
        ("catalog_builder/catalog.yml", "catalog_builder/catalog.yml", True),
        ("catalog_builder/glossary.yml", "catalog_builder/glossary.yml", False),
        ("catalog_builder/knowledge.yml", "catalog_builder/knowledge.yml", False),
        ("ci/data-apps-catalog.yml", "ci/data-apps-catalog.yml", True),
        ("bigquery_tables.sh", "bigquery_tables.sh", True),
    ]
    plan += [(f"lookml/{p.relative_to(TEMPLATE / 'lookml')}", f"lookml/{p.relative_to(TEMPLATE / 'lookml')}", True)
             for p in sorted((TEMPLATE / "lookml").rglob("*.lkml"))]

    left = set()
    for src, dst, templated in plan:
        target = out / dst
        target.parent.mkdir(parents=True, exist_ok=True)
        if templated:
            text = fill((TEMPLATE / src).read_text(encoding="utf-8"))
            left |= set(re.findall(r"\{\{[A-Z_]+\}\}", text))
            target.write_text(text, encoding="utf-8")
        else:
            shutil.copyfile(TEMPLATE / src, target)
    (out / "bigquery_tables.sh").chmod(0o755)
    (out / "brand" / "fonts").mkdir(parents=True, exist_ok=True)
    (out / "apps" / "data-catalog").mkdir(parents=True, exist_ok=True)
    gi = out / ".gitignore"
    if not gi.exists():
        gi.write_text("catalog_builder/.venv/\ncatalog_builder/warehouse_snapshot.json\ncatalog_builder/catalog_metadata.json\nsources/\n")

    print(f"Created {out}")
    print("Files written:", len(plan) + 1)
    if left:
        print("Still to fill in:", ", ".join(sorted(left)))
    print("Next: add brand/logo.svg and brand/mark.svg, set the brand colours in catalog_builder/catalog.yml,")
    print(f"then run: <builder venv python> -I {SKILL / 'scripts' / 'check_brand.py'} {out / 'catalog_builder' / 'catalog.yml'}")


if __name__ == "__main__":
    main()
