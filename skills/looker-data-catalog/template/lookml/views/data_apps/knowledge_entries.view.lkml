# knowledge_entries.view.lkml
# Knowledge catalog entries: glossary terms, data products, business rules and verified questions.
# Table: {{BQ_PROJECT}}.{{BQ_DATASET}}.knowledge_entries

view: knowledge_entries {
  sql_table_name: `{{BQ_PROJECT}}.{{BQ_DATASET}}.knowledge_entries` ;;

  dimension: entry_id {
    primary_key: yes
    type: string
    sql: ${TABLE}.entry_id ;;
  }

  dimension: entry_type {
    description: "Glossary term, data product, business rule or verified question."
    type: string
    sql: ${TABLE}.entry_type ;;
  }

  dimension: title {
    type: string
    sql: ${TABLE}.title ;;
  }

  dimension: body {
    type: string
    sql: ${TABLE}.body ;;
  }

  dimension: owner {
    type: string
    sql: ${TABLE}.owner ;;
  }

  dimension: status {
    description: "Draft or approved."
    type: string
    sql: ${TABLE}.status ;;
  }

  dimension: linked_assets {
    description: "Catalog assets the entry links to, as JSON."
    type: string
    sql: ${TABLE}.linked_assets ;;
  }

  measure: count {
    label: "Entries"
    type: count
  }
}
