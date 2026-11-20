# catalog_columns.view.lkml
# Columns of catalog assets from the latest build, from dbt, LookML and BigQuery INFORMATION_SCHEMA.
# Table: {{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_columns

view: catalog_columns {
  sql_table_name: `{{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_columns` ;;

  dimension: pk {
    primary_key: yes
    hidden: yes
    type: string
    sql: CONCAT(${TABLE}.asset_id, '|', ${TABLE}.column_name) ;;
  }

  dimension: asset_id {
    hidden: yes
    type: string
    sql: ${TABLE}.asset_id ;;
  }

  dimension: column_name {
    type: string
    sql: ${TABLE}.column_name ;;
  }

  dimension: data_type {
    type: string
    sql: ${TABLE}.data_type ;;
  }

  dimension: description {
    type: string
    sql: ${TABLE}.description ;;
  }

  dimension: description_source {
    description: "Where the description comes from: dbt, Looker field or BigQuery."
    type: string
    sql: ${TABLE}.description_source ;;
  }

  dimension: is_documented {
    type: yesno
    sql: ${TABLE}.is_documented ;;
  }

  dimension: in_warehouse {
    description: "Yes when the column exists in the BigQuery table."
    type: yesno
    sql: ${TABLE}.in_warehouse ;;
  }

  dimension: dbt_tests {
    type: string
    sql: ${TABLE}.dbt_tests ;;
  }

  dimension: looker_fields {
    description: "Looker fields that read this column."
    type: string
    sql: ${TABLE}.looker_fields ;;
  }

  measure: count {
    label: "Columns"
    type: count
  }

  measure: documented_count {
    label: "Documented columns"
    type: count
    filters: [is_documented: "yes"]
  }

  measure: documented_share {
    label: "Share of columns documented"
    type: number
    value_format_name: percent_0
    sql: SAFE_DIVIDE(${documented_count}, ${count}) ;;
  }
}
