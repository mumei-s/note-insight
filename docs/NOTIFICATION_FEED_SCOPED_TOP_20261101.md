# Notification feed metadata reads

The live notification feed logged three `NOTIFICATION_FEED_READ_FAILED:57014` statement timeouts. The existing exact feed uses transactionally prepared notification rows; its classification, greedy duplicate fold, counts, date/status filters and page payload are retained.

Read-only live execution of the original full query took 6.86 seconds cold and 3.76 seconds warm in the observed runs. One unnecessary metadata subplan scanned/sorted all 38,687 raw rows across the two owner scopes merely to find the newest capture timestamp. Another scanned the complete synchronization-run table to find the newest confirmed save.

`scripts/notification-feed-scoped-top.sql` changes only those two metadata CTEs: select one ordered top row per verified scope, then apply the same global order and limit. A partial index covers only confirmed synchronization-run metadata. The applied index occupies 811,008 bytes; no notification bodies or conversation archives are copied. Existing NULL ordering and single/paired scope semantics remain unchanged.

The guarded patch requires the exact prior source hash `77c56df0bd92a570bc057a088323535e`. The applied function hash is `7daed624879d069a7072c3e06dd01e43`. It preserves the original owner, ACL, `STABLE SECURITY INVOKER`, empty search path and function-scoped custom-plan setting. Execution remains limited to `service_role`.

Post-application read-only checks found the latest timestamp using the existing capture index at about 1.3 ms per scope and the complete last-save metadata subplan at 6.9 ms, compared with roughly 606 ms and 267 ms in the timed original plan. Complete feed timing varies with cache and CPU load; the measured post-change full query was 4.15 seconds. This optimization does not replace the separate recent-row query fix.

Within one read-only snapshot, complete old and applied response JSON excluding the changing `feedAt` field matched exactly: 24,923 total notifications, 100 page rows, and identical category/status counts. `tests/notification-feed-page-rpc.test.mjs` passed all 17 cases, including the frozen JavaScript oracle, exact late pages in a 20,000-row history, 5,900 formatter variants, scope/ACL/configuration checks, paired/single scope metadata, NULL ordering and bounded index lookups.
