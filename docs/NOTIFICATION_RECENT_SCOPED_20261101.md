# Exact bounded recent notification reads

The server logs contained five `57014` timeouts in the raw recent-read query: three without a watermark and two with `captured_at OR meta.last_reclassified_at` filtering. The original query combined both owner scopes before sorting and selecting the first 300 raw rows.

The service-only `insight_notification_recent_rows(text[],text)` RPC keeps the verified Edge identity, normalized watermark, fourteen returned columns and original raw top 300 boundary. For each scope and eligible change branch it selects at most 300 IDs in `(captured_at DESC, id ASC)` order. It unions those IDs, selects the global first 300 and only then reads complete payloads. A row below position 300 in one branch already has 300 distinct predecessors in that branch, so it cannot enter the global first 300. Capture/reclassification overlap is removed before the global limit.

The original text comparison remains exact for legacy metadata. The database uses `en_US.UTF-8`, so the implementation does not assume that a truncated prefix is an equivalent range key. Two partial indexes split the combined UTF-8 octet length of member ID and reclassification text at 1,800 bytes. The short index stores the original full text; oversized legacy values use a separate index and the original full-text residual comparison. NULLs, timestamp ties, excluded raw types, metadata and deduplication winners remain unchanged.

No table rows, totals, notification keys, schema columns or RLS policies are changed. The RPC remains `STABLE SECURITY INVOKER` with an empty search path and custom plans; only `service_role` can execute it. Source MD5 after the guarded index patch is `af147f948983b717a7cc383763f78507`. Missing RPCs and failed reads remain errors; the Edge function never falls back to the slow query.

## Live verification

| Case | Original query | Final actual RPC | Raw rows |
| --- | ---: | ---: | ---: |
| No watermark | 7,557 ms | 29.49 ms | 300 |
| With the same fixed watermark | 10,737 ms | 10.78 ms | 121 |

The final RPC matched complete original row JSON and natural row order in a single read-only snapshot for both cases. Row counts changed during the investigation as genuine new notifications arrived. Timings vary with cache and server load. The index-free RPC could still take 9,392 ms on its reclassification branch; the final timings above were measured after the guarded index patch, against the actual installed RPC.

A bounded read-only inner-plan check used both the short index and long fallback index; it completed in 2.72 ms. The short index occupies 417,792 bytes and the empty long fallback index 8,192 bytes: 425,984 bytes total. The preflight found 5,785 short keys, zero long keys, 172,289 total indexed member/text bytes and a maximum combined key of 68 bytes. No new project, compute instance or paid resource was created.

## Tests

`tests/notification-recent-egress.test.mjs` retains the frozen response oracle and executes both SQL patches in synthetic Postgres. Its eight tests cover the original complete response, 1,500 raw rows, paired/duplicate/missing scopes, timestamp ties and NULLs, overlapping capture/reclassification branches, legacy metadata, 1,800/1,801/4,000-character values and oversized Unicode keys, service-only privileges and parameter bounds. Together with the four conversation-list payload tests, 12 tests pass.
