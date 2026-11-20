# catalog_assets.view.lkml
# Catalog assets from the latest build: sources, dbt models, Looker views, explores and dashboards.
# Table: {{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_assets

view: catalog_assets {
  sql_table_name: `{{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_assets` ;;

  dimension: asset_id {
    primary_key: yes
    description: "Unique id of the asset in the catalog."
    type: string
    sql: ${TABLE}.asset_id ;;
  }

  dimension: build_id {
    hidden: yes
    type: string
    sql: ${TABLE}.build_id ;;
  }

  dimension_group: built {
    description: "When the catalog build ran."
    type: time
    timeframes: [raw, time, date]
    sql: ${TABLE}.built_at ;;
  }

  dimension: asset_type {
    description: "Source, staging, integration or warehouse model, Looker view, explore or dashboard."
    type: string
    sql: ${TABLE}.asset_type ;;
  }

  dimension: name {
    type: string
    sql: ${TABLE}.name ;;
  }

  dimension: label {
    type: string
    sql: ${TABLE}.label ;;
  }

  dimension: domain {
    description: "Business area the asset belongs to."
    type: string
    sql: ${TABLE}.domain ;;
  }

  dimension: layer {
    description: "dbt layer, or Looker for views, explores and dashboards."
    type: string
    sql: ${TABLE}.layer ;;
  }

  dimension: description {
    type: string
    sql: ${TABLE}.description ;;
  }

  dimension: is_documented {
    description: "Yes when the asset has a description."
    type: yesno
    sql: ${TABLE}.is_documented ;;
  }

  dimension: warehouse_table {
    description: "BigQuery table the asset reads or builds."
    type: string
    sql: ${TABLE}.warehouse_table ;;
  }

  dimension: row_count {
    type: number
    sql: ${TABLE}.row_count ;;
  }

  dimension: size_bytes {
    type: number
    sql: ${TABLE}.size_bytes ;;
  }

  dimension_group: last_modified {
    description: "When BigQuery last changed the table."
    type: time
    timeframes: [raw, time, date]
    sql: ${TABLE}.last_modified ;;
  }

  dimension: upstream_count {
    type: number
    sql: ${TABLE}.upstream_count ;;
  }

  dimension: downstream_count {
    type: number
    sql: ${TABLE}.downstream_count ;;
  }

  dimension: data_product {
    description: "Data product the asset is part of, if any."
    type: string
    sql: ${TABLE}.data_product ;;
  }

  dimension: owner {
    type: string
    sql: ${TABLE}.owner ;;
  }

  measure: count {
    label: "Assets"
    type: count
  }

  measure: documented_count {
    label: "Documented assets"
    type: count
    filters: [is_documented: "yes"]
  }

  measure: documented_share {
    label: "Share documented"
    type: number
    value_format_name: percent_0
    sql: SAFE_DIVIDE(${documented_count}, ${count}) ;;
  }
}
