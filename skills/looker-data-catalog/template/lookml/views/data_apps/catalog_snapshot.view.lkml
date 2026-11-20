# catalog_snapshot.view.lkml
# The full Data Catalog snapshot, written by catalog_builder each build.
# Table: {{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_snapshot (partitioned by built_at)
# The Data Catalog app loads every chunk of the latest build in one query.

view: catalog_snapshot {
  sql_table_name: `{{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_snapshot` ;;

  dimension: pk {
    primary_key: yes
    hidden: yes
    type: string
    sql: CONCAT(${TABLE}.build_id, '|', CAST(${TABLE}.chunk_index AS STRING)) ;;
  }

  dimension: build_id {
    description: "Identifier of one catalog build."
    type: string
    sql: ${TABLE}.build_id ;;
  }

  dimension_group: built {
    description: "When the catalog build ran."
    type: time
    timeframes: [raw, time, date]
    sql: ${TABLE}.built_at ;;
  }

  dimension: is_latest_build {
    description: "Yes for the rows of the most recent build."
    type: yesno
    sql: ${TABLE}.build_id = (
           SELECT build_id FROM `{{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_snapshot`
           ORDER BY built_at DESC LIMIT 1) ;;
  }

  dimension: client {
    description: "Client the catalog was built for."
    type: string
    sql: ${TABLE}.client ;;
  }

  dimension: source_versions {
    description: "Repos and commits the build read, as JSON."
    type: string
    sql: ${TABLE}.source_versions ;;
  }

  dimension: chunk_index {
    description: "Position of this chunk in the snapshot, from 0."
    type: number
    sql: ${TABLE}.chunk_index ;;
  }

  dimension: chunk_count {
    description: "Number of chunks in the build."
    type: number
    sql: ${TABLE}.chunk_count ;;
  }

  dimension: chunk {
    description: "Part of the gzip-compressed, base64-encoded snapshot JSON."
    type: string
    sql: ${TABLE}.chunk ;;
  }

  measure: count {
    type: count
  }
}
