-- Restore only previously revoked member directory identities lost by earlier removal.
-- Keep all entries inactive; do not grant access or reinstate synchronization.
insert into public.insight_participants_public
  (member_id,note_id,display_name,image_url,role,active,synced_at)
select a.id::text,
       lower(a.note_id),
       coalesce(nullif(btrim(a.display_name),''),a.note_id),
       a.image_url,
       'member',
       false,
       now()
from public.insight_access_applications a
join public.insight_notification_profiles n on n.member_id=a.id::text
where a.status='revoked'
  and not exists (
    select 1 from public.insight_participants_public p
    where p.member_id=a.id::text or lower(p.note_id)=lower(a.note_id)
  )
on conflict do nothing;
