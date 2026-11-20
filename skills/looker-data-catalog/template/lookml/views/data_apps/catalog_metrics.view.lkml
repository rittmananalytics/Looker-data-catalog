# catalog_metrics.view.lkml
# Looker metrics (measures) from the latest catalog build.
# Table: {{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_metrics

view: catalog_metrics {
  sql_table_name: `{{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_metrics` ;;

  dimension: field_id {
    primary_key: yes
    description: "Looker field name, view.field."
    type: string
    sql: ${TABLE}.field_id ;;
  }

  dimension: label {
    type: string
    sql: ${TABLE}.label ;;
  }

  dimension: view_name {
    type: string
    sql: ${TABLE}.view_name ;;
  }

  dimension: measure_type {
    type: string
    sql: ${TABLE}.measure_type ;;
  }

  dimension: value_format {
    type: string
    sql: ${TABLE}.value_format ;;
  }

  dimension: description {
    type: string
    sql: ${TABLE}.description ;;
  }

  dimension: is_documented {
    type: yesno
    sql: ${TABLE}.is_documented ;;
  }

  dimension: sql {
    label: "SQL"
    type: string
    sql: ${TABLE}.sql ;;
  }

  dimension: explores {
    description: "Explores the metric appears in."
    type: string
    sql: ${TABLE}.explores ;;
  }

  dimension: dashboards {
    description: "LookML dashboards that show the metric."
    type: string
    sql: ${TABLE}.dashboards ;;
  }

  dimension: glossary_terms {
    type: string
    sql: ${TABLE}.glossary_terms ;;
  }

  measure: count {
    label: "Metrics"
    type: count
  }

  measure: documented_count {
    label: "Documented metrics"
    type: count
    filters: [is_documented: "yes"]
  }
}
