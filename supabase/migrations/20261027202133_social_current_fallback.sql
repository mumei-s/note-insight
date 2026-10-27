-- Preserve the existing authenticated RPC contract and reject concurrent drift.
do $guard$
begin
 if not exists (
  select 1 from pg_catalog.pg_proc p
  where p.oid=pg_catalog.to_regprocedure('public.insight_social_events_fallback(text,text,jsonb)')
   and pg_catalog.md5(p.prosrc) in ('c71b26605bf5a38e17b9afa9adb04aa2','20098836be0fec5b52f2ea9df68af1c2')
   and p.prosecdef is true
   and p.proconfig=array['search_path=public, extensions']::text[]
 ) then raise exception 'SOCIAL_CURRENT_FALLBACK_SOURCE_DRIFT'; end if;
end;
$guard$;

CREATE OR REPLACE FUNCTION public.insight_social_events_fallback(p_token text, p_action text, p_extra jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_app uuid; v_note text; v_status text; v_scope text;
  v_page int:=greatest(1,coalesce((p_extra->>'page')::int,1));
  v_size int:=least(100,greatest(20,coalesce((p_extra->>'pageSize')::int,50)));
  v_offset int; v_direction text:=case when p_extra->>'direction'='followings' then 'followings' else 'followers' end;
  v_window text:=case when p_extra->>'window' in ('latest','oldest','all') then p_extra->>'window' when p_action='people' then 'latest' else 'all' end; v_query text:=lower(coalesce(p_extra->>'query',''));
  v_change text:=case when p_action='investigation' then 'removed' else coalesce(p_extra->>'change','all') end; v_relation text:=coalesce(p_extra->>'relationship','following_only');
  v_from timestamptz:=nullif(p_extra->>'dateFrom','')::timestamptz; v_to timestamptz:=nullif(p_extra->>'dateTo','')::timestamptz;
  v_total bigint:=0; v_window_total bigint:=0; v_rows jsonb:='[]'::jsonb; v_latest jsonb:='{}'::jsonb; v_status_row jsonb:='{}'::jsonb; v_counts jsonb:='{}'::jsonb; v_history_summary jsonb:='{}'::jsonb;
begin
  select a.id,lower(a.note_id),a.status into v_app,v_note,v_status
  from insight_member_sessions s join insight_access_applications a on a.id=s.application_id
  where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    and s.revoked_at is null and s.expires_at>now() limit 1;
  if v_app is null then raise exception 'INSIGHT_SESSION_INVALID'; end if;
  if v_status<>'active' then raise exception 'INSIGHT_MEMBER_INACTIVE'; end if;
  v_scope:=case when v_note='ss_yr' then 'owner' else v_app::text end;
  v_offset:=(v_page-1)*v_size;

  select jsonb_build_object(
    'followers',(select to_jsonb(r) from insight_relation_sync_runs r where r.member_id=v_scope and r.direction='followers' order by created_at desc limit 1),
    'followings',(select to_jsonb(r) from insight_relation_sync_runs r where r.member_id=v_scope and r.direction='followings' order by created_at desc limit 1)
  ) into v_latest;

  if p_action='comparison' then
    select coalesce(to_jsonb(s),'{}'::jsonb) into v_status_row
      from insight_social_comparison_status s where s.member_id=v_scope limit 1;

    with selected as materialized (
      select c.* from public.insight_social_current_people c
      where c.member_id=v_scope and c.relation<>'none'
      order by (c.is_following is true) desc,
        case when v_window='latest' then coalesce(c.following_rank,c.follower_rank,0) end asc,
        case when v_window<>'latest' then coalesce(c.following_rank,c.follower_rank,0) end desc,
        c.person_key
      limit 1000
    ), filtered as not materialized (
      select * from selected c
      where (v_query='' or lower(coalesce(c.actor_name,'')) like '%'||v_query||'%'
          or lower(coalesce(c.actor_url,'')) like '%'||v_query||'%')
        and (v_relation='all' or c.relation=v_relation
          or (v_relation='lost' and c.lost_at is not null)
          or (v_relation='gained' and c.gained_at is not null))
    )
    select (select count(*) from selected),(select count(*) from filtered),
      coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from filtered
        order by (is_following is true) desc,
          case when v_window='latest' then coalesce(following_rank,follower_rank,0) end asc,
          case when v_window<>'latest' then coalesce(following_rank,follower_rank,0) end desc,person_key
        offset v_offset limit v_size
      ) x),'[]'::jsonb),
      (select jsonb_build_object('all',count(*),
        'mutual',count(*) filter(where relation='mutual'),
        'following_only',count(*) filter(where relation='following_only'),
        'follower_only',count(*) filter(where relation='follower_only'),
        'unknown',count(*) filter(where relation='unknown'),
        'lost',count(*) filter(where lost_at is not null),
        'gained',count(*) filter(where gained_at is not null)) from selected)
      into v_window_total,v_total,v_rows,v_counts;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',v_total,
      'rows',v_rows,'counts',v_counts,'status',v_status_row,'latest',v_latest,'noteId',v_note,
      'window',case when v_window='latest' then 'latest' else 'oldest' end,
      'windowTotal',v_window_total,'basis','mutual_relationship',
      'selfFollowingCount',(select count(*) from public.insight_social_current_people
        where member_id=v_scope and is_following is true),'fallback','postgres');
  elsif p_action='people' then
    with selected_people as materialized (
      select r.* from insight_relations r
      where r.member_id=v_scope and r.direction=v_direction
        and (v_window<>'latest' or r.active=true)
      order by case when v_window='oldest' then r.first_seen_at end asc nulls last,
               case when v_window='latest' then r.source_rank end asc nulls last,
               r.person_key
      limit case when v_window='all' then null else 1000 end
    ), filtered as not materialized (
      select * from selected_people r
      where v_query='' or lower(coalesce(r.actor_name,'')) like '%'||v_query||'%'
        or lower(coalesce(r.actor_url,'')) like '%'||v_query||'%'
    )
    select (select count(*) from selected_people), (select count(*) from filtered),
      coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from filtered
        order by case when v_window='oldest' then first_seen_at end asc nulls last,
                 case when v_window='latest' then source_rank end asc nulls last,person_key
        offset v_offset limit v_size
      ) x),'[]'::jsonb)
      into v_window_total,v_total,v_rows;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,
      'total',v_total,'rows',v_rows,'latest',v_latest,'run',v_latest->v_direction,
      'noteId',v_note,'window',v_window,'windowTotal',v_window_total,
      'basis',case when v_window='all' then 'all_saved_people'
        when v_window='oldest' then 'first_saved_people' else 'latest_snapshot' end,
      'fallback','postgres');
  elsif p_action in ('events','investigation') then
    with selected_people as materialized (
      select r.person_key from insight_relations r
      where r.member_id=v_scope and r.direction=v_direction
        and (v_window<>'latest' or r.active=true)
      order by case when v_window='oldest' then r.first_seen_at end asc nulls last,
               case when v_window='latest' then r.source_rank end asc nulls last,
               r.person_key
      limit 1000
    ), filtered as not materialized (
      select e.* from public.insight_relation_history_current e
      where e.member_id=v_scope
        and ((v_window='all' and coalesce(p_extra->>'direction','all')='all') or e.direction=v_direction)
        and (v_window='all' or e.person_key in (select person_key from selected_people))
        and (v_change='all' or e.event_type=v_change)
        and (case when p_action='investigation'
          then e.identity_exact is not true and e.candidate_resolved is not true
          else e.event_type='added' or e.identity_exact is true end)
        and (v_from is null or e.detected_at>=v_from) and (v_to is null or e.detected_at<v_to)
        and not e.person_key like 'aggregate:%'
        and (v_query='' or lower(coalesce(e.actor_name,'')) like '%'||v_query||'%' or lower(coalesce(e.actor_url,'')) like '%'||v_query||'%')
    )
    select (select count(*) from filtered),
      coalesce((select jsonb_agg(to_jsonb(x)) from (
        select * from filtered order by detected_at desc,id desc
        offset v_offset limit v_size
      ) x),'[]'::jsonb),
      case when v_window='all' then null else (select count(*) from selected_people) end
      into v_total,v_rows,v_window_total;
    v_history_summary:=public.insight_social_history_summary(v_scope,
      case when v_window='all' then coalesce(p_extra->>'direction','all') else v_direction end,
      v_from,v_to,v_query);
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',v_total,
      'rows',v_rows,'latest',v_latest,'noteId',v_note,'window',v_window,
      'windowTotal',v_window_total,'historySummary',v_history_summary,'fallback','postgres');
  end if;
  raise exception 'FALLBACK_ACTION_UNSUPPORTED';
end $function$;
