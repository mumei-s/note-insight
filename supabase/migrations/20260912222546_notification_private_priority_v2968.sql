CREATE OR REPLACE FUNCTION public.classify_insight_notification_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
      if t like '%」に返信しました%' then new.notification_type := 'reply'; else new.notification_type := 'comment'; end if;
      return new;
    end if;
  end if;
  if src = 'history_restore' and new.fingerprint like 'history-like%' then new.notification_type := 'like'; return new; end if;


  -- Prioritize the notification action over words contained in article/magazine titles.
  if t ~ '^あなたの記事[がを].*(追加されました|追加しました)' then
    new.notification_type := 'my_article_magazine_added'; return new;
  end if;
  if target ~ 'kind=board_reply_(comment|post)' then
    new.notification_type := 'membership_board_reply'; return new;
  end if;
  if t ~ 'さん(他[0-9]+名)?があなたのコメントに返信しました' then
    new.notification_type := case when target ~ '/membership/|kind=board_' then 'membership_board_reply' else 'reply' end; return new;
  end if;
  if t ~ '^(.{0,160}さんが)?あなたのメンバーシップ.*(参加|加入|入会|メンバーになりました)' then
    new.notification_type := 'membership_join'; return new;
  end if;

  if target like '%kind=circle_plan_join%' then
    new.notification_type := 'membership_join';
  elsif target ~ 'kind=board_like_(comment|post)' then
    new.notification_type := 'membership_reaction';
  elsif target ~ 'kind=board_reply_(comment|post)' then
    new.notification_type := 'membership_board_reply';
  elsif target like '%kind=board_new_post%' then
    new.notification_type := 'membership_board';
  elsif target like '%kind=circle_plan_open%' then
    new.notification_type := 'membership_plan';
  elsif t like '%あなたのコメント%に%スキしました%' or t like '%あなたのコメント%へ%スキしました%' or t like '%コメントにスキしました%' or t like '%コメントをスキしました%' then
    new.notification_type := 'comment_like';
  elsif (target like '%/membership/boards/%' or target like '%kind=board_reply_comment%' or target like '%kind=board_reply_post%') and (t like '%あなたのコメント%返信%' or t like '%コメントへの返信%' or t like '%コメントに返信しました%') then
    new.notification_type := 'membership_board_reply';
  elsif target like '%/membership/%' and (t like '%スキしました%' or t like '%リアクション%' or t like '%いいね%' or t like '%反応%') then
    new.notification_type := 'membership_reaction';
  elsif t like '%あなたの記事にスキしました%' or t like '%あなたの投稿にスキしました%' or t like '%」にスキしました%' or t like '%新しいスキが%増えました%' then
    new.notification_type := 'like';
  elsif t like '%あなたのコメント%返信%' or t like '%コメントへの返信%' or t like '%コメントに返信しました%' or t like '%返信がありました%' or t like '%」に返信しました%' then
    new.notification_type := 'reply';
  elsif t like '%あなたの記事%コメントしました%' or t like '%新しいコメントが%増えました%' or t like '%コメントがありました%' or t like '%」にコメントしました%' then
    new.notification_type := 'comment';
  elsif t like '%メンバーシップの掲示板に投稿しました%' or t like '%メンバーシップ%掲示板%投稿%' then
    new.notification_type := 'membership_board';
  elsif t like '%メンバーシップをはじめました%' or t like '%メンバーシップを始めました%' or t like '%メンバーシップを開始しました%' then
    new.notification_type := 'membership_started';
  elsif t like '%メンバーシップ%プラン%追加%' or t like '%メンバーシップ%新しいプラン%' or t like '%メンバーシップ%プラン%公開%' then
    new.notification_type := 'membership_plan';
  elsif t like '%あなたのメンバーシップ%参加しました%' or t like '%あなたのメンバーシップ%メンバーになりました%' or t like '%メンバーシップに参加しました%' or t like '%メンバーシップ%加入しました%' or t like '%メンバーシップ%入会しました%' then
    new.notification_type := 'membership_join';
  elsif t like '%運営メンバーに仲間入りしました%' or t like '%マガジン%参加しました%' or t like '%共同マガジン%仲間入りしました%' then
    new.notification_type := 'magazine_join';
  elsif t like '%あなたの記事が%に追加されました%' or t like '%あなたの記事を%マガジン%追加%' then
    new.notification_type := 'my_article_magazine_added';
  elsif (target like '%/m/%' and t like '%をフォローしました%') or t like '%マガジンをフォローしました%' then
    new.notification_type := 'magazine_follow';
  elsif t like '%あなたをフォローしました%' or t like '%フォローされました%' or t like '%新しいフォロワー%' or t like '%さんがあなたをフォロー%' or (t ~ 'さん(他[0-9]+名)?がフォローしました( |$)' and target !~ '/m/') then
    new.notification_type := 'follow';
  elsif t like '%に新しい記事を%追加しました%' or t like '%に記事を追加しました%' or t like '%マガジン%記事%追加しました%' or t like '%メンバー特典マガジンに記事%' then
    new.notification_type := 'magazine_article_added';
  elsif t ~ 'さん(他[0-9]+名)?が(新しい)?記事を投稿しました( |$)' or t ~ 'さんが.*記事を更新しました' then
    new.notification_type := 'creator_article_posted';
  elsif t like '%あなたの記事%話題です%' or t like '%あなたの記事%話題になりました%' or t like '%あなたの記事 が話題です%' then
    new.notification_type := 'buzz';
  elsif t like '%あなたの記事が購入されました%' or t like '%あなたの有料記事が購入されました%' or t like '%購入がありました%' or t like '%さんがあなたの記事を購入しました%' then
    new.notification_type := 'purchase';
  elsif t like '%チップを送りました%' or t like '%チップを贈りました%' or t like '%チップを受け取りました%' or t like '%チップが届%' or t like '%サポートされました%' or t like '%サポートを受けました%' then
    new.notification_type := 'tip';
  elsif t like '%あなたの記事%引用され%' or t like '%あなたの記事%紹介され%' then
    new.notification_type := 'quote';
  elsif t like '%あなたの記事を高評価しました%' then
    new.notification_type := 'rating';
  elsif t like '%あなたにポイント%' or t like '%ポイントが付与%' or t like '%ポイントを獲得%' then
    new.notification_type := 'points';
  else
    new.notification_type := 'other';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fix_insight_notification_v4_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  t text := regexp_replace(coalesce(new.raw_text,''), '[[:space:]]+', ' ', 'g');
  rv text := coalesce(new.meta->>'reclassify_version','');
  corrected boolean := false;
begin

  if new.notification_type in ('my_article_magazine_added','reply','membership_board_reply','membership_join') and (coalesce(new.meta->>'verified_shell','false')='true' or rv not like '%noise%') then return new; end if;
  if rv like '%noise%' then
    new.notification_type := 'capture_noise'; corrected := true;
  elsif t like '%さんが質問箱を始めました%' or t like '%さんが質問箱をはじめました%' then
    new.notification_type := 'question_box_started'; corrected := true;
  elsif t like '%さんが記事を投稿しました%' or t like '%さんが新しい記事を投稿しました%' or t like '%さんが%記事を更新しました%' then
    new.notification_type := 'creator_article_posted'; corrected := true;
  elsif (t like '%さんが%をフォローしました%' and t not like '%あなたをフォローしました%') then
    new.notification_type := 'magazine_follow'; corrected := true;
  elsif new.notification_type='other' and (t like '%さんから%チップ%届%' or t like '%さんより%チップ%届%' or t like '%さんから%サポート%届%' or t like '%支援%届%' or t like '%応援金%届%') then
    new.notification_type := 'tip'; corrected := true;
  end if;
  if corrected then
    new.meta := coalesce(new.meta,'{}'::jsonb) || jsonb_build_object('reclassify_pending',false,'db_classifier','final-v5');
  end if;
  return new;
end;
$function$;
