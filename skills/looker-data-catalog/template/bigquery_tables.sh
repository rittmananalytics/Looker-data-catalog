#!/usr/bin/env bash
# Creates the dataset and tables the Data Catalog loads into. Run once per client, by a person
# with rights to create a dataset. Empty tables cost nothing.
set -euo pipefail
D={{BQ_PROJECT}}:{{BQ_DATASET}}
bq --location={{BQ_LOCATION}} mk --dataset --description "Content for the {{CLIENT_NAME}} Data Catalog Looker Data App. Written by catalog_builder; read by Looker." $D
bq mk --table --description "One row per chunk of one catalog build (gzip, base64). The app loads the latest build." --time_partitioning_field built_at --time_partitioning_type DAY $D.catalog_snapshot build_id:STRING,built_at:TIMESTAMP,client:STRING,source_versions:STRING,chunk_index:INT64,chunk_count:INT64,chunk:STRING
bq mk --table --description "Catalog assets from the latest build." $D.catalog_assets build_id:STRING,built_at:TIMESTAMP,asset_id:STRING,asset_type:STRING,name:STRING,label:STRING,domain:STRING,layer:STRING,description:STRING,is_documented:BOOL,warehouse_table:STRING,row_count:INT64,size_bytes:INT64,last_modified:TIMESTAMP,upstream_count:INT64,downstream_count:INT64,data_product:STRING,owner:STRING
bq mk --table --description "Columns of catalog assets from the latest build." $D.catalog_columns build_id:STRING,asset_id:STRING,column_name:STRING,data_type:STRING,description:STRING,description_source:STRING,is_documented:BOOL,in_warehouse:BOOL,dbt_tests:STRING,looker_fields:STRING
bq mk --table --description "Lineage links between catalog assets from the latest build." $D.catalog_lineage build_id:STRING,from_asset_id:STRING,to_asset_id:STRING,link_type:STRING
bq mk --table --description "Looker measures from the latest build." $D.catalog_metrics build_id:STRING,field_id:STRING,label:STRING,view_name:STRING,measure_type:STRING,value_format:STRING,description:STRING,is_documented:BOOL,sql:STRING,explores:STRING,dashboards:STRING,glossary_terms:STRING
bq mk --table --description "Knowledge entries from the latest build: glossary terms, data products, business rules, verified questions." $D.knowledge_entries build_id:STRING,entry_id:STRING,entry_type:STRING,title:STRING,body:STRING,owner:STRING,status:STRING,linked_assets:STRING
bq ls $D
