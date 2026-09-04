-- One normalized line per schema object, so two databases can be compared with
-- `comm` instead of by diffing pg_dump output — that text differs in ordering,
-- ownership and formatting even when the schemas are identical.
--
-- Deliberately excluded: the `migrations` table's contents (bookkeeping, not
-- schema) and anything outside the current schema.
\pset tuples_only on
\pset format unaligned

select 'TABLE|' || table_name
from information_schema.tables
where table_schema = current_schema() and table_type = 'BASE TABLE'

union all
select 'COLUMN|' || table_name || '.' || column_name || '|' || data_type || '|' || is_nullable
from information_schema.columns
where table_schema = current_schema()

union all
select 'INDEX|' || tablename || '|' || indexname
from pg_indexes
where schemaname = current_schema()

union all
select 'FK|' || table_name || '|' || constraint_name
from information_schema.table_constraints
where table_schema = current_schema() and constraint_type = 'FOREIGN KEY'

union all
select 'SEQ|' || sequence_name
from information_schema.sequences
where sequence_schema = current_schema()

order by 1;
