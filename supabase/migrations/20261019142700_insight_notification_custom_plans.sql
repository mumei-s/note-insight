-- Category, scope and page parameters have very different cardinalities. A
-- cached generic PL/pgSQL plan can exceed the existing eight-second API budget.
-- Plan this one function for its actual parameters; restore the caller's mode
-- when it returns. No global setting, timeout, permission or feed-data changes.
ALTER FUNCTION public.insight_notification_feed_page(text[],text,text,text,text,text,integer,integer,boolean)
SET plan_cache_mode = 'force_custom_plan';
