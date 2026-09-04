create or replace function public.classify_insight_notification_row()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  t text := regexp_replace(coalesce(new.raw_text,''), '[[:space:]]+', ' ', 'g');
  src text := coalesce(new.meta->>'source','');
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
    new.notification_type := 'like';
    return new;
  end if;

  if t like '%あなたのコメント%に%スキしました%' or t like '%あなたのコメント%へ%スキしました%' or t like '%コメントにスキしました%' or t like '%コメントをスキしました%' then
    new.notification_type := 'comment_like';
  elsif t like '%あなたの記事にスキしました%' or t like '%」にスキしました%' or t like '%新しいスキが%増えました%' then
    new.notification_type := 'like';
  elsif t like '%あなたのコメント%返信%' or t like '%コメントへの返信%' or t like '%コメントに返信しました%' or t like '%返信がありました%' then
    new.notification_type := 'reply';
  elsif t like '%あなたの記事%コメントしました%' or t like '%新しいコメントが%増えました%' or t like '%コメントがありました%' then
    new.notification_type := 'comment';
  elsif t like '%あなたをフォローしました%' or t like '%フォローされました%' or t like '%新しいフォロワー%' or t like '%さんがあなたをフォロー%' then
    new.notification_type := 'follow';
  elsif t like '%あなたの記事が%に追加されました%' or t like '%マガジン%記事%追加しました%' or t like '%マガジン%新しい記事%追加しました%' or t like '%メンバー特典マガジンに記事%' then
    new.notification_type := 'magazine';
  elsif t like '%あなたの記事%話題です%' or t like '%あなたの記事%話題になりました%' then
    new.notification_type := 'buzz';
  elsif t like '%あなたのメンバーシップ%参加しました%' or t like '%あなたのメンバーシップ%メンバーになりました%' or t like '%メンバーシップに参加しました%' then
    new.notification_type := 'membership';
  elsif t like '%あなたの記事が購入されました%' or t like '%あなたの有料記事が購入されました%' or t like '%購入がありました%' or t like '%さんがあなたの記事を購入しました%' then
    new.notification_type := 'purchase';
  elsif t like '%チップを送りました%' or t like '%チップを贈りました%' or t like '%チップを受け取りました%' or t like '%チップが届%' or t like '%サポートされました%' or t like '%サポートを受けました%' then
    new.notification_type := 'tip';
  elsif t like '%あなたの記事%引用され%' or t like '%あなたの記事%紹介され%' then
    new.notification_type := 'quote';
  elsif t like '%あなたの記事を高評価しました%' then
    new.notification_type := 'rating';
  end if;

  return new;
end;
$function$;

update public.insight_notifications
set notification_type = notification_type;
