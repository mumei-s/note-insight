do $$ begin
 if exists(select 1 from public.insight_social_checks) or exists(select 1 from public.insight_social_check_runs) or exists(select 1 from public.insight_social_check_events) then raise exception 'Prototype contains data; cleanup stopped'; end if;
end $$;
drop function public.insight_apply_social_checks(text,jsonb,text,text,integer,integer,timestamptz,boolean);
drop table public.insight_social_checks,public.insight_social_check_runs,public.insight_social_check_events;
