# catalog_lineage.view.lkml
# Lineage links between catalog assets from the latest build.
# Table: {{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_lineage

view: catalog_lineage {
  sql_table_name: `{{BQ_PROJECT}}.{{BQ_DATASET}}.catalog_lineage` ;;

  dimension: pk {
    primary_key: yes
    hidden: yes
    type: string
    sql: CONCAT(${TABLE}.from_asset_id, '>', ${TABLE}.to_asset_id, '|', ${TABLE}.link_type) ;;
  }

  dimension: from_asset_id {
    description: "The asset data flows from."
    type: string
    sql: ${TABLE}.from_asset_id ;;
  }

  dimension: to_asset_id {
    description: "The asset data flows to."
    type: string
    sql: ${TABLE}.to_asset_id ;;
  }

  dimension: link_type {
    description: "How the two assets are linked, for example dbt ref, Looker view table or explore join."
    type: string
    sql: ${TABLE}.link_type ;;
  }

  measure: count {
    label: "Links"
    type: count
  }
}
