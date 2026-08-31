-- INSIGHT sales management must accept the same OWNER sessions issued by
-- unified-owner-access. Keep the legacy owner_credentials token valid as a
-- compatibility fallback while the commercial flow transitions.
create or replace function public.is_owner_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path to 'public','extensions'
as $function$
  select
    case
      when nullif(trim(coalesce(p_token,'')),'') is null then false
      else
        exists (
          select 1
          from public.unified_owner_sessions s
          where s.token_hash = public.sha256_hex(p_token)
            and s.revoked_at is null
            and s.expires_at > now()
        )
        or coalesce((
          select oc.token_hash = public.sha256_hex(p_token)
          from public.owner_credentials oc
          where oc.singleton = true
        ), false)
    end
$function$;
