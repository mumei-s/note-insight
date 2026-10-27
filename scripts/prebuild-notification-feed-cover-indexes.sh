#!/usr/bin/env bash
# Administrative prebuild only. Use libpq PG* / PGSERVICE / PGPASSFILE settings;
# do not put credentials in this file or print connection strings.
# Each psql invocation is a separate command. Do not add --single-transaction:
# CREATE INDEX CONCURRENTLY must execute outside the migration transaction.
# If a name already exists, inspect its definition/readiness instead of dropping
# it blindly. The migration verifies and reuses only the exact valid prebuild.
set -euo pipefail
if [[ -z "${PGDATABASE:-}${PGSERVICE:-}" ]]; then
  printf '%s\n' 'Set PGDATABASE or PGSERVICE and the remaining libpq connection settings.' >&2
  exit 1
fi

psql --no-psqlrc --set=ON_ERROR_STOP=1 <<'SQL'
SET lock_timeout='3s';
CREATE INDEX CONCURRENTLY insight_notifications_feed_short_cover_idx
ON public.insight_notifications(member_id)
INCLUDE(id,notification_type,insight_feed_key)
WHERE insight_feed_key IS NOT NULL
  AND octet_length(COALESCE(member_id,''))::bigint+octet_length(COALESCE(notification_type,''))+octet_length(insight_feed_key)<=1800;
SQL

psql --no-psqlrc --set=ON_ERROR_STOP=1 <<'SQL'
SET lock_timeout='3s';
CREATE INDEX CONCURRENTLY insight_notifications_feed_long_key_idx
ON public.insight_notifications(member_id,id)
WHERE insight_feed_key IS NOT NULL
  AND octet_length(COALESCE(member_id,''))::bigint+octet_length(COALESCE(notification_type,''))+octet_length(insight_feed_key)>1800;
SQL
