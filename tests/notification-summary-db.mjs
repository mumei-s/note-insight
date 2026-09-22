import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
export async function summaryDb(t){
 const db=await PGlite.create();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create role service_role;create table public.insight_notifications(id bigserial primary key,member_id text,notification_type text,raw_text text,meta jsonb,actor_name text,actor_url text,target_url text,occurred_at timestamptz,captured_at timestamptz);`);
 await db.exec(readFileSync('supabase/migrations/20260922105609_notification_analysis_aggregate.sql','utf8'));
 const insert=async r=>{await db.query(`insert into public.insight_notifications(member_id,notification_type,raw_text,meta,actor_name,actor_url,target_url,occurred_at,captured_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[r.member_id||'a',r.notification_type||'other',r.raw_text??'通知です',{source:'note-notification-manual-sync-v2968',...r.meta},r.actor_name||'A',r.actor_url||'',r.target_url||'',r.occurred_at??'2026-09-21T00:00:00Z',r.captured_at||'2026-09-22T00:00:00Z'])};
 const summary=async(period=0,now='2026-09-22T12:00:00Z')=>(await db.query('select public.insight_notification_analysis_summary($1,$2,$3,$4) as summary',[['a'],'tester',period,now])).rows[0].summary;
 return{db,insert,summary};
}
