# Dashboard 1.6.8: visible official membership tab

The reported mobile screenshot shows the official membership name and article-count table, while Dashboard 1.6.7 reports `TAB_NOT_OPEN`. Its checkpoint contains 274 articles and 28 daily PV dates. These reported counts are user evidence, not test data.

The reader previously inspected selected attributes on hidden desktop navigation and judged a tab switch after the general data quiet period. Regressions reproduce hidden stale selections and delayed official selection updates. The actual device DOM was unavailable, so its precise trigger is not confirmed.

- Resolve the active content tab from visible navigation. Membership name and its article-count header also identify the visible membership view when selected attributes are stale.
- Wait for an observable requested tab selection, with the existing bounded wait for network/data stability. Keep the existing compatibility path for pages with no selection attributes.
- Update collection attribution from the visible tab, including a resumed checkpoint.
- On a genuine `TAB_NOT_OPEN`, stage and confirm already collected data using the durable save queue. Keep the failure in history and the checkpoint for explicit manual continuation; do not report a complete read.

Verification: mobile hidden navigation, actual membership-heading/count-table layout, delayed selection, genuine blocked selection with partial save and retained failure history. Existing dashboard stop/navigation, persistence, account isolation, daily data, and save confirmation tests remain required. No live Android reproduction is claimed.
