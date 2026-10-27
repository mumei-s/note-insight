#!/usr/bin/env bash
# Administrative, resumable v1 backfill. libpq PG* / PGSERVICE / PGPASSFILE only;
# never embed or print credentials. No notification data is printed.
set -euo pipefail
if [[ -z "${PGDATABASE:-}${PGSERVICE:-}" ]]; then
  printf '%s\n' 'Set PGDATABASE or PGSERVICE and the remaining libpq connection settings.' >&2
  exit 1
fi
batch_size=${INSIGHT_PREPARED_BATCH_SIZE:-250}
max_passes=${INSIGHT_PREPARED_MAX_PASSES:-100}
if [[ ! "$batch_size" =~ ^[0-9]+$ || ${#batch_size} -gt 4
   || ! "$max_passes" =~ ^[0-9]+$ || ${#max_passes} -gt 4 ]]; then
  printf '%s\n' 'Use batch size 1..1000 and max passes 1..1000.' >&2
  exit 1
fi
batch_size=$((10#$batch_size))
max_passes=$((10#$max_passes))
if [[ "$batch_size" -lt 1 || "$batch_size" -gt 1000 || "$max_passes" -lt 1 || "$max_passes" -gt 1000 ]]; then
  printf '%s\n' 'Use batch size 1..1000 and max passes 1..1000.' >&2
  exit 1
fi
psql_args=(--no-psqlrc --quiet --tuples-only --no-align --set=ON_ERROR_STOP=1)
for ((pass=1; pass<=max_passes; pass++)); do
  after_id=''
  while :; do
    # Each invocation is one bounded transaction. KEY SHARE prevents a real
    # DELETE/id change until insertion commits; non-key updates always UPSERT a
    # live row or tombstone, so DO NOTHING can never overwrite their newer state.
    result=$(psql "${psql_args[@]}" --field-separator='|' --set=batch_size="$batch_size" --set=after_id="$after_id" <<'SQL'
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='8s';
WITH picked AS MATERIALIZED (
  SELECT n.* FROM public.insight_notifications n
  WHERE (NULLIF(:'after_id','')::bigint IS NULL OR n.id>NULLIF(:'after_id','')::bigint)
    AND NOT EXISTS (SELECT 1 FROM insight_notification_internal.prepared_rows p WHERE p.id=n.id)
  ORDER BY n.id LIMIT :batch_size
  FOR KEY SHARE OF n SKIP LOCKED
), inserted AS (
  INSERT INTO insight_notification_internal.prepared_rows
  SELECT p.* FROM picked n CROSS JOIN LATERAL insight_notification_internal.project_row(n::public.insight_notifications) p
  ON CONFLICT (id) DO NOTHING RETURNING id
)
SELECT count(*),COALESCE(max(id)::text,''),(SELECT count(*) FROM inserted) FROM picked;
COMMIT;
SQL
)
    IFS='|' read -r picked_count next_id inserted_count <<< "$result"
    if [[ ! "$picked_count" =~ ^[0-9]+$ || ! "$inserted_count" =~ ^[0-9]+$ || ! "$next_id" =~ ^-?[0-9]*$ ]]; then
      printf '%s\n' 'Unexpected backfill result; stopped without advancing the cursor.' >&2
      exit 1
    fi
    if [[ "$picked_count" -eq 0 ]]; then break; fi
    after_id=$next_id
    printf 'Prepared %s rows (pass %s).\n' "$inserted_count" "$pass"
  done
  missing=$(psql "${psql_args[@]}" <<'SQL'
SELECT EXISTS(SELECT 1 FROM public.insight_notifications n
  WHERE NOT EXISTS(SELECT 1 FROM insight_notification_internal.prepared_rows p WHERE p.id=n.id));
SQL
)
  if [[ "$missing" == f ]]; then
    psql "${psql_args[@]}" <<'SQL'
SET statement_timeout='30s';
SELECT insight_notification_internal.assert_prepared_rows_complete();
SQL
    printf '%s\n' 'Prepared projection is complete and source identity checks passed.'
    exit 0
  fi
  if [[ "$missing" != t ]]; then
    printf '%s\n' 'Unexpected completeness result; stopped.' >&2
    exit 1
  fi
  # A prior pass may have skipped locked ids. Resume from the beginning rather
  # than declaring a gap complete, and leave a safe resumable failure if busy.
  sleep 0.25
done
printf '%s\n' 'Source rows remain locked or missing. Rerun this resumable backfill before cutover.' >&2
exit 1
