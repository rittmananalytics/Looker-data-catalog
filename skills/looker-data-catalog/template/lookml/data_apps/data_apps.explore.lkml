# data_apps.explore.lkml
# Explores read by the Data Catalog Looker Data App.
# Tables live in {{BQ_PROJECT}}.{{BQ_DATASET}} and are rewritten by catalog_builder
# each day. The cache clears when a new build lands.

include: "/views/data_apps/*.view.lkml"

datagroup: data_apps_catalog_build {
  sql_trigger: SELECT MAX(built_at) FROM `{{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_snapshot` ;;
  max_cache_age: "24 hours"
}

explore: catalog_snapshot {
  group_label: "Data apps"
  label: "Catalog snapshot"
  description: "The full catalog snapshot the Data Catalog app loads. One row per chunk."
  persist_with: data_apps_catalog_build
}

explore: catalog_assets {
  group_label: "Data apps"
  label: "Catalog assets"
  description: "Tables, views, explores and dashboards in the data catalog, with their columns."
  persist_with: data_apps_catalog_build

  join: catalog_columns {
    type: left_outer
    relationship: one_to_many
    sql_on: ${catalog_assets.asset_id} = ${catalog_columns.asset_id} ;;
  }
}

explore: catalog_lineage {
  group_label: "Data apps"
  label: "Catalog lineage"
  persist_with: data_apps_catalog_build

  join: from_asset {
    from: catalog_assets
    type: left_outer
    relationship: many_to_one
    sql_on: ${catalog_lineage.from_asset_id} = ${from_asset.asset_id} ;;
  }

  join: to_asset {
    from: catalog_assets
    type: left_outer
    relationship: many_to_one
    sql_on: ${catalog_lineage.to_asset_id} = ${to_asset.asset_id} ;;
  }
}

explore: catalog_metrics {
  group_label: "Data apps"
  label: "Catalog metrics"
  persist_with: data_apps_catalog_build
}

explore: knowledge_entries {
  group_label: "Data apps"
  label: "Knowledge entries"
  persist_with: data_apps_catalog_build
}
