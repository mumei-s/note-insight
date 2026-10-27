-- Reject concurrent source/security drift; allow exact replay of this migration.
do $guard$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.insight_member_read_fallback(text,text,text,jsonb)')
      and pg_catalog.md5(p.prosrc) in ('d68489b2b90f034ac05da025e95a5097', 'f38b9c20d37bc6054233d3b2040d5b2e')
      and p.prosecdef is true
      and p.proconfig = array['search_path=public, extensions']::text[]
  ) then
    raise exception 'SOCIAL_FALLBACK_SOURCE_DRIFT:insight_member_read_fallback';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.insight_social_events_fallback(text,text,jsonb)')
      and pg_catalog.md5(p.prosrc) in ('76c6176e8258bfd447a667d618dea7fb', 'c71b26605bf5a38e17b9afa9adb04aa2')
      and p.prosecdef is true
      and p.proconfig = array['search_path=public, extensions']::text[]
  ) then
    raise exception 'SOCIAL_FALLBACK_SOURCE_DRIFT:insight_social_events_fallback';
  end if;
end;
$guard$;

-- Preserve existing function identity, authentication, security and ACLs.
CREATE OR REPLACE FUNCTION public.insight_member_read_fallback(p_token text, p_source text, p_action text, p_extra jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_app_id uuid;
  v_note_id text;
  v_display_name text;
  v_image_url text;
  v_status text;
  v_scope text;
  v_page int := greatest(1, coalesce((p_extra->>'page')::int,1));
  v_size int := least(100, greatest(20, coalesce((p_extra->>'pageSize')::int,100)));
  v_offset int;
  v_query text := coalesce(p_extra->>'query','');
  v_status_filter text := coalesce(p_extra->>'status','all');
  v_sort text := coalesce(p_extra->>'sort','newest');
  v_direction text := coalesce(p_extra->>'direction','followers');
  v_change text := coalesce(p_extra->>'change','all');
  v_from timestamptz := nullif(p_extra->>'dateFrom','')::timestamptz;
  v_to timestamptz := nullif(p_extra->>'dateTo','')::timestamptz;
  v_rows jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_summary jsonb := '{}'::jsonb;
  v_analysis jsonb := '{}'::jsonb;
  v_comments bigint := 0;
  v_followers bigint := 0;
  v_followings bigint := 0;
  v_notifications bigint := 0;
  v_refreshed timestamptz;
  v_payload jsonb;
  v_key text;
begin
  if coalesce(p_token,'')='' then
    raise exception 'INSIGHT_LOGIN_REQUIRED';
  end if;

  select a.id, lower(a.note_id), coalesce(a.display_name,a.note_id), a.image_url, a.status
    into v_app_id, v_note_id, v_display_name, v_image_url, v_status
  from insight_member_sessions s
  join insight_access_applications a on a.id=s.application_id
  where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    and s.revoked_at is null
    and s.expires_at>now()
  order by s.expires_at desc
  limit 1;

  if v_app_id is null then raise exception 'INSIGHT_SESSION_INVALID'; end if;
  if v_status<>'active' then raise exception 'INSIGHT_MEMBER_INACTIVE'; end if;
  v_scope := case when v_note_id='ss_yr' then 'owner' else v_app_id::text end;
  v_offset := (v_page-1)*v_size;

  if p_action='summary' then
    select coalesce(insight_fast_summary(v_scope),'{}'::jsonb),
           coalesce(insight_fast_analysis_v2(v_scope),'{}'::jsonb)
      into v_summary,v_analysis;
    select count(*) into v_comments from insight_public_comments where member_id=v_scope;
    select count(*) into v_followers from insight_relations where member_id=v_scope and direction='followers' and active=true;
    select count(*) into v_followings from insight_relations where member_id=v_scope and direction='followings' and active=true;
    select count(*) into v_notifications from insight_notifications where member_id in (v_scope,v_app_id::text);
    select coalesce(jsonb_agg(to_jsonb(x) order by x.publish_at desc),'[]'::jsonb)
      into v_rows
    from (
      select article_key,title,url,publish_at,like_count,comment_count,last_seen_at
      from insight_public_articles where member_id=v_scope
      order by publish_at desc limit 1000
    ) x;
    return jsonb_build_object(
      'ok',true,
      'member',jsonb_build_object('id',v_app_id::text,'noteId',v_note_id,'displayName',v_display_name,'imageUrl',v_image_url,'scope',v_scope),
      'summary',v_summary,'analysis',v_analysis,
      'counts',jsonb_build_object('comments',v_comments,'followers',v_followers,'followings',v_followings,'notifications',v_notifications),
      'articles',v_rows,'fallback','postgres'
    );
  elsif p_action='likes' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
    from insight_fast_like_page_scoped_status(v_scope,v_offset,v_size,v_query,v_sort,v_from,v_to,v_status_filter) x;
    select insight_fast_like_count_scoped_status(v_scope,v_query,v_from,v_to,v_status_filter) into v_total;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',coalesce(v_total,0),'rows',v_rows,'fallback','postgres');
  elsif p_action='supporters' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
    from insight_fast_ranking(v_scope,v_offset,v_size,v_query) x;
    select insight_fast_ranking_count(v_scope,v_query) into v_total;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',coalesce(v_total,0),'rows',v_rows,'fallback','postgres');
  elsif p_action='supporter_articles' then
    v_key:=coalesce(p_extra->>'likerKey','');
    if v_key='' then raise exception 'LIKER_KEY_REQUIRED'; end if;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
    from insight_fast_supporter_articles(v_scope,v_key,v_offset,v_size) x;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'rows',v_rows,'fallback','postgres');
  elsif p_action in ('comments','comments_filtered') then
    if nullif(p_extra->>'articleKey','') is not null or v_from is not null or v_to is not null then
      return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',0,'rows','[]'::jsonb,'fallback','postgres','limited',true);
    end if;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
    from insight_fast_comment_threads(v_scope,v_offset,v_size,v_query,v_status_filter) x;
    select insight_fast_comment_thread_count(v_scope,v_query,v_status_filter) into v_total;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',coalesce(v_total,0),'rows',v_rows,'fallback','postgres');
  elsif p_action='comment_thread' then
    v_key:=coalesce(p_extra->>'rootKey','');
    select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at),'[]'::jsonb) into v_rows
    from (
      select c.article_key,c.comment_key,c.parent_key,c.actor_key,c.actor_name,c.actor_url,c.actor_image_url,c.body,c.occurred_at,c.is_root,c.is_creator,c.is_creator_liked,c.like_count
      from insight_public_comments c
      where c.member_id=v_scope and (c.comment_key=v_key or c.parent_key=v_key)
    ) x;
    return jsonb_build_object('ok',true,'rows',v_rows,'fallback','postgres');
  elsif p_action='comment_ranking' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
    from insight_fast_commenter_ranking(v_scope,v_offset,v_size,v_query) x;
    select insight_fast_commenter_ranking_count(v_scope,v_query) into v_total;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',coalesce(v_total,0),'rows',v_rows,'fallback','postgres');
  elsif p_action='commenter_comments' then
    v_key:=coalesce(p_extra->>'actorKey','');
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
    from insight_fast_commenter_roots(v_scope,v_key,v_offset,v_size) x;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'rows',v_rows,'fallback','postgres');
  elsif p_action='social' then
    if v_scope=v_app_id::text and v_direction='followers' then
      select count(*) into v_total from insight_public_followers where member_id=v_scope;
      select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
      from (
        select person_key,actor_name,actor_url,last_seen_at
        from insight_public_followers
        where member_id=v_scope
        order by last_seen_at desc offset v_offset limit v_size
      ) x;
    else
      select count(*) into v_total from insight_relations where member_id=v_scope and direction=v_direction and active=true;
      select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
      from (
        select person_key,actor_name,actor_url,actor_image_url,source_rank,last_seen_at
        from insight_relations
        where member_id=v_scope and direction=v_direction and active=true
        order by source_rank asc nulls last offset v_offset limit v_size
      ) x;
    end if;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',coalesce(v_total,0),'rows',v_rows,'fallback','postgres');
  elsif p_action in ('changes','social_changes') then
    select count(*) into v_total
    from insight_relation_events
    where member_id=v_scope and direction=v_direction and change_count>0
      and (v_change='all' or event_type=v_change)
      and (v_from is null or detected_at>=v_from)
      and (v_to is null or detected_at<v_to);
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
    from (
      select id,event_type,person_key,actor_name,actor_url,actor_image_url,detected_at
      from insight_relation_events
      where member_id=v_scope and direction=v_direction and change_count>0
        and (v_change='all' or event_type=v_change)
        and (v_from is null or detected_at>=v_from)
        and (v_to is null or detected_at<v_to)
      order by detected_at desc offset v_offset limit v_size
    ) x;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',coalesce(v_total,0),'rows',v_rows,'fallback','postgres');
  elsif p_action='comment_articles' then
    if v_from is null or v_to is null then return jsonb_build_object('ok',true,'rows','[]'::jsonb,'fallback','postgres'); end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.comment_count_day desc, x.publish_at desc),'[]'::jsonb) into v_rows
    from (
      select a.article_key,a.title,a.url,a.publish_at,count(c.comment_key)::bigint as comment_count_day
      from insight_public_comments c
      join insight_public_articles a on a.member_id=c.member_id and a.article_key=c.article_key
      where c.member_id=v_scope and c.is_creator=false and c.occurred_at>=v_from and c.occurred_at<v_to
      group by a.article_key,a.title,a.url,a.publish_at
    ) x;
    return jsonb_build_object('ok',true,'rows',v_rows,'fallback','postgres');
  elsif p_action='magazines' then
    select payload,refreshed_at into v_payload,v_refreshed from insight_magazine_cache where member_id=v_scope limit 1;
    return jsonb_build_object('ok',true,'total',coalesce(jsonb_array_length(coalesce(v_payload,'[]'::jsonb)),0),'refreshedAt',v_refreshed,'rows',coalesce(v_payload,'[]'::jsonb),'fallback','postgres');
  elsif p_action='favorites' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_rows
    from (
      select creator_key,actor_name,actor_url,actor_image_url,created_at
      from insight_favorite_creators where member_id=v_scope
    ) x;
    return jsonb_build_object('ok',true,'total',jsonb_array_length(v_rows),'rows',v_rows,'fallback','postgres');
  elsif p_action in ('articles','article_list') then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.publish_at desc),'[]'::jsonb) into v_rows
    from (
      select article_key,title,url,publish_at,like_count,comment_count,last_seen_at
      from insight_public_articles where member_id=v_scope
      order by publish_at desc limit 1000
    ) x;
    return jsonb_build_object('ok',true,'total',jsonb_array_length(v_rows),'rows',v_rows,'fallback','postgres');
  elsif p_action in ('notifications','list') and p_source like '%notification%' then
    select count(*) into v_total from insight_notifications where member_id in (v_scope,v_app_id::text);
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
    from (
      select id,member_id,notification_type,raw_text,actor_name,actor_url,actor_image_url,target_title,target_url,occurred_at,captured_at,is_read,meta
      from insight_notifications
      where member_id in (v_scope,v_app_id::text)
      order by captured_at desc offset v_offset limit v_size
    ) x;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',coalesce(v_total,0),'rows',v_rows,'fallback','postgres');
  end if;

  raise exception 'FALLBACK_ACTION_UNSUPPORTED';
end
$function$;

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
  v_change text:=case when p_action='investigation' then 'removed' else coalesce(p_extra->>'change','all') end; v_relation text:=coalesce(p_extra->>'relationship','all');
  v_from timestamptz:=nullif(p_extra->>'dateFrom','')::timestamptz; v_to timestamptz:=nullif(p_extra->>'dateTo','')::timestamptz;
  v_total bigint:=0; v_window_total bigint:=0; v_rows jsonb:='[]'::jsonb; v_latest jsonb:='{}'::jsonb; v_status_row jsonb:='{}'::jsonb; v_counts jsonb:='{}'::jsonb;
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

    select jsonb_build_object(
      'all',count(*),
      'mutual',count(*) filter(where is_following=true and is_follower=true and lost_at is null),
      'following_only',count(*) filter(where is_following=true and coalesce(is_follower,false)=false and lost_at is null),
      'follower_only',count(*) filter(where coalesce(is_following,false)=false and is_follower=true and lost_at is null),
      'lost',count(*) filter(where lost_at is not null),
      'gained',count(*) filter(where gained_at is not null and lost_at is null),
      'unknown',count(*) filter(where is_following is null or is_follower is null)
    ) into v_counts
    from insight_social_comparisons where member_id=v_scope;

    select count(*) into v_total from insight_social_comparisons c
    where c.member_id=v_scope
      and (v_query='' or lower(coalesce(c.actor_name,'')) like '%'||v_query||'%' or lower(coalesce(c.actor_url,'')) like '%'||v_query||'%')
      and (
        v_relation='all'
        or (v_relation='mutual' and c.is_following=true and c.is_follower=true and c.lost_at is null)
        or (v_relation='following_only' and c.is_following=true and coalesce(c.is_follower,false)=false and c.lost_at is null)
        or (v_relation='follower_only' and coalesce(c.is_following,false)=false and c.is_follower=true and c.lost_at is null)
        or (v_relation='lost' and c.lost_at is not null)
        or (v_relation='gained' and c.gained_at is not null and c.lost_at is null)
        or (v_relation='unknown' and (c.is_following is null or c.is_follower is null))
      );

    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows
    from (
      select c.*,
        case
          when c.lost_at is not null then 'lost'
          when c.is_following=true and c.is_follower=true then 'mutual'
          when c.is_following=true and coalesce(c.is_follower,false)=false then 'following_only'
          when coalesce(c.is_following,false)=false and c.is_follower=true then 'follower_only'
          else 'unknown'
        end as relation
      from insight_social_comparisons c
      where c.member_id=v_scope
        and (v_query='' or lower(coalesce(c.actor_name,'')) like '%'||v_query||'%' or lower(coalesce(c.actor_url,'')) like '%'||v_query||'%')
        and (
          v_relation='all'
          or (v_relation='mutual' and c.is_following=true and c.is_follower=true and c.lost_at is null)
          or (v_relation='following_only' and c.is_following=true and coalesce(c.is_follower,false)=false and c.lost_at is null)
          or (v_relation='follower_only' and coalesce(c.is_following,false)=false and c.is_follower=true and c.lost_at is null)
          or (v_relation='lost' and c.lost_at is not null)
          or (v_relation='gained' and c.gained_at is not null and c.lost_at is null)
          or (v_relation='unknown' and (c.is_following is null or c.is_follower is null))
        )
      order by coalesce(c.following_rank,2147483647),c.person_key
      offset v_offset limit v_size
    ) x;
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',v_total,'rows',v_rows,'counts',v_counts,'status',v_status_row,'latest',v_latest,'noteId',v_note,'fallback','postgres');
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
      select e.* from public.insight_relation_history_rows e
      where e.member_id=v_scope
        and ((v_window='all' and coalesce(p_extra->>'direction','all')='all') or e.direction=v_direction)
        and (v_window='all' or e.person_key in (select person_key from selected_people))
        and (v_change='all' or e.event_type=v_change)
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
    return jsonb_build_object('ok',true,'page',v_page,'pageSize',v_size,'total',v_total,
      'rows',v_rows,'latest',v_latest,'noteId',v_note,'window',v_window,
      'windowTotal',v_window_total,'fallback','postgres');
  end if;
  raise exception 'FALLBACK_ACTION_UNSUPPORTED';
end $function$;
