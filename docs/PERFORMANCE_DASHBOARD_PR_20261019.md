# Dashboard snapshot reads: bounded detail payloads

The analysis endpoint previously read chart and traffic payloads for up to 500 historical snapshots although only the selected snapshot uses those fields. Keep the exact 500-row selection, historical metrics, period preference, complete-vs-partial preference and daily-history RPC. Fetch traffic_sources, traffic_series and raw_data only for the already-selected confirmed snapshot, scoped to the authenticated member.

No database rows, schema, ingest behavior, totals, visible history, or API response fields are removed. Missing/failed selected detail returns an error rather than a successful empty dashboard.

## Verification
- 14 new tests compare the complete response against the pre-change implementation, including all periods, historical corrections, zeros, incomplete/legacy snapshots, member boundaries, a newer concurrent snapshot and revoked confirmation.
- Synthetic 500-snapshot DB JSON: 2,571,702 -> 298,360 bytes (88.4% smaller), with identical client response. This is a reproducible fixture measurement, not billed traffic.
- Current Supabase select documentation verified: https://supabase.com/docs/reference/javascript/select

## Rollout and rollback
Deploy only the insight-dashboard-data Edge Function after approval, preserving verify_jwt=false and existing environment configuration. No migration is required. Merging source alone does not deploy this Edge Function. The deployed baseline source matched main9af6ac7 (Edge version15; internal marker14), apart from final whitespace. Rollback redeploys that baseline source with the same authentication configuration; no data restore is needed.

There is one extra bounded DB request, run in parallel with the existing selected-article read. Transfer reduction is verified; end-user latency and billed monthly egress savings are not yet measured.
