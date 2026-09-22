-- Called only by the authenticated summary Edge Function. No client can choose another member's scope.
create or replace function public.insight_notification_analysis_summary(
  p_member_ids text[], p_note_id text, p_period integer default 0, p_now timestamptz default now()
) returns jsonb language sql stable security invoker set search_path = '' as $$
with eligible as materialized (
  select distinct on (coalesce(nullif(n.meta->>'client_signature',''),n.id::text))
    n.id, coalesce(n.occurred_at,n.captured_at) as at,
    n.occurred_at is not null and coalesce(n.meta->>'time_estimated','false') not in ('true','1') as exact_time,
    case when n.notification_type='other' and n.meta->>'kind'='qa_answer' then 'question_answer'
      when n.notification_type='membership_reaction' then 'membership_reaction_' ||
        case when n.target_url ~ '^https://note[.]com/[^/]+/membership' then
          case when lower(split_part(n.target_url,'/',4))=lower(p_note_id) then 'self' else 'joined' end else 'unknown' end
      when n.notification_type='reply' then 'reply_' ||
        case when n.target_url ~ '^https?://[^/]+/[^/]+/n/' then
          case when lower(split_part(n.target_url,'/',4))=lower(p_note_id) then 'self' else 'other' end else 'unknown' end
      else coalesce(nullif(n.notification_type,''),'other') end as kind,
    coalesce(nullif(lower(regexp_replace(split_part(split_part(n.actor_url,'?',1),'#',1),'/$','')),''),
      lower(trim(regexp_replace(coalesce(n.actor_name,''),'\s+',' ','g')))) as actor,
    coalesce(nullif(trim(regexp_replace(n.actor_name,'\s+',' ','g')),''),'noteユーザー') as name,
    coalesce(n.actor_url,'') as url
  from public.insight_notifications n
  where n.member_id=any(p_member_ids)
    and coalesce(n.meta->>'noise_reason','') <> 'non-notification-api-capture'
    and coalesce(n.notification_type,'other') not in ('capture_noise','like','follow','comment','creator_article_posted')
    and n.meta->>'source' like 'note-notification-%'
    and coalesce(n.raw_text,'') ~ '\S'
  order by coalesce(nullif(n.meta->>'client_signature',''),n.id::text), n.captured_at desc, n.id asc
), selected as materialized (
  select *, (at at time zone 'Asia/Tokyo')::date as day,
    extract(hour from at at time zone 'Asia/Tokyo')::integer as hour,
    extract(dow from at at time zone 'Asia/Tokyo')::integer as dow
  from eligible where p_period not in (7,30,90) or (at between p_now-make_interval(days=>p_period) and p_now)
), kinds as (select kind,count(*) as n from selected group by kind),
actors as (select actor,(array_agg(name order by at desc,id))[1] as name,
  (array_agg(url order by at desc,id))[1] as url,count(*) as n,max(at) as last from selected where actor<>'' group by actor),
days as (select day,count(*) as n from selected where day is not null group by day),
hours as (select i, count(s.id) as n from generate_series(0,23) i left join selected s on s.hour=i group by i),
week as (select i,count(s.id) as n from generate_series(0,6) i left join selected s on s.dow=i group by i),
stats as (select count(*) as n, count(*) filter(where kind='other') as other,
  count(*) filter(where kind in ('comment','reply','reply_self','reply_other','reply_unknown','membership_board_reply')) as comments,
  count(*) filter(where kind like 'membership_%') as membership,
  count(*) filter(where kind in ('purchase','tip')) as money,
  count(*) filter(where kind in ('like','comment_like') or kind like 'membership_reaction%') as likes,
  count(*) filter(where kind='follow') as follows,
  count(*) filter(where kind='my_article_magazine_added') as adds,
  count(*) filter(where kind='membership_join') as joins,
  count(*) filter(where exact_time) as exact from selected)
select jsonb_build_object(
  'sample',s.n,'total',s.n,'sourceTotal',s.n,'truncated',false,'coverage',100,
  'period',case when p_period in (7,30,90) then p_period else 0 end,
  'recent7',(select count(*) from eligible where at between p_now-interval '7 days' and p_now),
  'prev7',(select count(*) from eligible where at>=p_now-interval '14 days' and at<p_now-interval '7 days'),
  'comments',s.comments,'membership',s.membership,'money',s.money,'likes',s.likes,'follows',s.follows,
  'other',s.other,'ownArticleAdds',s.adds,'membershipJoins',s.joins,'exactTimeCount',s.exact,
  'classifiedRate',case when s.n>0 then 100.0*(s.n-s.other)/s.n else 0 end,
  'people',(select count(*) from actors),'repeatPeople',(select count(*) from actors where n>1),
  'activeDays',(select count(*) from days),
  'topTypes',coalesce((select jsonb_agg(jsonb_build_array(kind,n) order by n desc,kind) from (select * from kinds order by n desc,kind limit 10) k),'[]'::jsonb),
  'topActors',coalesce((select jsonb_agg(jsonb_build_object('name',name,'url',url,'count',n,'last',extract(epoch from last)*1000) order by n desc,last desc,actor) from (select * from actors order by n desc,last desc,actor limit 12) a),'[]'::jsonb),
  'peakHour',(select i from hours order by n desc,i limit 1),
  'weekName',(array['日','月','火','水','木','金','土'])[(select i+1 from week order by n desc,i limit 1)],
  'topActorShare',case when s.n>0 then coalesce((select max(n) from actors),0)*100.0/s.n else 0 end,
  'week',(select jsonb_agg(jsonb_build_object('k',(array['日','月','火','水','木','金','土'])[i+1]||'曜','v',n) order by i) from week),
  'timeBands',(select jsonb_agg(jsonb_build_object('k',(array['深夜 0–5','朝 6–11','昼 12–17','夜 18–23'])[band+1],'v',n) order by band) from (select i/6 as band,sum(n) as n from hours group by i/6) b),
  'last14',(select jsonb_agg(jsonb_build_object('k',to_char(day,'YYYY-MM-DD'),'label',to_char(day,'MM/DD'),'v',n) order by day) from (
    select (p_now at time zone 'Asia/Tokyo')::date-i as day,coalesce(d.n,0) as n from generate_series(0,13) i left join days d on d.day=(p_now at time zone 'Asia/Tokyo')::date-i) d),
  'dailyCounts',coalesce((select jsonb_agg(jsonb_build_object('date',to_char(day,'YYYY-MM-DD'),'count',n) order by day) from days),'[]'::jsonb),
  'computedAt',p_now
) from stats s
$$;
revoke all on function public.insight_notification_analysis_summary(text[],text,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.insight_notification_analysis_summary(text[],text,integer,timestamptz) to service_role;
