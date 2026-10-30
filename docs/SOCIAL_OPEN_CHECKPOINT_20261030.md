# INSIGHT 2026-10-30 start/resume social checkpoints

- Opening INSIGHT no longer requires visiting the フォロー page for a relationship checkpoint check.
- On open and resume, if local success is under 30 minutes old, do nothing. Otherwise read the small authenticated server sync dashboard first.
- If a server cron run already refreshed both directions recently, do not re-fetch note profiles. Only overdue directions run, with one in-flight job and a two-minute retry guard after failures.
- Saved histories show immediately from existing cache; relation result invalidates the social screen only, never the comment/notification/DM/likes screens.
- A capped 1,000-person follower window does not prove the identity of a drop. Historical candidates are shown separately without inventing removals.
- No new Supabase table, paid plan or cron job added.
