# DM feed: project only fields used by person grouping

The people and person_messages actions previously fetched every thread column, up to 5,000 rows, on each read. The grouping path uses only thread_key, peer_note_id, peer_name, peer_url, peer_image_url, last_message_at and last_synced_at. Read those seven columns explicitly.

Every returned person/message field, full body, attachment, metadata, historical page, owner/member boundary, ordering and grouping remains unchanged. Legacy threads/messages/summary actions are unchanged. No stored history or completed marks are removed, and no migration is required.

## Verification
- Four new projection and whole-response parity tests use PGlite with synthetic fixtures.
- Focused current DM tests: 44/44 passed (projection, direct-room ingest, summary save time, saved pages and view retention).
- Synthetic DB-to-Edge thread JSON: 129,951 -> 1,064 bytes; client response stays 768 bytes, exactly equal. This fixture deliberately includes large unused metadata and is not an estimate of real billable savings.
- Original source fails the two projection-budget checks.
- Current Supabase select documentation verified: https://supabase.com/docs/reference/javascript/select

## Rollout and rollback
Deploy only insight-dm-feed after approval, preserving verify_jwt=false and existing environment configuration. Merging source alone does not deploy the Edge Function. Baseline deployed version6 matched main9af6ac7 apart from final whitespace. Rollback redeploys that baseline source; no data restoration is needed.
