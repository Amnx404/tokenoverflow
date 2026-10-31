-- Package A phase 1: additive storage and ownership compatibility only.
-- Review/local acceptance is authorized; production execution requires approval.
-- Keep existing public SELECT grants/feed shape until the compatible app passes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function private.evidence_observation_valid(p_value jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare code numeric;
begin
  if jsonb_typeof(p_value) is distinct from 'object' then return false; end if;
  if not (p_value ? 'output') or (p_value - array['output','exit_code']) <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(p_value->'output') is distinct from 'string' then return false; end if;
  if char_length(p_value->>'output') > 6000 then return false; end if;
  if p_value ? 'exit_code' then
    if jsonb_typeof(p_value->'exit_code') is distinct from 'number' then return false; end if;
    code := (p_value->>'exit_code')::numeric;
    if code < 0 or code > 255 or code <> trunc(code) then return false; end if;
  elsif char_length(p_value->>'output') = 0 then return false;
  end if;
  return true;
end;
$$;

create or replace function private.evidence_bundle_valid(p_bundle jsonb, p_record_kind text)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare item jsonb; previous jsonb; value text; version_name text; version_kind text; seen jsonb := '[]'::jsonb;
begin
  if p_record_kind is null or p_record_kind not in ('report','fix','verification') then return false; end if;
  if jsonb_typeof(p_bundle) is distinct from 'object' then return false; end if;
  -- Storage JSONB text includes its own escaping/spacing; this is not the app's compact byte budget.
  if octet_length(p_bundle::text) > 16384 then return false; end if;
  if not (p_bundle ?& array['contract_version','check','before_result','after_result','versions'])
    or (p_bundle - array['contract_version','check','before_result','after_result','versions']) <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(p_bundle->'contract_version') is distinct from 'number' then return false; end if;
  if (p_bundle->>'contract_version')::numeric <> 1 then return false; end if;
  item := p_bundle->'check';
  if jsonb_typeof(item) is distinct from 'object' then return false; end if;
  if not (item ?& array['kind','instructions','expected_result'])
    or (item - array['kind','instructions','expected_result']) <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(item->'kind') is distinct from 'string' or item->>'kind' not in ('command','steps') then return false; end if;
  foreach value in array array['instructions','expected_result'] loop
    if jsonb_typeof(item->value) is distinct from 'string' then return false; end if;
    if char_length(item->>value) not between 1 and 2000 then return false; end if;
    -- Application normalizes only U+0020 at edges; direct writers must supply normalized text.
    if (item->>value) collate "C" <> btrim(item->>value, ' ') collate "C" then return false; end if;
  end loop;
  if private.evidence_observation_valid(p_bundle->'before_result') is not true then return false; end if;
  if p_bundle->'after_result' = 'null'::jsonb then
    if p_record_kind = 'verification' then return false; end if;
  else
    if p_record_kind = 'report' then return false; end if;
    if private.evidence_observation_valid(p_bundle->'after_result') is not true then return false; end if;
  end if;
  if jsonb_typeof(p_bundle->'versions') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_bundle->'versions') not between 1 and 12 then return false; end if;
  for item in select v from jsonb_array_elements(p_bundle->'versions') v loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    if not (item ?& array['kind','name','version'])
      or (item - array['kind','name','version']) <> '{}'::jsonb then return false; end if;
    if jsonb_typeof(item->'kind') is distinct from 'string' then return false; end if;
    version_kind := item->>'kind';
    if version_kind not in ('package','runtime','os','model','api','other') then return false; end if;
    if jsonb_typeof(item->'name') is distinct from 'string' then return false; end if;
    version_name := item->>'name';
    if char_length(version_name) not between 1 and 80 or version_name collate "C" <> btrim(version_name,' ') collate "C" then return false; end if;
    if jsonb_typeof(item->'version') = 'string' then
      value := item->>'version';
      if char_length(value) not between 1 and 120 or value collate "C" <> btrim(value,' ') collate "C" then return false; end if;
    elsif jsonb_typeof(item->'version') is distinct from 'null' then return false;
    end if;
    for previous in select v from jsonb_array_elements(seen) v loop
      if (previous->>'kind') collate "C" = version_kind collate "C"
        and (previous->>'name') collate "C" = version_name collate "C" then return false; end if;
    end loop;
    seen := seen || jsonb_build_array(item);
  end loop;
  return true;
end;
$$;
revoke all on function private.evidence_observation_valid(jsonb), private.evidence_bundle_valid(jsonb,text) from public, anon, authenticated;
grant execute on function private.evidence_observation_valid(jsonb), private.evidence_bundle_valid(jsonb,text) to authenticated;

alter table public.reports add column evidence_bundle jsonb;
alter table public.fixes add column evidence_bundle jsonb;
alter table public.verifications add column evidence_bundle jsonb;
alter table public.reports add constraint reports_evidence_bundle_valid check (evidence_bundle is null or private.evidence_bundle_valid(evidence_bundle,'report') is true) not valid;
alter table public.fixes add constraint fixes_evidence_bundle_valid check (evidence_bundle is null or private.evidence_bundle_valid(evidence_bundle,'fix') is true) not valid;
alter table public.verifications add constraint verifications_evidence_bundle_valid check (evidence_bundle is null or private.evidence_bundle_valid(evidence_bundle,'verification') is true) not valid;
grant insert(evidence_bundle) on public.reports, public.fixes, public.verifications to authenticated;
alter table public.reports validate constraint reports_evidence_bundle_valid;
alter table public.fixes validate constraint fixes_evidence_bundle_valid;
alter table public.verifications validate constraint verifications_evidence_bundle_valid;

-- Only these private predicates can inspect hidden authors. No caller account argument.
create or replace function private.fix_is_independent(p_fix_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.fixes f where f.id = p_fix_id and f.author_id <> auth.uid()
  );
$$;
create or replace function private.fix_ownership(p_report_id uuid)
returns table(id uuid, is_own_fix boolean) language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  return query select f.id, f.author_id = auth.uid() from public.fixes f where f.report_id = p_report_id order by f.id;
end;
$$;
create or replace function public.fix_ownership(p_report_id uuid)
returns table(id uuid, is_own_fix boolean) language sql stable security invoker set search_path = '' as $$
  select f.id, f.is_own_fix from private.fix_ownership(p_report_id) f;
$$;
revoke all on function private.fix_is_independent(uuid), private.fix_ownership(uuid), public.fix_ownership(uuid) from public, anon, authenticated;
grant execute on function private.fix_is_independent(uuid), private.fix_ownership(uuid), public.fix_ownership(uuid) to authenticated;

-- Preserve key-owner attribution even when another browser account calls this RPC.
create or replace function private.agent_contribute(p_key text, p_kind text, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; result_id uuid; parent_owner uuid; parent_example boolean; contributions bigint;
begin
 if char_length(p_key) <> 67 then raise exception 'Invalid agent key' using errcode='28000'; end if;
 select user_id into owner_id from private.agent_keys where token_hash=encode(extensions.digest(p_key,'sha256'),'hex') and expires_at>now();
 if owner_id is null then raise exception 'Invalid or expired agent key' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
 select (select count(*) from public.reports where author_id=owner_id and created_at>now()-interval '1 day') +
 (select count(*) from public.fixes where author_id=owner_id and created_at>now()-interval '1 day') +
 (select count(*) from public.verifications where author_id=owner_id and created_at>now()-interval '1 day') into contributions;
 if contributions>=100 then raise exception 'Daily contribution limit reached' using errcode='P0001'; end if;
 if p_kind='report' then
  insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,attempted_fixes,category,tags,evidence_bundle)
  values(owner_id,p_data->>'author_name',p_data->>'title',p_data->>'summary',p_data->>'body',p_data->>'environment',p_data->>'reproduction',coalesce(p_data->>'attempted_fixes',''),p_data->>'category',array(select jsonb_array_elements_text(p_data->'tags')),p_data->'evidence_bundle') returning id into result_id;
 elsif p_kind='fix' then
  select is_example into parent_example from public.reports where id=(p_data->>'report_id')::uuid;
  if parent_example is null then raise exception 'Report not found' using errcode='23503'; end if;
  if parent_example then raise exception 'Choose a community report' using errcode='42501'; end if;
  insert into public.fixes(report_id,author_id,author_name,body,environment,evidence,evidence_bundle)
  values((p_data->>'report_id')::uuid,owner_id,p_data->>'author_name',p_data->>'body',p_data->>'environment',p_data->>'evidence',p_data->'evidence_bundle') returning id into result_id;
 elsif p_kind='verification' then
  select author_id into parent_owner from public.fixes where id=(p_data->>'fix_id')::uuid;
  if parent_owner is null then raise exception 'Fix not found' using errcode='23503'; end if;
  if parent_owner=owner_id then raise exception 'Verification needs an independent contributor' using errcode='42501'; end if;
  insert into public.verifications(fix_id,author_id,author_name,outcome,environment,notes,evidence_bundle)
  values((p_data->>'fix_id')::uuid,owner_id,p_data->>'author_name',p_data->>'outcome',p_data->>'environment',p_data->>'notes',p_data->'evidence_bundle') returning id into result_id;
 else raise exception 'Unsupported contribution type' using errcode='23514';
 end if;
 return result_id;
end;
$$;
revoke all on function private.agent_contribute(text,text,jsonb) from public;
grant execute on function private.agent_contribute(text,text,jsonb) to anon, authenticated;
commit;
