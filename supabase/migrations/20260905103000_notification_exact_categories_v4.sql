create or replace function public.classify_insight_notification_row()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  t text := regexp_replace(coalesce(new.raw_text,''), '[[:space:]]+', ' ', 'g');
  src text := coalesce(new.meta->>'source','');
  target text := coalesce(new.target_url,'');
begin
  if t = '' then return new; end if;

  if src = 'public_watcher' then
    if new.fingerprint like 'public-like%' then new.notification_type := 'like'; return new; end if;
    if new.fingerprint like 'public-follow%' then new.notification_type := 'follow'; return new; end if;
    if new.fingerprint like 'public-comment-summary%' then new.notification_type := 'comment'; return new; end if;
  end if;

  if src = 'member-public-watch' then
    if new.fingerprint like 'like|%' then new.notification_type := 'like'; return new; end if;
    if new.fingerprint like 'follow|%' then new.notification_type := 'follow'; return new; end if;
    if new.fingerprint like 'comment|%' then
      if t like '%」に返信しました' then new.notification_type := 'reply';
      else new.notification_type := 'comment'; end if;
      return new;
    end if;
  end if;

  if src = 'history_restore' and new.fingerprint like 'history-like%' then
    new.notification_type := 'like'; return new;
  end if;

  if t like '%あなたのコメント%に%スキしました%'
     or t like '%あなたのコメント%へ%スキしました%'
     or t like '%コメントにスキしました%'
     or t like '%コメントをスキしました%' then
    new.notification_type := 'comment_like';
  elsif t like '%あなたの記事にスキしました%'
     or t like '%」にスキしました%'
     or t like '%新しいスキが%増えました%' then
    new.notification_type := 'like';
  elsif t like '%あなたのコメント%返信%'
     or t like '%コメントへの返信%'
     or t like '%コメントに返信しました%'
     or t like '%返信がありました%' then
    new.notification_type := 'reply';
  elsif t like '%あなたの記事%コメントしました%'
     or t like '%新しいコメントが%増えました%'
     or t like '%コメントがありました%' then
    new.notification_type := 'comment';
  elsif t like '%メンバーシップの掲示板に投稿しました%'
     or t like '%メンバーシップ%掲示板%投稿%' then
    new.notification_type := 'membership_board';
  elsif t like '%メンバーシップをはじめました%'
     or t like '%メンバーシップを始めました%'
     or t like '%メンバーシップを開始しました%' then
    new.notification_type := 'membership_started';
  elsif t like '%メンバーシップ%プラン%追加%'
     or t like '%メンバーシップ%新しいプラン%'
     or t like '%メンバーシップ%プラン%公開%' then
    new.notification_type := 'membership_plan';
  elsif t like '%あなたのメンバーシップ%参加しました%'
     or t like '%あなたのメンバーシップ%メンバーになりました%'
     or t like '%メンバーシップに参加しました%' then
    new.notification_type := 'membership_join';
  elsif t like '%運営メンバーに仲間入りしました%'
     or t like '%マガジン%参加しました%'
     or t like '%共同マガジン%仲間入りしました%' then
    new.notification_type := 'magazine_join';
  elsif t like '%あなたの記事が%に追加されました%'
     or t like '%あなたの記事を%マガジン%追加%' then
    new.notification_type := 'my_article_magazine_added';
  elsif (target like '%/m/%' and t like '%をフォローしました%')
     or t like '%マガジンをフォローしました%' then
    new.notification_type := 'magazine_follow';
  elsif t like '%あなたをフォローしました%'
     or t like '%フォローされました%'
     or t like '%新しいフォロワー%'
     or t like '%さんがあなたをフォロー%' then
    new.notification_type := 'follow';
  elsif t like '%に新しい記事を%追加しました%'
     or t like '%に記事を追加しました%'
     or t like '%マガジン%記事%追加しました%'
     or t like '%メンバー特典マガジンに記事%' then
    new.notification_type := 'magazine_article_added';
  elsif t like '%あなたの記事%話題です%'
     or t like '%あなたの記事%話題になりました%'
     or t like '%あなたの記事 が話題です%' then
    new.notification_type := 'buzz';
  elsif t like '%あなたの記事が購入されました%'
     or t like '%あなたの有料記事が購入されました%'
     or t like '%購入がありました%'
     or t like '%さんがあなたの記事を購入しました%' then
    new.notification_type := 'purchase';
  elsif t like '%チップを送りました%'
     or t like '%チップを贈りました%'
     or t like '%チップを受け取りました%'
     or t like '%チップが届%'
     or t like '%サポートされました%'
     or t like '%サポートを受けました%' then
    new.notification_type := 'tip';
  elsif t like '%あなたの記事%引用され%'
     or t like '%あなたの記事%紹介され%' then
    new.notification_type := 'quote';
  elsif t like '%あなたの記事を高評価しました%' then
    new.notification_type := 'rating';
  elsif t like '%あなたにポイント%'
     or t like '%ポイントが付与%'
     or t like '%ポイントを獲得%' then
    new.notification_type := 'points';
  else
    new.notification_type := 'other';
  end if;

  return new;
end;
$function$;

update public.insight_notifications
set notification_type = notification_type;

with ranked as (
  select id,
         row_number() over (
           partition by member_id,
                        notification_type,
                        regexp_replace(
                          regexp_replace(raw_text, '[[:space:]]+', ' ', 'g'),
                          ' (たった今|昨日|[0-9]+[[:space:]]*(秒|分|時間|日|週|か月|ヶ月|月|年)前)$',
                          '', 'g'
                        ),
                        split_part(coalesce(actor_url,''),'?',1),
                        split_part(coalesce(target_url,''),'?',1),
                        date_trunc('minute', coalesce(occurred_at,captured_at))
           order by id desc
         ) as rn
  from public.insight_notifications
  where coalesce(meta->>'source','') like 'note-notification%'
     or coalesce(meta->>'source','') = 'note-notification-manual-history'
)
delete from public.insight_notifications n
using ranked r
where n.id=r.id and r.rn>1;

create index if not exists insight_notifications_member_type_time_idx
on public.insight_notifications(member_id,notification_type,captured_at desc);
