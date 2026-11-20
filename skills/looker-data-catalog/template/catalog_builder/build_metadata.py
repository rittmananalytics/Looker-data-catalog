"""Build the metadata snapshot for the Data Catalog Data App.

A Looker Data App can only run Looker queries when someone opens it. It cannot
read LookML or dbt files at that point. This script reads them from the repos
instead, writes one JSON snapshot, and injects it (gzip-compressed and
base64-encoded) into the app between the markers

    /* @metadata-start */ ... /* @metadata-end */

It also injects the brand fonts between /* @fonts-start */ ... /* @fonts-end */.

Everything client-specific lives in the config file (catalog.yml): client
name, logo, colours, fonts, repo paths, domains, source-system names and the
glossary. Point a new config at another client's repos to build their catalog.

Sources read:
  - LookML views, the model file's explores and LookML dashboards  (lkml, yaml)
  - dbt manifest.json: models, sources, seeds, snapshots, tests, lineage
    (--parse runs `dbt deps` and `dbt parse` on a temporary copy of the dbt
    project with a throwaway profile, so no warehouse login is needed)

Usage (from the app folder's parent):
  catalog_builder/.venv/bin/python -I catalog_builder/build_metadata.py \
      --config catalog_builder/catalog.yml --parse --inject apps/data-catalog/app.js
"""

from __future__ import annotations

import argparse
import base64
import collections
import datetime as dt
import glob
import gzip
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import lkml
import yaml

MARK_START = "/* @metadata-start */"
MARK_END = "/* @metadata-end */"
FONT_START = "/* @fonts-start */"
FONT_END = "/* @fonts-end */"
APP_LIMIT = 900_000  # Looker's limit per app, in bytes

TIMEFRAME_SUFFIXES = (
    "raw", "time", "date", "week", "month", "quarter", "year", "day_of_week", "day_of_month",
    "hour", "minute", "second", "month_name", "month_num", "fiscal_quarter", "fiscal_year",
    "fiscal_month_num", "fiscal_quarter_of_year", "week_of_year", "day_of_year", "hour_of_day",
    "quarter_of_year", "time_of_day", "millisecond", "date_raw", "day_of_week_index",
)


LIQUID = re.compile(r"\{\{.*?\}\}|\{%.*?%\}", re.S)


def clip(text, n):
    text = LIQUID.sub("", text or "") if isinstance(text, str) else (text or "")
    text = re.sub(r"[ \t]+", " ", text.strip())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def sql_clip(text, n):
    if n <= 0:  # a limit of 0 leaves the SQL out (no Code tab)
        return ""
    text = (text or "").strip().rstrip(";").strip()
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text if len(text) <= n else text[: n - 1].rstrip() + "\n…"


def git_changes(path: Path, days: int = 120) -> dict:
    """Last commit date for each file changed in the last `days` days (needs history in the clone)."""
    try:
        out = subprocess.run(["git", "-C", str(path), "log", f"--since={days}.days", "--name-only", "--format=@%cI"],
                             capture_output=True, text=True, check=True).stdout
    except Exception:  # noqa: BLE001
        return {}
    seen, when = {}, ""
    for line in out.splitlines():
        if line.startswith("@"):
            when = line[1:11]
        elif line.strip() and line not in seen:
            seen[line.strip()] = when
    return seen


def git_info(path: Path) -> dict:
    try:
        sha = subprocess.run(["git", "-C", str(path), "rev-parse", "--short", "HEAD"],
                             capture_output=True, text=True, check=True).stdout.strip()
        when = subprocess.run(["git", "-C", str(path), "log", "-1", "--format=%cI"],
                              capture_output=True, text=True, check=True).stdout.strip()
        remote = subprocess.run(["git", "-C", str(path), "remote", "get-url", "origin"],
                                capture_output=True, text=True).stdout.strip()
        repo = re.sub(r"(\.git)?$", "", remote.split("/")[-1]) if remote else path.name
        return {"repo": repo, "commit": sha, "committed": when[:10]}
    except Exception:  # noqa: BLE001
        return {"repo": path.name, "commit": "", "committed": ""}


# --------------------------------------------------------------------------- dbt


def cfg_path(base: Path, section: dict, key: str) -> Path:
    """A path from the config; `<key>_env` names an environment variable that overrides it (for CI)."""
    env = section.get(f"{key}_env")
    if env and os.environ.get(env):
        return Path(os.environ[env]).expanduser().resolve()
    return (base / section[key]).resolve()


def load_manifest(cfg: dict, base: Path, parse: bool) -> dict:
    d = cfg["dbt"]
    if d.get("manifest") and not parse:
        return json.loads((base / d["manifest"]).read_text())
    project = cfg_path(base, d, "project")
    work = Path(tempfile.mkdtemp(prefix="catalog_dbt_"))
    try:
        shutil.copytree(project, work / "dbt", ignore=shutil.ignore_patterns(".git", "target", "dbt_packages", "logs",
                                                                   ".venv", "venv", "__pycache__", "node_modules"))
        prof = work / "profiles"
        prof.mkdir()
        out = {"type": d.get("adapter", "bigquery"), "threads": 1}
        if out["type"] == "bigquery":
            out.update({"method": "oauth", "project": d.get("database", "parse-only"), "dataset": d.get("schema", "parse_only")})
        elif out["type"] == "snowflake":
            out.update({"account": "x", "user": "x", "password": "x", "database": "x", "warehouse": "x", "schema": "x", "role": "x"})
        (prof / "profiles.yml").write_text(yaml.safe_dump({d["profile_name"]: {"target": "parse", "outputs": {"parse": out}}}))
        dbt = Path(sys.executable).parent / "dbt"
        for args in (["deps"], ["parse", "--no-partial-parse"]):
            r = subprocess.run([str(dbt), *args, "--profiles-dir", str(prof), "--project-dir", str(work / "dbt")],
                               capture_output=True, text=True)
            if r.returncode != 0:
                sys.exit(f"dbt {args[0]} failed:\n{r.stdout[-3000:]}\n{r.stderr[-2000:]}")
        return json.loads((work / "dbt" / "target" / "manifest.json").read_text())
    finally:
        shutil.rmtree(work, ignore_errors=True)


def system_label(source_name: str, systems: dict) -> str:
    s = re.sub(r"^(stitch|fivetran|segment|coupler|airbyte|dlt)_", "", source_name)
    for key in sorted(systems, key=len, reverse=True):
        if s.startswith(key) or source_name.startswith(key):
            return systems[key]
    return s.replace("_", " ").title()


def build_dbt(man: dict, cfg: dict, lim: dict):
    d = cfg["dbt"]
    pkg = d["package"]
    systems = cfg.get("source_systems", {})
    nodes = {}
    tests_by_node = collections.defaultdict(list)

    for uid, n in man["nodes"].items():
        if n.get("package_name") != pkg or n["resource_type"] != "test":
            continue
        meta = n.get("test_metadata") or {}
        tname = meta.get("name") or n["name"].split("_")[0]
        singular = not meta.get("name")
        col = n.get("column_name") or (meta.get("kwargs") or {}).get("column_name")
        targets = [x for x in n["depends_on"]["nodes"] if not x.startswith("macro.")]
        attached = n.get("attached_node") or (targets[0] if targets else None)
        if not attached:
            continue
        kw = meta.get("kwargs") or {}
        detail = ""
        if tname == "accepted_values" and kw.get("values"):
            detail = ", ".join(map(str, kw["values"]))[:120]
        elif tname == "relationships" and kw.get("to"):
            m = re.search(r"ref\(['\"]([^'\"]+)", str(kw["to"]))
            detail = f"{m.group(1) if m else kw['to']}.{kw.get('field', '')}"
        if singular:
            detail = n["name"]
            for t in targets:  # a singular test checks every model it reads
                if t != attached:
                    tests_by_node[t].append({"t": "assert", "c": "", "d": detail})
        tests_by_node[attached].append({"t": tname, "c": col or "", "d": detail})

    for uid, n in list(man["nodes"].items()) + list(man["sources"].items()):
        if n.get("package_name") != pkg:
            continue
        rt = n["resource_type"]
        if rt not in ("model", "seed", "snapshot", "source"):
            continue
        fqn = n.get("fqn", [])
        if rt == "source":
            kind, layer = "source", "source"
            folder = ""
            name = f"{n['source_name']}.{n['name']}"
            relation = ".".join(x for x in (n.get("database"), n.get("schema"), n.get("identifier")) if x)
            system = system_label(n["source_name"], systems)
        else:
            kind = "model" if rt == "model" else rt
            folder = fqn[1] if len(fqn) > 2 else ""
            layer = rt if rt != "model" else d["layers"].get(folder, folder or "model")
            name = n["name"]
            relation = ".".join(x for x in (n.get("database"), n.get("schema"), n.get("alias") or n["name"]) if x)
            system = ""
        domain = d["domain_folders"].get(fqn[2] if len(fqn) > 3 else "", "") if rt == "model" else ""
        cols = []
        # limits.column_descriptions_skip_layers: layers whose dbt column descriptions are left
        # out to save app space (names and types stay). Off unless set.
        brief_cols = layer in set(lim.get("column_descriptions_skip_layers") or [])
        for c in (n.get("columns") or {}).values():
            cols.append({"n": c["name"], "ty": (c.get("data_type") or "").lower(),
                         "d": "" if brief_cols else clip(c.get("description"), lim["description_chars"]), "src": "dbt"})
        cfgn = n.get("config") or {}
        node = {
            "id": uid, "k": kind, "layer": layer, "name": name,
            "rel": relation, "alias": (n.get("alias") or n.get("identifier") or n["name"]).lower(),
            "schema": (n.get("schema") or "").lower(),
            "d": clip(n.get("description"), lim["description_chars"]),
            "dom": domain, "tags": sorted(set(n.get("tags") or []) - {layer}),
            "mat": cfgn.get("materialized", "") if rt != "source" else "",
            "path": n.get("original_file_path", ""),
            "cols": cols,
            "up": [x for x in (n.get("depends_on") or {}).get("nodes", []) if not x.startswith(("macro.", "test.", "metric."))],
            "tests": tests_by_node.get(uid, []),
            "owner": ((n.get("meta") or {}).get("owner") or (cfgn.get("meta") or {}).get("owner") or ""),
            "sys": system,
        }
        if rt != "source":
            node["sql"] = sql_clip(n.get("raw_code"), lim["model_sql_chars"])
            node["sqlLen"] = len(n.get("raw_code") or "")
            if cfgn.get("unique_key"):
                node["key"] = cfgn["unique_key"] if isinstance(cfgn["unique_key"], str) else ", ".join(cfgn["unique_key"])
            pb = cfgn.get("partition_by")
            if isinstance(pb, dict) and pb.get("field"):
                node["part"] = pb["field"]
            if cfgn.get("cluster_by"):
                cb = cfgn["cluster_by"]
                node["clus"] = cb if isinstance(cb, str) else ", ".join(cb)
        else:
            node["loader"] = n.get("loader") or ""
            if n.get("freshness") and (n["freshness"].get("warn_after") or {}).get("count"):
                w = n["freshness"]["warn_after"]
                node["fresh"] = f"warn after {w['count']} {w['period']}"
        nodes[uid] = node
    # keep only edges to nodes we kept
    for node in nodes.values():
        node["up"] = [u for u in node["up"] if u in nodes]
    return nodes


# --------------------------------------------------------------------------- LookML


def lkml_files(root: Path, patterns):
    out = []
    for p in patterns:
        out += [Path(x) for x in glob.glob(str(root / p), recursive=True)]
    return sorted(set(out))


def table_of(sql_table_name, default_schema):
    if not sql_table_name:
        return None
    s = sql_table_name.strip().rstrip(";").strip().replace("`", "")
    s = re.sub(r"\{\{[^}]*\}\}", default_schema, s)
    parts = [p for p in s.split(".") if p]
    if not parts:
        return None
    return ".".join(parts[-2:]).lower() if len(parts) >= 2 else f"{default_schema}.{parts[-1]}".lower()


REF_RE = re.compile(r"\$\{([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?\}")
TABLE_COL_RE = re.compile(r"\$\{TABLE\}\s*\.\s*`?([A-Za-z0-9_]+)`?")


def field_refs(sql, view):
    """Field refs (view.field), columns (col) and view refs from a LookML sql string."""
    refs, cols, views = [], [], []
    for m in TABLE_COL_RE.finditer(sql or ""):
        cols.append(m.group(1).lower())
    for m in REF_RE.finditer(sql or ""):
        a, b = m.group(1), m.group(2)
        if a == "TABLE" and not b:
            continue
        if b is None:
            refs.append(f"{view}.{a}")
        elif b == "SQL_TABLE_NAME":
            views.append(a)
        elif a == "TABLE":
            continue
        else:
            refs.append(f"{a}.{b}")
    dedupe = lambda xs: list(dict.fromkeys(xs))  # noqa: E731
    return dedupe(refs), dedupe(cols), dedupe(views)


def measure_filters(f):
    out = []
    for item in f.get("filters", []) or []:
        if isinstance(item, dict):
            if "field" in item:
                out.append([item["field"], str(item.get("value", ""))])
            else:
                out += [[k, str(v)] for k, v in item.items()]
    return out


def load_lookml(cfg, base, lim):
    L = cfg["lookml"]
    root = (base / L["root"]).resolve()
    default_schema = L.get("default_schema", "")
    views = {}
    for path in lkml_files(root, L["views"]):
        try:
            parsed = lkml.load(path.read_text())
        except Exception as exc:  # noqa: BLE001
            print(f"warning: could not parse {path.relative_to(root)}: {exc}", file=sys.stderr)
            continue
        rel = str(path.relative_to(root))
        for v in parsed.get("views", []):
            name = v["name"].lstrip("+")
            t = views.setdefault(name, {"name": name, "files": [], "fields": {}, "refinement": False})
            t["files"].append(rel)
            if v["name"].startswith("+"):
                t["refinement"] = True
            for key in ("sql_table_name", "label", "description"):
                if key in v:
                    t[key] = v[key]
            if "extends__all" in v:
                t["extends"] = [x for g in v["extends__all"] for x in g]
            if "derived_table" in v:
                dtb = v["derived_table"]
                t["derived"] = dtb.get("sql") or ("explore_source: " + str((dtb.get("explore_source") or {}).get("name", "")))
                t["persisted"] = bool(dtb.get("datagroup_trigger") or dtb.get("sql_trigger_value") or dtb.get("persist_for") or dtb.get("materialized_view"))
            for kind, key in (("dimension", "dimensions"), ("dimension_group", "dimension_groups"), ("measure", "measures"),
                              ("parameter", "parameters"), ("filter", "filters")):
                for f in v.get(key, []):
                    cur = t["fields"].setdefault(f["name"], {"name": f["name"], "kind": kind})
                    cur.update({k: f[k] for k in f if k != "name"})

    def view_fields(name, seen=()):
        v = views.get(name)
        if not v or name in seen:
            return {}
        out = {}
        for parent in v.get("extends", []) or []:
            out.update(view_fields(parent, seen + (name,)))
        out.update(v["fields"])
        return out

    for v in views.values():
        if v.get("extends"):
            v["fields"] = view_fields(v["name"])
            for parent in v["extends"]:
                for key in ("sql_table_name", "derived"):
                    if key not in v and views.get(parent, {}).get(key):
                        v[key] = views[parent][key]
        v["table"] = table_of(v.get("sql_table_name"), default_schema)

    # explores from the model file
    explores = {}
    model_path = root / L["model_file"]
    parsed = lkml.load(model_path.read_text())
    explore_defs = [(e, L["model_file"]) for e in parsed.get("explores", [])]
    # explores in files the model includes (for example include: "/data_apps/*.explore.lkml")
    incs = parsed.get("includes") or parsed.get("include") or []
    incs = [incs] if isinstance(incs, str) else incs
    for inc in incs:
        # Explores can sit in any included LookML file (some projects keep them in
        # *.layer.lkml or *.view.lkml files), so read every include except dashboards.
        if ".dashboard" in inc:
            continue
        for f in sorted(glob.glob(str(root / inc.lstrip("/")), recursive=True)):
            try:
                for e in lkml.load(Path(f).read_text()).get("explores", []):
                    explore_defs.append((e, str(Path(f).relative_to(root))))
            except Exception as exc:  # noqa: BLE001
                print(f"warning: could not parse {f}: {exc}", file=sys.stderr)
    for e, efile in explore_defs:
        name = e["name"].lstrip("+")
        t = explores.setdefault(name, {"name": name, "joins": {}, "file": efile})
        for key in ("label", "description", "from", "view_name", "hidden", "group_label", "view_label"):
            if key in e:
                t[key] = e[key]
        if "extends__all" in e:
            t["extends"] = [x for g in e["extends__all"] for x in g]
        t["rowLevel"] = bool(e.get("access_filters")) or "_user_attributes" in str(e.get("sql_always_where", ""))
        if e.get("sql_always_where"):
            t["always"] = clip(e["sql_always_where"], 300)
        for j in e.get("joins", []):
            t["joins"][j["name"]] = {
                "a": j["name"], "v": j.get("from", j["name"]), "rel": j.get("relationship", "many_to_one"),
                "type": j.get("type", "left_outer"), "on": re.sub(r"\s+", " ", (j.get("sql_on") or j.get("foreign_key") or "").strip()),
            }

    def explore_joins(name, seen=()):
        e = explores.get(name)
        if not e or name in seen:
            return {}, None
        joins, base_v = {}, None
        for parent in e.get("extends", []) or []:
            pj, pb = explore_joins(parent, seen + (name,))
            joins.update(pj)
            base_v = base_v or pb
        joins.update(e["joins"])
        return joins, e.get("from") or e.get("view_name") or base_v or name

    for e in explores.values():
        e["joins"], e["base"] = explore_joins(e["name"])

    # dashboards
    dashboards = []
    in_model = set(lkml_files(root, L.get("dashboards_in_model", L["dashboards"])))
    for path in lkml_files(root, L["dashboards"]):
        try:
            doc = yaml.safe_load(path.read_text())
        except Exception as exc:  # noqa: BLE001
            print(f"warning: could not parse {path.relative_to(root)}: {exc}", file=sys.stderr)
            continue
        for dsh in doc if isinstance(doc, list) else []:
            if not isinstance(dsh, dict) or "dashboard" not in dsh:
                continue
            tiles = []
            for el in dsh.get("elements") or []:
                queries = el.get("merged_queries") or [el]
                for q in queries:
                    if not q.get("explore"):
                        continue
                    tiles.append({
                        "t": clip(el.get("title") or el.get("name") or "", 120),
                        "type": q.get("type") or el.get("type") or "",
                        "model": q.get("model") or el.get("model") or "",
                        "x": q["explore"],
                        "f": list(dict.fromkeys((q.get("fields") or []) + (q.get("pivots") or []))),
                        "note": clip((el.get("note_text") or el.get("subtitle_text") or ""), 200),
                    })
                if el.get("type") == "text" and not queries[0].get("explore"):
                    continue
            dashboards.append({
                "id": f"dashboard.{dsh['dashboard']}", "k": "dashboard", "name": dsh["dashboard"],
                "label": dsh.get("title") or dsh["dashboard"], "d": clip(dsh.get("description"), lim["description_chars"]),
                "path": str(path.relative_to(root)), "inModel": path in in_model, "tiles": tiles,
                "lid": f"{L['model']}::{dsh['dashboard']}",
                "filters": [clip(f.get("title") or f.get("name") or "", 60) for f in (dsh.get("filters") or []) if isinstance(f, dict)],
            })
    return views, explores, dashboards, root



# --------------------------------------------------------------------------- warehouse (BigQuery)


def rel_key(rel, project, default_schema):
    """(project, dataset, table) for a relation string, or None."""
    if not rel:
        return None
    s = LIQUID.sub(default_schema, rel.replace("`", "")).strip().rstrip(";").strip()
    parts = [p for p in s.split(".") if p]
    if len(parts) == 2:
        parts = [project] + parts
    if len(parts) != 3 or not all(re.fullmatch(r"[A-Za-z0-9_\-]+", p) for p in parts):
        return None
    return tuple(parts)


def short_type(t):
    t = (t or "").strip()
    if t.startswith("STRUCT"):
        return "STRUCT"
    if t.startswith("ARRAY<STRUCT"):
        return "ARRAY<STRUCT>"
    return t if len(t) <= 40 else t[:39] + "…"


MAX_BYTES = "1000000000"  # every query is capped at 1 GB billed; the metadata queries bill about 10 MB each


def bq_json(args, timeout=240):
    r = subprocess.run(["bq", "--format=json", *args], capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        msg = (r.stdout or r.stderr or "").strip().splitlines()
        raise RuntimeError(msg[-1] if msg else f"bq exited {r.returncode}")
    out = r.stdout.strip()
    return json.loads(out) if out else []


def region_qualifier(location):
    return f"region-{location.lower()}"


def refresh_warehouse(cfg, keys):
    """Column lists and table facts for the tables the catalog references.

    Read-only metadata, no table data:
      - INFORMATION_SCHEMA.COLUMNS and COLUMN_FIELD_PATHS, one query each per project and region
        (about 10 MB billed each, capped by MAX_BYTES)
      - __TABLES__ per dataset for row counts, size and last modified (0 bytes billed)
    Needs bigquery.jobUser and bigquery.metadataViewer, nothing more."""
    W = cfg["warehouse"]
    billing = W["project"]
    max_nested = int(W.get("max_nested_fields", 30))
    by_ds = collections.defaultdict(set)
    for p, d, t in keys:
        by_ds[(p, d)].add(t)
    locations, errors = {}, {}
    for proj in sorted({p for p, _ in by_ds}):
        try:
            for r in bq_json([f"--project_id={proj}", "ls", "--max_results=100000"]):
                locations[(proj, r["datasetReference"]["datasetId"])] = r.get("location") or W.get("location") or ""
        except Exception as exc:  # noqa: BLE001
            errors[proj] = f"could not list datasets: {exc}"
    groups = collections.defaultdict(list)  # (project, location) -> datasets
    for ds in sorted(by_ds):
        if ds in locations:
            groups[(ds[0], locations[ds])].append(ds[1])
        else:
            errors[f"{ds[0]}.{ds[1]}"] = errors.get(ds[0]) or "dataset not found or no access"

    def run(loc, sql):
        return bq_json([f"--project_id={billing}", "query", "--nouse_legacy_sql", "--max_rows=1000000",
                        f"--maximum_bytes_billed={MAX_BYTES}", f"--location={loc}", sql])

    def read_region(key):
        proj, loc = key
        dsets = groups[key]
        names = sorted({t for d in dsets for t in by_ds[(proj, d)]})
        ds_in = ", ".join("'" + d + "'" for d in dsets)
        t_in = ", ".join("'" + n.replace("'", "") + "'" for n in names)
        def q(src, where_ds):
            cols = run(loc, f"SELECT table_schema, table_name, column_name, ordinal_position, data_type, is_partitioning_column, "
                            f"clustering_ordinal_position FROM {src}.COLUMNS WHERE {where_ds} table_name IN ({t_in})")
            paths = run(loc, f"SELECT table_schema, table_name, column_name, field_path, data_type, description FROM {src}.COLUMN_FIELD_PATHS "
                             f"WHERE {where_ds} table_name IN ({t_in}) AND (description IS NOT NULL OR field_path != column_name)")
            return cols, paths
        try:
            cols, paths = q(f"`{proj}`.`{region_qualifier(loc)}`.INFORMATION_SCHEMA", f"table_schema IN ({ds_in}) AND")
        except Exception:  # noqa: BLE001 - region views need project-level access; fall back to one dataset at a time
            cols, paths = [], []
            for d in dsets:
                c, pth = q(f"`{proj}.{d}`.INFORMATION_SCHEMA", "")
                cols += c
                paths += pth
        return key, cols, paths

    def read_tables(ds):
        proj, dset = ds
        t_in = ", ".join("'" + n.replace("'", "") + "'" for n in sorted(by_ds[ds]))
        try:
            return ds, run(locations[ds], f"SELECT table_id, row_count, size_bytes, last_modified_time, type "
                                          f"FROM `{proj}.{dset}.__TABLES__` WHERE table_id IN ({t_in})"), None
        except Exception as exc:  # noqa: BLE001
            return ds, [], str(exc)[:200]

    tables, missing = {}, []
    with ThreadPoolExecutor(max_workers=int(W.get("parallel", 6))) as pool:
        region_results = []
        for key in groups:
            region_results.append(pool.submit(read_region, key))
        table_results = list(pool.map(read_tables, [(p, d) for (p, _loc), ds in groups.items() for d in ds]))
    facts_errors = {}
    for fut in region_results:
        try:
            (proj, loc), cols, paths = fut.result()
        except Exception as exc:  # noqa: BLE001
            errors["region query"] = str(exc)[:300]
            continue
        desc = {(r["table_schema"], r["table_name"], r["field_path"]): r.get("description") for r in paths}
        nested = collections.defaultdict(list)
        for r in paths:
            if r["field_path"] != r["column_name"]:
                nested[(r["table_schema"], r["table_name"])].append([r["field_path"], short_type(r["data_type"]), r.get("description") or ""])
        for r in sorted(cols, key=lambda r: (r["table_schema"], r["table_name"], int(r.get("ordinal_position") or 9999))):
            k = f"{proj}.{r['table_schema']}.{r['table_name']}".lower()
            t = tables.setdefault(k, {"cols": [], "part": "", "clus": [], "_ds": (r["table_schema"], r["table_name"])})
            t["cols"].append([r["column_name"], short_type(r["data_type"]), desc.get((r["table_schema"], r["table_name"], r["column_name"])) or ""])
            if r.get("is_partitioning_column") == "YES":
                t["part"] = r["column_name"]
            if r.get("clustering_ordinal_position") not in (None, "", "NULL"):
                t["clus"].append((int(r["clustering_ordinal_position"]), r["column_name"]))
        for t in tables.values():
            if "_ds" in t:
                n = nested.get(t["_ds"], [])
                t["nested"], t["nestedTotal"] = n[:max_nested], len(n)
    for (proj, dset), rows, err in table_results:
        if err:
            facts_errors[f"{proj}.{dset}"] = err
        for r in rows:
            k = f"{proj}.{dset}.{r['table_id']}".lower()
            t = tables.setdefault(k, {"cols": [], "part": "", "clus": [], "nested": [], "nestedTotal": 0})
            t["rows"] = int(r.get("row_count") or 0)
            t["bytes"] = int(r.get("size_bytes") or 0)
            ms = int(r.get("last_modified_time") or 0)
            t["modified"] = dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).strftime("%Y-%m-%d") if ms else ""
            t["type"] = {"1": "table", "2": "view", "3": "external"}.get(str(r.get("type")), str(r.get("type")))
    for t in tables.values():
        t.pop("_ds", None)
        t["clus"] = [c for _, c in sorted(t["clus"])]
        t.setdefault("nested", [])
        t.setdefault("nestedTotal", 0)
    for (proj, dset), names in by_ds.items():
        if (proj, dset) not in locations:
            continue
        for name in names:
            if f"{proj}.{dset}.{name}".lower() not in tables:
                missing.append(f"{proj}.{dset}.{name}")
    if facts_errors:
        print(f"warning: row counts not read for {len(facts_errors)} datasets: {list(facts_errors)[:5]}", file=sys.stderr)
    return {"built": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "project": billing,
            "tables": tables, "errors": errors, "factsErrors": facts_errors, "missing": sorted(missing)}


def merge_warehouse(nodes, fields, wh, cfg, lim):
    project = cfg["warehouse"]["project"]
    default_schema = cfg["lookml"].get("default_schema", "")
    raw_kinds = set(cfg["warehouse"].get("names_and_types_only", []))
    stats = {"tables": 0, "cols": 0, "added": 0, "gone": 0}
    for n in nodes.values():
        if n["k"] not in ("model", "source", "seed", "snapshot", "table"):
            continue
        key = rel_key(n.get("rel"), project, default_schema)
        if not key:
            continue
        t = wh["tables"].get(".".join(key).lower())
        if not t:
            if any(".".join(key[:2]).lower() == e.lower() for e in wh.get("errors", {})):
                n["whErr"] = "unreadable"
            elif f"{key[0]}.{key[1]}.{key[2]}".lower() in {m.lower() for m in wh.get("missing", [])}:
                n["whErr"] = "missing"
            continue
        stats["tables"] += 1
        for k_in, k_out in (("rows", "rows"), ("bytes", "bytes"), ("modified", "modified"), ("type", "bqType")):
            if t.get(k_in) not in (None, ""):
                n[k_out] = t[k_in]
        if t.get("part") and not n.get("part"):
            n["part"] = t["part"]
        if t.get("clus") and not n.get("clus"):
            n["clus"] = ", ".join(t["clus"])
        if not t["cols"]:
            continue
        existing = collections.OrderedDict((c["n"].lower(), c) for c in n["cols"])
        brief = layer_of(n) in raw_kinds
        merged = []
        for name, ty, bqdesc in t["cols"]:
            c = existing.pop(name.lower(), None)
            if c is None:
                c = {"n": name, "d": "", "src": "warehouse"}
                stats["added"] += 1
            c["ty"] = ty.lower() if ty else c.get("ty", "")
            if not c.get("d") and bqdesc and not brief:
                c["d"] = clip(bqdesc, lim.get("column_description_chars", 220))
                c["dsrc"] = "bigquery"
            merged.append(c)
        for c in existing.values():
            c["gone"] = True
            stats["gone"] += 1
            merged.append(c)
        if not brief:
            for path, ty, bqdesc in t.get("nested", []):
                merged.append({"n": path, "ty": ty.lower(), "d": clip(bqdesc, lim.get("column_description_chars", 220)) if bqdesc else "",
                               "dsrc": "bigquery" if bqdesc else "", "src": "warehouse", "nest": 1})
            if t.get("nestedTotal", 0) > len(t.get("nested", [])):
                n["nestedMore"] = t["nestedTotal"] - len(t["nested"])
        for c in merged:
            own = bool(c.get("d")) and c.get("dsrc") != "bigquery"
            lookml = any(fields.get(f, {}).get("d") for f in c.get("used", []))
            c["doc"] = own or lookml
            if lookml and not c.get("d"):
                f = next(fields[f] for f in c["used"] if fields.get(f, {}).get("d"))
                c["d"] = clip(f["d"], lim.get("column_description_chars", 220))
                c["dsrc"] = "lookml"
        n["cols"] = merged
        n["wh"] = True
        stats["cols"] += len(t["cols"])
    return stats


def layer_of(n):
    return n.get("layer") or n["k"]


# --------------------------------------------------------------------------- build


def build(cfg, base, parse, refresh=False):
    lim = cfg.get("limits", {"model_sql_chars": 1600, "field_sql_chars": 500, "description_chars": 600})
    man = load_manifest(cfg, base, parse)
    dbt_nodes = build_dbt(man, cfg, lim)
    views, explores, dashboards, lk_root = load_lookml(cfg, base, lim)

    # relation (schema.table) -> dbt node
    by_rel = {}
    for n in dbt_nodes.values():
        if n["k"] == "source":
            parts = n["rel"].lower().split(".")
            by_rel.setdefault(".".join(parts[-2:]), n["id"])
        else:
            by_rel.setdefault(f"{n['schema']}.{n['alias']}", n["id"])
    by_alias = collections.defaultdict(list)
    for n in dbt_nodes.values():
        if n["k"] != "source":
            by_alias[n["alias"]].append(n["id"])

    def match_table(rel):
        if not rel:
            return None
        if rel in by_rel:
            return by_rel[rel]
        alias = rel.split(".")[-1]
        cands = by_alias.get(alias) or []
        return cands[0] if len(cands) == 1 else (cands[0] if cands else None)

    # ---- Looker view nodes and fields
    nodes = dict(dbt_nodes)
    fields = {}
    view_ids = {}
    externals = {}
    for v in views.values():
        vid = f"view.{v['name']}"
        view_ids[v["name"]] = vid
        up = []
        derived_tables = []
        if v.get("table"):
            m = match_table(v["table"])
            if m:
                up.append(m)
        if v.get("derived") and isinstance(v["derived"], str):
            sql = v["derived"]
            for t in re.findall(r"`?([A-Za-z0-9_\-]+\.)?([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)`?", sql):
                rel = f"{t[1]}.{t[2]}".lower()
                m = by_rel.get(rel)
                if m and m not in up:
                    up.append(m)
                    derived_tables.append(rel)
            for t in re.findall(r"\{\{[^}]*\}\}\.([A-Za-z0-9_]+)", sql):
                m = match_table(f"{cfg['lookml'].get('default_schema', '')}.{t}")
                if m and m not in up:
                    up.append(m)
            for vref in re.findall(r"\$\{([A-Za-z0-9_]+)\.SQL_TABLE_NAME\}", sql):
                if vref in views:
                    up.append(f"view.{vref}")
        for parent in v.get("extends", []) or []:
            if parent in views and f"view.{parent}" not in up:
                up.append(f"view.{parent}")
        nested_of = ""
        if not up and "__" in v["name"]:
            # a nested-array view (e.g. companies_dim__all_company_ids) reads its parent view's table
            parent = v["name"].rsplit("__", 1)[0]
            while parent and parent not in views and "__" in parent:
                parent = parent.rsplit("__", 1)[0]
            if parent in views:
                up.append(f"view.{parent}")
                nested_of = parent
        if not up and v.get("table") and not v.get("derived"):
            # a physical table dbt does not build: list it so the lineage still ends somewhere
            tid = f"table.{v['table']}"
            if tid not in externals:
                externals[tid] = {"id": tid, "k": "table", "layer": "external", "name": v["table"], "rel": v["sql_table_name"].strip().rstrip(";").strip().replace("`", ""),
                                  "d": "", "up": [], "dom": "", "tags": [], "cols": [], "tests": []}
            up.append(tid)
        nodes[vid] = {
            "id": vid, "k": "view", "layer": "view", "name": v["name"], "label": (v.get("label") or "").strip(),
            "d": clip(v.get("description"), lim["description_chars"]), "path": v["files"][0], "files": v["files"],
            "rel": v.get("sql_table_name", "").strip().rstrip(";").strip().replace("`", "") if v.get("sql_table_name") else "",
            "derived": sql_clip(v["derived"], lim["model_sql_chars"]) if isinstance(v.get("derived"), str) else "",
            "pdt": v.get("persisted", False), "up": up, "dom": "", "tags": [], "cols": [], "tests": [],
            "nested": nested_of,
        }
        colmap = collections.OrderedDict()
        for f in v["fields"].values():
            if f["kind"] in ("parameter", "filter"):
                kind = f["kind"]
            else:
                kind = f["kind"]
            fid = f"{v['name']}.{f['name']}"
            sql = f.get("sql")
            if sql is None and kind in ("dimension", "dimension_group"):
                sql = "${TABLE}." + f["name"]
            refs, cols, vrefs = field_refs(sql or "", v["name"])
            for extra in ("sql_start", "sql_end", "sql_distinct_key"):
                if f.get(extra):
                    r2, c2, _ = field_refs(f[extra], v["name"])
                    refs += [r for r in r2 if r not in refs]
                    cols += [c for c in c2 if c not in cols]
            for fl in measure_filters(f):
                ref = fl[0] if "." in fl[0] else f"{v['name']}.{fl[0]}"
                if ref not in refs:
                    refs.append(ref)
            ftype = f.get("type", "string" if kind == "dimension" else ("time" if kind == "dimension_group" else ""))
            # limits.hidden_fields: brief keeps hidden fields' names, types and references (so
            # lineage still works) but drops their description and SQL. Default: full.
            brief = f.get("hidden") == "yes" and lim.get("hidden_fields") == "brief"
            rec = {
                "id": fid, "k": "measure" if kind == "measure" else ("dimension" if kind in ("dimension", "dimension_group") else kind),
                "v": v["name"], "n": f["name"], "l": clip(f.get("label") or f.get("label_short") or "", 120),
                "ty": ftype, "d": "" if brief else clip(f.get("description"), lim["description_chars"]),
                "sql": sql_clip(sql, lim["field_sql_chars"]) if sql and not brief else "",
                "refs": refs, "cols": cols,
                "g": clip(f.get("group_label") or "", 80), "hid": f.get("hidden") == "yes",
                "fmt": f.get("value_format_name") or f.get("value_format") or "",
            }
            if kind == "dimension_group":
                rec["tf"] = f.get("timeframes") or (["raw", "date", "week", "month", "quarter", "year"] if ftype == "time" else [])
                rec["grp"] = True
            if kind == "dimension" and f.get("primary_key") == "yes":
                rec["pk"] = True
            mf = measure_filters(f)
            if mf:
                rec["flt"] = mf
            if f.get("tags"):
                rec["tags"] = f["tags"]
            if f.get("drill_fields"):
                pass
            fields[fid] = rec
            for c in cols:
                colmap.setdefault(c, []).append(fid)
        nodes[vid]["colUse"] = {c: u[:6] for c, u in colmap.items()}

    nodes.update(externals)

    # resolve refs to dimension groups (x_date -> x)
    group_of = {}
    for fid, f in fields.items():
        if f.get("grp"):
            for tf in f.get("tf", []) + list(TIMEFRAME_SUFFIXES):
                group_of[f"{fid}_{tf}"] = fid
    for f in fields.values():
        f["refs"] = list(dict.fromkeys(group_of.get(r, r) for r in f["refs"] if r != f["id"]))

    # ---- explores
    expl_out = {}
    for e in explores.values():
        eid = f"explore.{e['name']}"
        base_v = e["base"]
        joins = [{"a": base_v, "v": base_v, "base": True}]
        joins += [{**j, "on": j["on"], "refs": field_refs(j["on"], j["v"])[0]} for j in e["joins"].values()]
        alias_to_view = {j["a"]: j["v"] for j in joins}
        up = list(dict.fromkeys(f"view.{j['v']}" for j in joins if j["v"] in views))
        expl_out[eid] = {
            "id": eid, "k": "explore", "layer": "explore", "name": e["name"], "label": (e.get("label") or "").strip(),
            "d": clip(e.get("description"), lim["description_chars"]), "hidden": e.get("hidden") == "yes",
            "group": (e.get("group_label") or "").strip(), "base": base_v, "joins": joins, "a2v": alias_to_view,
            "rowLevel": e.get("rowLevel", False), "always": e.get("always", ""),
            "up": up, "dom": "", "tags": [], "path": e.get("file") or cfg["lookml"]["model_file"],
        }
    nodes.update(expl_out)

    # field -> explores (through any alias of its view)
    for ex in expl_out.values():
        for a, vname in ex["a2v"].items():
            for fid in [f for f in fields if fields[f]["v"] == vname]:
                fields[fid].setdefault("ex", [])
                if ex["name"] not in fields[fid]["ex"]:
                    fields[fid]["ex"].append(ex["name"])

    # ---- dashboards: resolve tile fields through explore aliases
    for d in dashboards:
        ex_used = []
        for t in d["tiles"]:
            ex = expl_out.get(f"explore.{t['x']}")
            a2v = ex["a2v"] if ex else {}
            resolved = []
            for f in t["f"]:
                if "." not in f:
                    continue
                a, n = f.split(".", 1)
                fid = f"{a2v.get(a, a)}.{n}"
                fid = group_of.get(fid, fid)
                resolved.append(fid)
                if fid in fields:
                    fields[fid].setdefault("dash", [])
                    if d["id"] not in fields[fid]["dash"]:
                        fields[fid]["dash"].append(d["id"])
            t["f"] = list(dict.fromkeys(resolved))
            if t["x"] not in ex_used:
                ex_used.append(t["x"])
        d["up"] = [f"explore.{x}" for x in ex_used if f"explore.{x}" in expl_out]
        d.update({"layer": "dashboard", "dom": "", "tags": []})
        nodes[d["id"]] = d

    # ---- columns: merge LookML-referenced columns into the dbt node behind each view
    for v in [n for n in nodes.values() if n["k"] == "view"]:
        if v.get("derived"):
            continue  # a derived table's columns belong to its SQL, not to the tables it reads
        tgt = next((u for u in v["up"] if u in dbt_nodes or u in externals), None)
        if not tgt:
            continue
        dn = nodes[tgt]
        have = {c["n"].lower() for c in dn["cols"]}
        for c in v["colUse"]:
            if c not in have:
                dn["cols"].append({"n": c, "ty": "", "d": "", "src": "lookml"})
                have.add(c)
        for c in dn["cols"]:
            if c["n"].lower() in v["colUse"]:
                c.setdefault("used", [])
                for fid in v["colUse"][c["n"].lower()]:
                    if fid not in c["used"]:
                        c["used"].append(fid)
                c["used"] = c["used"][:6]

    # ---- warehouse columns and table facts (INFORMATION_SCHEMA, cached in warehouse_snapshot.json)
    wh_meta = {}
    if cfg.get("warehouse"):
        cache = base / cfg["warehouse"].get("cache", "warehouse_snapshot.json")
        wh = None
        if refresh:
            keys = set()
            for n in nodes.values():
                if n["k"] in ("model", "source", "seed", "snapshot", "table"):
                    k = rel_key(n.get("rel"), cfg["warehouse"]["project"], cfg["lookml"].get("default_schema", ""))
                    if k:
                        keys.add(k)
            print(f"reading INFORMATION_SCHEMA for {len(keys)} tables in {len({k[:2] for k in keys})} datasets", file=sys.stderr)
            wh = refresh_warehouse(cfg, keys)
            cache.write_text(json.dumps(wh, indent=1))
        elif cache.exists():
            wh = json.loads(cache.read_text())
        if wh:
            st = merge_warehouse(nodes, fields, wh, cfg, lim)
            wh_meta = {"built": wh["built"], "tables": st["tables"], "cols": st["cols"], "added": st["added"], "gone": st["gone"],
                       "errors": wh.get("errors", {}), "missing": len(wh.get("missing", []))}
            print(f"warehouse: {st['tables']} tables matched, {st['cols']} columns, {st['added']} added, "
                  f"{st['gone']} documented but not in the warehouse; {len(wh.get('errors', {}))} datasets unreadable, "
                  f"{len(wh.get('missing', []))} tables not found", file=sys.stderr)

    # ---- domains
    down = collections.defaultdict(list)
    for n in nodes.values():
        for u in n.get("up", []):
            down[u].append(n["id"])

    def majority(ids):
        c = collections.Counter(nodes[i]["dom"] for i in ids if i in nodes and nodes[i].get("dom"))
        return c.most_common(1)[0][0] if c else ""

    # upstream models take the domain most of their consumers have (repeat to spread down the chain)
    for _ in range(6):
        for n in nodes.values():
            if n["k"] in ("model", "seed", "snapshot", "source") and not n["dom"]:
                n["dom"] = majority(down.get(n["id"], []))
    for _ in range(4):
        for n in nodes.values():
            if n["k"] == "view" and not n["dom"]:
                n["dom"] = majority(n["up"])
        for n in nodes.values():
            if n["k"] == "explore" and not n["dom"]:
                bv = nodes.get(f"view.{n['base']}")
                n["dom"] = (bv or {}).get("dom") or ""
        for n in nodes.values():
            if n["k"] in ("view", "table") and not n["dom"]:
                n["dom"] = majority(down.get(n["id"], []))
    kw = cfg.get("domain_keywords", {})

    def by_keyword(name):
        for dom, words in kw.items():
            if any(w in name for w in words):
                return dom
        return ""

    for n in nodes.values():
        if not n.get("dom") and n["k"] != "dashboard":
            n["dom"] = by_keyword(n["name"].lower())
    for _ in range(2):
        for n in nodes.values():
            if n["k"] in ("view", "explore", "table") and not n["dom"]:
                n["dom"] = majority(n["up"]) or majority(down.get(n["id"], []))
    for n in nodes.values():
        if n["k"] == "dashboard":
            n["dom"] = majority(n["up"])
    for n in nodes.values():
        if not n.get("dom"):
            n["dom"] = "other"
    for f in fields.values():
        f["dom"] = nodes.get(f"view.{f['v']}", {}).get("dom", "other")

    # ---- glossary
    glossary = []
    gpath = base / cfg.get("glossary", "glossary.yml")
    if gpath.exists():
        g = yaml.safe_load(gpath.read_text()) or {}
        for term in g.get("terms", []):
            metrics = [m for m in term.get("metrics", []) if m in fields]
            missing = [m for m in term.get("metrics", []) if m not in fields]
            if missing:
                print(f"warning: glossary term {term['term']!r}: unknown fields {missing}", file=sys.stderr)
            glossary.append({"t": term["term"], "d": term.get("definition", "").strip(), "m": metrics,
                             "st": term.get("status", "draft"), "cat": term.get("category", ""),
                             "aka": term.get("aliases", []), "dom": term.get("domain", ""), "own": term.get("owner", "")})
            for m in metrics:
                fields[m].setdefault("gl", []).append(term["term"])

    # ---- knowledge: data products, business rules, verified questions, synonyms
    knowledge = {}
    kpath = base / cfg.get("knowledge", "knowledge.yml")
    if kpath.exists():
        K = yaml.safe_load(kpath.read_text()) or {}
        pkg = cfg["dbt"]["package"]
        by_name = {}
        for n in nodes.values():
            if n["k"] in ("model", "seed", "snapshot", "source"):
                by_name.setdefault(n["name"], n["id"])

        def res(kind, ref, where):
            if kind == "table":
                rid = by_name.get(ref)
            elif kind == "explore":
                rid = f"explore.{ref}" if f"explore.{ref}" in nodes else None
            elif kind == "dashboard":
                rid = f"dashboard.{ref}" if f"dashboard.{ref}" in nodes else None
            else:
                rid = ref if ref in fields else None
            if not rid:
                print(f"warning: knowledge {where}: unknown {kind} {ref!r}", file=sys.stderr)
            return rid

        prods = []
        for p in K.get("data_products", []):
            w = f"data product {p['id']}"
            prods.append({
                "id": p["id"], "name": p["name"], "st": p.get("status", "draft"), "own": p.get("owner", ""),
                "sown": p.get("suggested_owner", ""), "d": clip(p.get("purpose", ""), 500), "use": p.get("used_for", []),
                "ref": p.get("refresh", ""),
                "assets": [x for x in ([res("table", t, w) for t in p.get("tables", [])] + [res("explore", t, w) for t in p.get("explores", [])]
                                        + [res("dashboard", t, w) for t in p.get("dashboards", [])]) if x],
                "m": [x for x in (res("metric", m, w) for m in p.get("metrics", [])) if x],
                "lds": [str(x) for x in p.get("looker_dashboards", [])],
            })
        rules = []
        for r in K.get("business_rules", []):
            w = f"rule {r['id']}"
            impl = []
            for it in r.get("implemented_in", []) or []:
                kind, ref = next(iter(it.items()))
                rid = res("metric" if kind == "lookml" else "table", ref, w) if kind in ("lookml", "dbt_model") else None
                impl.append({"k": kind, "ref": ref, "id": rid or "", "note": clip(it.get("note", ""), 200) if isinstance(it, dict) else ""})
            rules.append({"id": r["id"], "t": r["title"], "st": r.get("status", "draft"), "own": r.get("owner", ""),
                          "d": clip(r.get("rule", ""), 600), "why": clip(r.get("why", ""), 400), "cat": r.get("category", "calculation"),
                          "dom": r.get("domain", ""), "terms": r.get("terms", []),
                          "m": [x for x in (res("metric", m, w) for m in r.get("metrics", [])) if x],
                          "a": [x for x in ([res("table", t, w) for t in r.get("tables", [])] + [res("dashboard", t, w) for t in r.get("dashboards", [])]) if x],
                          "lds": [str(x) for x in r.get("looker_dashboards", [])],
                          "impl": impl, "tests": r.get("tested_by", []), "src": r.get("source", "")})
        qs = []
        for i, q in enumerate(K.get("verified_questions", [])):
            w = f"question {i + 1}"
            qs.append({"id": f"q{i + 1}", "q": q["q"], "st": q.get("status", "draft"), "a": clip(q.get("answer", ""), 400),
                       "m": res("metric", q["metric"], w) if q.get("metric") else "",
                       "x": res("explore", q["explore"], w) if q.get("explore") else "",
                       "dsh": res("dashboard", q["dashboard"], w) if q.get("dashboard") else "",
                       "ld": str(q.get("looker_dashboard", "")) if q.get("looker_dashboard") else "",
                       "also": q.get("also", [])})
        knowledge = {"products": prods, "rules": rules, "questions": qs, "syn": K.get("synonyms", []),
                     "presets": K.get("graph_presets", [])}
        known_tests = {t["d"] for n in nodes.values() for t in n.get("tests", []) if t.get("t") == "assert"}
        for r in rules:
            for t in r["tests"]:
                if t not in known_tests:
                    print(f"warning: rule {r['id']}: test {t!r} not found in the dbt project", file=sys.stderr)
        terms_known = {g["t"] for g in glossary}
        for r in rules:
            for t in r["terms"]:
                if t not in terms_known:
                    print(f"warning: rule {r['id']}: unknown glossary term {t!r}", file=sys.stderr)

    # recent changes in the repos (dates only)
    lk_changes = git_changes(lk_root)
    dbt_root = cfg_path(base, cfg["dbt"], "project")
    dbt_changes = git_changes(dbt_root)
    for n in nodes.values():
        p = n.get("path") or ""
        when = (dbt_changes if n["k"] in ("model", "seed", "snapshot", "source") else lk_changes).get(p, "")
        if when and n["k"] != "explore":
            n["chg"] = when

    # ---- brand, client, fonts
    client = dict(cfg["client"])
    for key in ("logo_svg", "mark_svg"):
        if client.get(key) and not (base / client[key]).exists():
            print(f"warning: {key} not found: {client[key]}", file=sys.stderr)
            client[key] = ""
        if client.get(key):
            svg = (base / client[key]).read_text()
            svg = re.sub(r"<\?xml[^>]*>|<!--.*?-->", "", svg, flags=re.S)
            client[key] = re.sub(r">\s+<", "><", svg).strip()
    brand = {k: v for k, v in cfg["brand"].items() if k != "fonts"}
    brand["display"] = (cfg["brand"].get("fonts") or {}).get("display", "")
    brand["heading"] = (cfg["brand"].get("fonts") or {}).get("heading", "")

    # slim nodes
    for n in nodes.values():
        n.pop("colUse", None)
        n.pop("a2v", None) if n["k"] != "explore" else None
        for k in [k for k, v in list(n.items()) if v in ("", [], None, False) and k not in ("up", "k", "id", "name", "dom", "layer")]:
            n.pop(k)
    for f in fields.values():
        for k in ("id", "dom", "ex"):  # the app rebuilds these from v, n and the explores
            f.pop(k, None)
        for k in [k for k, v in list(f.items()) if v in ("", [], None, False) and k not in ("k", "v", "n")]:
            f.pop(k)
    for n in nodes.values():
        for c in n.get("cols", []) or []:
            if c.get("src") == "warehouse":
                c.pop("src")
            for k in [k for k, v in list(c.items()) if v in ("", [], None, False) and k != "n"]:
                c.pop(k)

    return {
        "v": 1,
        "built": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "client": client, "brand": brand, "model": cfg["lookml"]["model"],
        "repos": {"lookml": git_info(lk_root), "dbt": git_info(cfg_path(base, cfg["dbt"], "project"))},
        "warehouse": wh_meta,
        "usage": {"show_people": bool((cfg.get("usage") or {}).get("show_people", False)),
                  "days": int((cfg.get("usage") or {}).get("days", 90))},
        "search": {k: v for k, v in (cfg.get("search") or {}).items()
                   if k in ("examples", "column_example", "sql_example", "filter_examples")},
        "domains": cfg.get("domains", []),
        "nodes": list(nodes.values()),
        "fields": list(fields.values()),
        "glossary": glossary,
        "knowledge": knowledge,
    }


# --------------------------------------------------------------------------- BigQuery load


def ts(date):
    return f"{date}T00:00:00Z" if date and len(date) == 10 else (date or None)


def bq_rows(data, packed, build_id, built_at):
    """Rows for the six data_apps tables, from the snapshot."""
    N = {n["id"]: n for n in data["nodes"]}
    down = collections.Counter(u for n in data["nodes"] for u in n.get("up", []))
    K = data.get("knowledge") or {}
    prod_of = collections.defaultdict(list)
    for p in K.get("products", []):
        for a in p["assets"] + p["m"]:
            prod_of[a].append(p["name"])
    term_of = collections.defaultdict(list)
    for t in data.get("glossary", []):
        for m in t["m"]:
            term_of[m].append(t["t"])
    js = lambda x: json.dumps(x, ensure_ascii=False)  # noqa: E731
    layer = lambda n: n.get("layer") or n["k"]  # noqa: E731
    chunk = 100000
    parts = [packed[i:i + chunk] for i in range(0, len(packed), chunk)]
    snap = [{"build_id": build_id, "built_at": built_at, "client": data["client"].get("name", ""),
             "source_versions": js({**data["repos"], "warehouse": (data.get("warehouse") or {}).get("built", "")}),
             "chunk_index": i, "chunk_count": len(parts), "chunk": c} for i, c in enumerate(parts)]
    assets, cols, lineage = [], [], []
    for n in data["nodes"]:
        assets.append({
            "build_id": build_id, "built_at": built_at, "asset_id": n["id"], "asset_type": n["k"], "name": n["name"],
            "label": n.get("label") or "", "domain": n.get("dom", ""), "layer": layer(n), "description": n.get("d", ""),
            "is_documented": bool(n.get("d")), "warehouse_table": n.get("rel", ""), "row_count": n.get("rows"),
            "size_bytes": n.get("bytes"), "last_modified": ts(n.get("modified")), "upstream_count": len(n.get("up", [])),
            "downstream_count": down.get(n["id"], 0), "data_product": ", ".join(dict.fromkeys(prod_of.get(n["id"], []))),
            "owner": n.get("owner", "")})
        for c in n.get("cols", []) or []:
            tests = [t["t"] for t in n.get("tests", []) if (t.get("c") or "").lower() == c["n"].lower()]
            cols.append({"build_id": build_id, "asset_id": n["id"], "column_name": c["n"], "data_type": c.get("ty", ""),
                         "description": c.get("d", ""), "description_source": c.get("dsrc") or ("dbt" if c.get("d") else ""),
                         "is_documented": bool(c.get("doc")), "in_warehouse": bool(n.get("wh")) and not c.get("gone"),
                         "dbt_tests": js(tests), "looker_fields": js(c.get("used", []))})
        for u in n.get("up", []):
            lineage.append({"build_id": build_id, "from_asset_id": u, "to_asset_id": n["id"],
                            "link_type": f"{N[u]['k'] if u in N else 'asset'}_to_{n['k']}"})
    metrics = []
    for f in data["fields"]:
        if f["k"] != "measure":
            continue
        fid = f"{f['v']}.{f['n']}"
        metrics.append({"build_id": build_id, "field_id": fid, "label": f.get("l", ""), "view_name": f["v"],
                        "measure_type": f.get("ty", ""), "value_format": f.get("fmt", ""), "description": f.get("d", ""),
                        "is_documented": bool(f.get("d")), "sql": f.get("sql", ""),
                        "explores": js([x["name"] for x in data["nodes"] if x["k"] == "explore" and f["v"] in {j["v"] for j in x.get("joins", [])}]),
                        "dashboards": js(f.get("dash", [])), "glossary_terms": js(term_of.get(fid, []))})
    know = []
    for t in data.get("glossary", []):
        know.append({"build_id": build_id, "entry_id": f"term:{t['t']}", "entry_type": "glossary_term", "title": t["t"],
                     "body": t["d"], "owner": t.get("own", ""), "status": t.get("st", "draft"), "linked_assets": js(t["m"])})
    for p in K.get("products", []):
        know.append({"build_id": build_id, "entry_id": f"product:{p['id']}", "entry_type": "data_product", "title": p["name"],
                     "body": p["d"], "owner": p.get("own") or "", "status": p.get("st", "draft"),
                     "linked_assets": js(p["assets"] + p["m"] + [f"udd.{x}" for x in p.get("lds", [])])})
    for r in K.get("rules", []):
        know.append({"build_id": build_id, "entry_id": f"rule:{r['id']}", "entry_type": "business_rule", "title": r["t"],
                     "body": r["d"], "owner": r.get("own", ""), "status": r.get("st", "draft"), "linked_assets": js(r["m"])})
    for q in K.get("questions", []):
        know.append({"build_id": build_id, "entry_id": f"question:{q['id']}", "entry_type": "verified_question", "title": q["q"],
                     "body": q["a"], "owner": "", "status": q.get("st", "draft"),
                     "linked_assets": js([x for x in (q.get("m"), q.get("x") and f"explore.{q['x']}", q.get("dsh"), q.get("ld") and f"udd.{q['ld']}") if x])})
    return {"catalog_snapshot": snap, "catalog_assets": assets, "catalog_columns": cols, "catalog_lineage": lineage,
            "catalog_metrics": metrics, "knowledge_entries": know}


def load_bigquery(cfg, data, packed):
    """Append the new snapshot build, keep the newest 7, and replace the five detail tables.
    Load jobs are free; the one DELETE is capped at MAX_BYTES. Writes only to the data_apps dataset."""
    B = cfg["bigquery"]
    project, dataset, loc = B["project"], B["dataset"], B.get("location", "")
    build_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    built_at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = bq_rows(data, packed, build_id, built_at)
    work = Path(tempfile.mkdtemp(prefix="catalog_load_"))
    loc_flag = [f"--location={loc}"] if loc else []
    try:
        for table, recs in rows.items():
            f = work / f"{table}.json"
            f.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in recs))
            mode = [] if table == "catalog_snapshot" else ["--replace"]
            cmd = ["bq", f"--project_id={project}", *loc_flag, "load", "--source_format=NEWLINE_DELIMITED_JSON", *mode,
                   f"{project}:{dataset}.{table}", str(f)]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode != 0:
                sys.exit(f"bq load {table} failed: {(r.stdout or r.stderr).strip()[-600:]}")
            print(f"loaded {table}: {len(recs)} rows", file=sys.stderr)
        keep = int(B.get("keep_builds", 7))
        tbl = f"`{project}.{dataset}.catalog_snapshot`"
        sql = (f"DELETE FROM {tbl} WHERE build_id NOT IN (SELECT build_id FROM (SELECT build_id, MAX(built_at) AS b "
               f"FROM {tbl} GROUP BY build_id) ORDER BY b DESC LIMIT {keep})")
        r = subprocess.run(["bq", f"--project_id={project}", *loc_flag, "query", "--nouse_legacy_sql",
                            f"--maximum_bytes_billed={MAX_BYTES}", sql], capture_output=True, text=True)
        if r.returncode != 0:
            print(f"warning: could not delete old builds: {(r.stdout or r.stderr).strip()[-300:]}", file=sys.stderr)
        return build_id, {t: len(v) for t, v in rows.items()}
    finally:
        shutil.rmtree(work, ignore_errors=True)


def pack(payload: str) -> str:
    return base64.b64encode(gzip.compress(payload.encode(), compresslevel=9, mtime=0)).decode()


LATIN = "U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026,U+2190-2193"


def subset_font(raw: bytes) -> bytes:
    """Latin-only woff2 subset of a TTF or OTF, so a heavy cut costs about 13 KB (needs fonttools and brotli)."""
    import io
    from fontTools import subset
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga"]
    opts.hinting = False
    opts.desubroutinize = True
    font = subset.load_font(io.BytesIO(raw), opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(LATIN))
    sub.subset(font)
    out = io.BytesIO()
    subset.save_font(font, out, opts)
    return out.getvalue()


def font_css(cfg, base) -> str:
    rules = []
    for f in (cfg["brand"].get("fonts") or {}).get("files", []):
        if not (base / f["file"]).exists():
            print(f"warning: font not found, skipped: {f['file']}", file=sys.stderr)
            continue
        raw = (base / f["file"]).read_bytes()
        fmt = "woff2" if f["file"].endswith("woff2") else "woff"
        if f.get("subset"):
            raw, fmt = subset_font(raw), "woff2"
        data = base64.b64encode(raw).decode()
        rules.append(f"@font-face{{font-family:'{f['family']}';font-weight:{f['weight']};font-style:normal;font-display:swap;"
                     f"src:url(data:font/{fmt};base64,{data}) format('{fmt}');}}")
    return "".join(rules)


def minify(text: str) -> str:
    """Safe size trim for the published app: drop indentation, blank lines and comment-only lines,
    and CSS block comments inside the style template. String and template contents are otherwise untouched."""
    out = []
    in_block = False
    lines = text.split("\n")
    if lines and lines[0].startswith("/**"):  # keep the JSDoc header byte for byte (the publisher reads its tags)
        end = next(i for i, x in enumerate(lines) if x.strip().endswith("*/"))
        out, lines = lines[: end + 1], lines[end + 1:]
    for line in lines:
        t = line.strip()
        if in_block:
            if "*/" in t:
                in_block = False
            continue
        if not t or t.startswith("//"):
            continue
        if t.startswith("/*") and not t.startswith("/**") and "@" not in t:
            if "*/" not in t:
                in_block = True
            continue
        out.append(t)
    return "\n".join(out) + "\n"


def inject(app: Path, start: str, end: str, payload: str) -> None:
    text = app.read_text()
    a, b = text.index(start), text.index(end)
    app.write_text(text[: a + len(start)] + " " + json.dumps(payload) + " " + text[b:])


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", required=True)
    ap.add_argument("--parse", action="store_true", help="run dbt deps + dbt parse on a temporary copy")
    ap.add_argument("--refresh-warehouse", action="store_true",
                    help="read column lists and table facts from BigQuery INFORMATION_SCHEMA (needs bq login) and refresh the cache")
    ap.add_argument("--load-bigquery", action="store_true",
                    help="load the snapshot and detail tables into the BigQuery dataset in the config (bigquery: section)")
    ap.add_argument("--inject", help="app.js to inject the snapshot and fonts into")
    ap.add_argument("--out", help="also write the readable JSON snapshot here")
    ap.add_argument("--source", help="readable app source; with --inject, the builder writes a trimmed copy to the --inject path")
    args = ap.parse_args()
    cfg_path = Path(args.config).resolve()
    cfg = yaml.safe_load(cfg_path.read_text())
    base = cfg_path.parent
    data = build(cfg, base, args.parse, args.refresh_warehouse)
    payload = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    packed = pack(payload)
    counts = collections.Counter(n["k"] for n in data["nodes"])
    print(f"nodes: {dict(counts)}  fields: {len(data['fields'])}  glossary: {len(data['glossary'])}")
    print(f"snapshot: {len(payload):,} bytes raw, {len(packed):,} bytes packed")
    out = Path(args.out) if args.out else base / "catalog_metadata.json"
    out.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    if args.load_bigquery:
        build_id, counts = load_bigquery(cfg, data, packed)
        print(f"bigquery build {build_id}: {counts}")
    if args.inject:
        app = Path(args.inject)
        if args.source:
            app.write_text(minify(Path(args.source).read_text()))
        inject(app, MARK_START, MARK_END, packed)
        inject(app, FONT_START, FONT_END, font_css(cfg, base))
        size = app.stat().st_size
        print(f"app: {app} {size:,} bytes ({size / APP_LIMIT:.0%} of the 900 KB limit)")
        if size > APP_LIMIT:
            sys.exit("app is over Looker's 900 KB limit; lower the limits in the config")


if __name__ == "__main__":
    main()
