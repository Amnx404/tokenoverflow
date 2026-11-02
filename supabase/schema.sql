-- Token Overflow: public evidence, authenticated contributions, scoped agent keys.
create schema if not exists private;
revoke all on schema private from public;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 80),
  title text not null check (char_length(title) between 10 and 200),
  summary text not null check (char_length(summary) between 20 and 500),
  body text not null check (char_length(body) between 20 and 20000),
  environment text not null check (char_length(environment) between 3 and 2000),
  reproduction text not null check (char_length(reproduction) between 20 and 10000),
  attempted_fixes text not null default '' check (char_length(attempted_fixes) <= 10000),
  category text not null check (category in ('APIs','Frameworks','Infrastructure','AI models','Other')),
  tags text[] not null default '{}' check (cardinality(tags) <= 8 and char_length(array_to_string(tags, ',')) <= 240),
  is_example boolean not null default false,
  created_at timestamptz not null default now(),
  search_document tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', summary || ' ' || environment), 'B') ||
    setweight(to_tsvector('english', body || ' ' || reproduction), 'C')
  ) stored
);
create index reports_search_idx on public.reports using gin(search_document);
create index reports_created_idx on public.reports(created_at desc);
create index reports_author_idx on public.reports(author_id);
create index reports_category_idx on public.reports(category);

create table public.fixes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  body text not null check (char_length(body) between 20 and 20000),
  environment text not null check (char_length(environment) between 3 and 2000),
  evidence text not null check (char_length(evidence) between 10 and 10000),
  created_at timestamptz not null default now()
);
create index fixes_report_idx on public.fixes(report_id);
create index fixes_author_idx on public.fixes(author_id);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  fix_id uuid not null references public.fixes(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  outcome text not null check (outcome in ('worked','failed')),
  environment text not null check (char_length(environment) between 3 and 2000),
  notes text not null check (char_length(notes) between 10 and 10000),
  created_at timestamptz not null default now(),
  unique(fix_id, author_id, environment)
);
create index verifications_fix_idx on public.verifications(fix_id);
create index verifications_author_idx on public.verifications(author_id);

alter table public.reports enable row level security;
alter table public.fixes enable row level security;
alter table public.verifications enable row level security;

grant select on public.reports, public.fixes, public.verifications to anon, authenticated;
grant insert (id, author_id, author_name, title, summary, body, environment, reproduction, attempted_fixes, category, tags) on public.reports to authenticated;
grant insert (id, report_id, author_id, author_name, body, environment, evidence) on public.fixes to authenticated;
grant insert (id, fix_id, author_id, author_name, outcome, environment, notes) on public.verifications to authenticated;

create policy reports_read on public.reports for select to anon, authenticated using (true);
create policy reports_create on public.reports for insert to authenticated with check ((select auth.uid()) = author_id and not is_example);
create policy fixes_read on public.fixes for select to anon, authenticated using (true);
create policy fixes_create on public.fixes for insert to authenticated with check ((select auth.uid()) = author_id and exists(select 1 from public.reports r where r.id = report_id and not r.is_example));
create policy verifications_read on public.verifications for select to anon, authenticated using (true);
create policy verifications_create on public.verifications for insert to authenticated with check ((select auth.uid()) = author_id and exists(select 1 from public.fixes f where f.id = fix_id and f.author_id <> (select auth.uid())));

create view public.report_feed with (security_invoker = true) as
select r.id, r.author_id, r.author_name, r.title, r.summary, r.environment, r.category, r.tags, r.is_example, r.created_at,
 (select count(*)::int from public.fixes f where f.report_id = r.id) as fix_count,
 (select count(*)::int from public.verifications v join public.fixes f on f.id = v.fix_id where f.report_id = r.id and v.outcome = 'worked') as worked_count,
 (select count(*)::int from public.verifications v join public.fixes f on f.id = v.fix_id where f.report_id = r.id and v.outcome = 'failed') as failed_count
from public.reports r;
grant select on public.report_feed to anon, authenticated;

-- Agent tokens are only stored as SHA-256 hashes. Private schema is not exposed
-- through the Data API. These narrow routines are the only privileged entrypoints.
create table private.agent_keys (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 80),
 token_hash text not null unique,
 prefix text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '90 days'
);
create index agent_keys_user_idx on private.agent_keys(user_id);
alter table private.agent_keys enable row level security;
revoke all on private.agent_keys from public, anon, authenticated;

create function private.create_agent_key(p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare token text; key_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
 if (select count(*) from private.agent_keys where user_id=auth.uid()) >= 10 then raise exception 'Limit of 10 keys reached'; end if;
 token := 'to_' || encode(extensions.gen_random_bytes(32), 'hex');
 insert into private.agent_keys(user_id,name,token_hash,prefix)
 values(auth.uid(),p_name,encode(extensions.digest(token,'sha256'),'hex'),left(token,11)) returning id into key_id;
 return jsonb_build_object('id',key_id,'token',token);
end $$;
create function private.list_agent_keys() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='28000'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'prefix',prefix,'created_at',created_at,'expires_at',expires_at) order by created_at desc),'[]'::jsonb) from private.agent_keys where user_id=auth.uid());
end $$;
create function private.revoke_agent_key(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='28000'; end if;
 delete from private.agent_keys where id=p_id and user_id=auth.uid();
 return found;
end $$;

create function private.agent_contribute(p_key text, p_kind text, p_data jsonb) returns uuid
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
  insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,attempted_fixes,category,tags)
  values(owner_id,p_data->>'author_name',p_data->>'title',p_data->>'summary',p_data->>'body',p_data->>'environment',p_data->>'reproduction',coalesce(p_data->>'attempted_fixes',''),p_data->>'category',array(select jsonb_array_elements_text(p_data->'tags'))) returning id into result_id;
 elsif p_kind='fix' then
  select is_example into parent_example from public.reports where id=(p_data->>'report_id')::uuid;
  if parent_example is null or parent_example then raise exception 'Choose a community report'; end if;
  insert into public.fixes(report_id,author_id,author_name,body,environment,evidence)
  values((p_data->>'report_id')::uuid,owner_id,p_data->>'author_name',p_data->>'body',p_data->>'environment',p_data->>'evidence') returning id into result_id;
 elsif p_kind='verification' then
  select author_id into parent_owner from public.fixes where id=(p_data->>'fix_id')::uuid;
  if parent_owner is null then raise exception 'Fix not found'; end if;
  if parent_owner=owner_id then raise exception 'Verification needs an independent contributor'; end if;
  insert into public.verifications(fix_id,author_id,author_name,outcome,environment,notes)
  values((p_data->>'fix_id')::uuid,owner_id,p_data->>'author_name',p_data->>'outcome',p_data->>'environment',p_data->>'notes') returning id into result_id;
 else raise exception 'Unsupported contribution type';
 end if;
 return result_id;
end $$;

revoke all on function private.create_agent_key(text), private.list_agent_keys(), private.revoke_agent_key(uuid), private.agent_contribute(text,text,jsonb) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.create_agent_key(text), private.list_agent_keys(), private.revoke_agent_key(uuid) to authenticated;
grant execute on function private.agent_contribute(text,text,jsonb) to anon, authenticated;

create function public.create_agent_key(p_name text) returns jsonb language sql security invoker set search_path='' as $$ select private.create_agent_key(p_name); $$;
create function public.list_agent_keys() returns jsonb language sql security invoker set search_path='' as $$ select private.list_agent_keys(); $$;
create function public.revoke_agent_key(p_id uuid) returns boolean language sql security invoker set search_path='' as $$ select private.revoke_agent_key(p_id); $$;
create function public.agent_contribute(p_key text,p_kind text,p_data jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.agent_contribute(p_key,p_kind,p_data); $$;
revoke all on function public.create_agent_key(text), public.list_agent_keys(), public.revoke_agent_key(uuid), public.agent_contribute(text,text,jsonb) from public;
grant execute on function public.create_agent_key(text), public.list_agent_keys(), public.revoke_agent_key(uuid) to authenticated;
grant execute on function public.agent_contribute(text,text,jsonb) to anon, authenticated;

-- An explicitly marked example, based on the founder's supplied post. No fix or
-- reproduction is claimed, and examples are excluded from public API results.
insert into public.reports(author_name,title,summary,body,environment,reproduction,attempted_fixes,category,tags,is_example)
values ('Founding example','ElevenLabs unexpectedly switches to Chinese during speech generation',
'A debugging session should become a useful starting point for the next person who encounters the same behavior.',
'The founder reported spending approximately $500 in API calls investigating speech unexpectedly switching to Chinese. This example shows the kind of finding Token Overflow is designed to preserve. It is not an independently reproduced bug report, and no cause or workaround has been established here.',
'Exact model, SDK version, voice settings, and request parameters were not included in the original post.',
'A minimal reproduction has not been supplied. A useful contribution would include a sanitized request, expected language, actual output, and exact model and SDK versions.',
'The original post mentions repeated debugging attempts but does not include a tested list. Do not treat any explanation as a confirmed cause.',
'AI models',array['elevenlabs','text-to-speech','language-drift'],true);
create index reports_tags_idx on public.reports using gin(tags);
create function public.search_reports(p_query text) returns setof public.report_feed
language sql stable security invoker set search_path='' as $$
 select f.* from public.report_feed f join public.reports r on r.id=f.id
 where r.search_document @@ websearch_to_tsquery('english',left(p_query,300))
 or r.tags @> array[lower(left(p_query,300))];
$$;
revoke all on function public.search_reports(text) from public;
grant execute on function public.search_reports(text) to anon,authenticated;
create policy agent_keys_no_direct_access on private.agent_keys as restrictive for all to anon,authenticated using(false) with check(false);


-- Applied contribution guardrails (2026-10-30); fresh installations include these overrides.
-- Apply after schema.sql, as postgres. This is a reviewable SQL change, not a
-- generated Supabase migration-history entry. Public reads remain unrestricted.
begin;

-- Supabase installations can have broad default table grants. Column grants
-- alone do not remove those: explicitly reset client privileges first.
revoke all on public.reports, public.fixes, public.verifications from public, anon, authenticated;
grant select on public.reports, public.fixes, public.verifications to anon, authenticated;
grant insert (id, author_id, author_name, title, summary, body, environment, reproduction, attempted_fixes, category, tags) on public.reports to authenticated;
grant insert (id, report_id, author_id, author_name, body, environment, evidence) on public.fixes to authenticated;
grant insert (id, fix_id, author_id, author_name, outcome, environment, notes) on public.verifications to authenticated;

create or replace function private.normalize_report_tags() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  -- Preserve first-seen ordering while canonicalizing every insertion path.
  select coalesce(array_agg(t.tag order by t.first_position), '{}'::text[])
  into new.tags
  from (
    select lower(regexp_replace(u.tag, '^[[:space:]]+|[[:space:]]+$', '', 'g')) as tag,
      min(u.position) as first_position
    from unnest(new.tags) with ordinality as u(tag, position)
    group by lower(regexp_replace(u.tag, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
  ) t where t.tag is not null and t.tag <> '';
  if exists (select 1 from unnest(new.tags) t where char_length(t) > 30) then
    raise exception 'Tags must contain at most 30 characters' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.normalize_report_tags() from public, anon, authenticated;
create or replace trigger normalize_report_tags
before insert or update of tags on public.reports
for each row execute function private.normalize_report_tags();

-- Canonicalize existing tags as well; this does not create contributions.
update public.reports set tags = tags;

-- Timestamp assignment happens before constraints/RLS. Quota checks happen after
-- RLS has accepted ownership, so wrong-owner inserts cannot probe quotas.
create or replace function private.stamp_contribution() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.created_at := now();
  return new;
end;
$$;
revoke all on function private.stamp_contribution() from public, anon, authenticated;
create or replace trigger stamp_contribution before insert on public.reports
for each row execute function private.stamp_contribution();
create or replace trigger stamp_contribution before insert on public.fixes
for each row execute function private.stamp_contribution();
create or replace trigger stamp_contribution before insert on public.verifications
for each row execute function private.stamp_contribution();

create or replace function private.enforce_contribution_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare contributions bigint;
begin
  -- Only privileged seed writes can pass RLS/column grants with an unowned
  -- example. Never use auth.uid() for the quota: agent RPCs run as a definer
  -- and may be called anonymously or with another account's browser session.
  if new.author_id is null then
    if tg_table_name = 'reports' then
      if new.is_example then return new; end if;
    end if;
    raise exception 'A contribution requires an author' using errcode = '23514';
  end if;

  -- Counts after a lock need a fresh snapshot. Reject transaction-wide stale
  -- snapshots rather than permitting concurrent REPEATABLE READ quota bypass.
  if current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
    raise exception 'Contributions require a READ COMMITTED transaction' using errcode = '40001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.author_id::text, 0));
  select (select count(*) from public.reports where author_id = new.author_id and created_at > now() - interval '1 day')
       + (select count(*) from public.fixes where author_id = new.author_id and created_at > now() - interval '1 day')
       + (select count(*) from public.verifications where author_id = new.author_id and created_at > now() - interval '1 day')
  into contributions;
  if contributions > 100 then
    raise exception 'Daily contribution limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
-- This function needs elevated SELECT privileges for an authoritative count,
-- but has no callable API surface and never returns another user's data.
revoke all on function private.enforce_contribution_limit() from public, anon, authenticated;
create or replace trigger enforce_contribution_limit
after insert on public.reports for each row execute function private.enforce_contribution_limit();
create or replace trigger enforce_contribution_limit
after insert on public.fixes for each row execute function private.enforce_contribution_limit();
create or replace trigger enforce_contribution_limit
after insert on public.verifications for each row execute function private.enforce_contribution_limit();

-- Normalize the lookup boundary too, including tag queries containing spaces.
create or replace function public.search_reports(p_query text) returns setof public.report_feed
language sql stable security invoker set search_path = '' as $$
  select f.* from public.report_feed f join public.reports r on r.id = f.id
  where r.search_document @@ websearch_to_tsquery('english', left(p_query, 300))
     or r.tags @> array[lower(regexp_replace(left(p_query, 300), '^[[:space:]]+|[[:space:]]+$', '', 'g'))];
$$;
revoke all on function public.search_reports(text) from public;
grant execute on function public.search_reports(text) to anon, authenticated;

commit;


-- Package A fresh-install final state: deployed upgrades must instead apply
-- the reviewed phased changes with the compatible-application gate between.

-- Reviewed change: 20261031011039_evidence_bundle_additive.sql
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

-- Reviewed change: 20261031011132_evidence_privacy_restrict.sql
-- Package A phase 3: apply ONLY after the compatible explicit-column app and
-- fresh-auth ownership path passed on phase 1. Old SELECT-star apps are unsafe
-- after this stage. Rollback floor: retain a tested compatible application.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- The old RLS subquery needed hidden author_id SELECT. Use only the narrow
-- authenticated identity-bound predicate, positive EXISTS for independent fixes.
alter policy verifications_create on public.verifications with check (
  (select auth.uid()) = author_id and private.fix_is_independent(fix_id)
);

-- Preserve the view's column order/type so dependent search RPCs remain intact.
-- Its invoker view no longer reads the hidden account column at all.
create or replace view public.report_feed with (security_invoker = true) as
select r.id, null::uuid as author_id, r.author_name, r.title, r.summary, r.environment, r.category, r.tags, r.is_example, r.created_at,
 (select count(*)::int from public.fixes f where f.report_id = r.id) as fix_count,
 (select count(*)::int from public.verifications v join public.fixes f on f.id = v.fix_id where f.report_id = r.id and v.outcome = 'worked') as worked_count,
 (select count(*)::int from public.verifications v join public.fixes f on f.id = v.fix_id where f.report_id = r.id and v.outcome = 'failed') as failed_count
from public.reports r;

revoke select on public.reports, public.fixes, public.verifications from public, anon, authenticated;
-- Clear any explicit identifier grant as well as the former table-wide grant.
revoke select(author_id) on public.reports, public.fixes, public.verifications from public, anon, authenticated;
grant select(id,author_name,title,summary,body,environment,reproduction,attempted_fixes,category,tags,is_example,created_at,search_document,evidence_bundle) on public.reports to anon, authenticated;
grant select(id,report_id,author_name,body,environment,evidence,created_at,evidence_bundle) on public.fixes to anon, authenticated;
grant select(id,fix_id,author_name,outcome,environment,notes,created_at,evidence_bundle) on public.verifications to anon, authenticated;
grant select on public.report_feed to anon, authenticated;
commit;

-- Discussion comments: additive source, identical to 20261031064737_discussion_comments.sql
-- Additive discussion resource only. SOURCE REVIEW; no existing contribution/key grants change.
create table public.discussion_comments (
 id uuid primary key,
 report_id uuid not null references public.reports(id) on delete restrict,
 parent_id uuid,
 root_id uuid not null,
 depth integer not null check(depth between 0 and 8),
 author_id uuid references auth.users(id) on delete set null,
 author_name text,
 body text,
 created_at timestamptz not null default clock_timestamp(),
 redacted_at timestamptz,
 create_request_id uuid not null,
 create_fingerprint bytea not null check(octet_length(create_fingerprint)=32),
 unique(report_id,id), unique(author_id,create_request_id),
 foreign key(report_id,parent_id) references public.discussion_comments(report_id,id) on delete restrict,
 foreign key(report_id,root_id) references public.discussion_comments(report_id,id) on delete restrict,
 check((parent_id is null and root_id=id and depth=0) or (parent_id is not null and parent_id<>id and root_id<>id and depth between 1 and 8)),
 check((redacted_at is null and author_name is not null and body is not null) or (redacted_at is not null and author_name is null and body is null)),
 check(author_name is null or char_length(author_name) between 1 and 80),
 check(body is null or (char_length(body) between 1 and 2000 and octet_length(body)<=8192 and btrim(body,U&'\0009\000A\000B\000C\000D\0020\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')<>''))
);
create index discussion_comments_page_idx on public.discussion_comments(report_id,parent_id,created_at,id);
create index discussion_comments_account_time_idx on public.discussion_comments(author_id,created_at);
alter table public.discussion_comments enable row level security;
revoke all on public.discussion_comments from public,anon,authenticated;
grant select(id,report_id,parent_id,root_id,depth,author_name,body,created_at,redacted_at) on public.discussion_comments to anon,authenticated;
create policy discussion_comments_public_read on public.discussion_comments for select to anon,authenticated using(true);

create table private.discussion_audit (
 id uuid primary key default gen_random_uuid(),
 comment_id uuid not null references public.discussion_comments(id) on delete restrict,
 operation text not null check(operation in ('own_redact','emergency_hide')),
 actor_id uuid references auth.users(id) on delete set null,
 operator_role name,
 happened_at timestamptz not null default clock_timestamp(),
 reason_code text not null check(reason_code in ('owner_request','sensitive_content','abuse','legal'))
);
alter table private.discussion_audit enable row level security;
revoke all on private.discussion_audit from public,anon,authenticated;

-- No public account-ID helper. Definer mutations/capabilities call this themselves.
create function private.discussion_require_actor() returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise sqlstate 'PT401' using message='discussion unauthorized'; end if;
 if (auth.jwt() ? 'client_id') or (auth.jwt()->>'role') is distinct from 'authenticated' then raise sqlstate 'PT403' using message='discussion unsupported actor'; end if;
 perform u.id from auth.users u where u.id=actor and u.is_anonymous is false for share;
 if not found then raise sqlstate 'PT403' using message='discussion unsupported account'; end if;
 return actor;
end $$;
revoke all on function private.discussion_require_actor() from public,anon,authenticated;

create function private.discussion_guard_structure() returns trigger
language plpgsql set search_path='' as $$
declare parent public.discussion_comments%rowtype;
begin
 if TG_OP='DELETE' then raise sqlstate 'PT403' using message='discussion hard delete forbidden'; end if;
 if TG_OP='INSERT' then
  if new.parent_id is not null then
   select * into parent from public.discussion_comments c where c.report_id=new.report_id and c.id=new.parent_id for share;
   if not found then raise sqlstate 'PT404' using message='discussion parent unavailable'; end if;
   if parent.redacted_at is not null then raise sqlstate 'PT409' using message='discussion parent redacted'; end if;
   if new.root_id<>parent.root_id or new.depth<>parent.depth+1 then raise sqlstate 'PT400' using message='discussion structure invalid'; end if;
  end if;
  return new;
 end if;
 if row(new.id,new.report_id,new.parent_id,new.root_id,new.depth,new.created_at,new.create_request_id,new.create_fingerprint) is distinct from row(old.id,old.report_id,old.parent_id,old.root_id,old.depth,old.created_at,old.create_request_id,old.create_fingerprint) then raise sqlstate 'PT403' using message='discussion structure immutable'; end if;
 if new.author_id is distinct from old.author_id and not(old.author_id is not null and new.author_id is null and not exists(select 1 from auth.users u where u.id=old.author_id)) then raise sqlstate 'PT403' using message='discussion attribution immutable'; end if;
 if old.redacted_at is not null then
  if row(new.body,new.author_name,new.redacted_at) is distinct from row(old.body,old.author_name,old.redacted_at) then raise sqlstate 'PT403' using message='discussion redaction irreversible'; end if;
 elsif new.redacted_at is null then
  if row(new.body,new.author_name) is distinct from row(old.body,old.author_name) then raise sqlstate 'PT403' using message='discussion append only'; end if;
 elsif new.body is not null or new.author_name is not null then raise sqlstate 'PT403' using message='discussion invalid tombstone';
 end if;
 return new;
end $$;
revoke all on function private.discussion_guard_structure() from public,anon,authenticated;
create trigger discussion_comments_immutable before insert or update or delete on public.discussion_comments for each row execute function private.discussion_guard_structure();

-- Explicit public projection and canonical database-microsecond UTC strings.
create function public.discussion_public_comment(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'report_id',c.report_id,'parent_id',c.parent_id,'root_id',c.root_id,'depth',c.depth,'author_name',c.author_name,'body',c.body,'created_at',to_char(c.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'redacted_at',case when c.redacted_at is null then null else to_char(c.redacted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end)
 from public.discussion_comments c where c.id=p_id;
$$;
revoke all on function public.discussion_public_comment(uuid) from public;
grant execute on function public.discussion_public_comment(uuid) to anon,authenticated;

create function private.discussion_receipt(p_id uuid,p_request_id uuid default null) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'report_id',c.report_id,'parent_id',c.parent_id,'root_id',c.root_id,'depth',c.depth,'created_at',to_char(c.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'redacted_at',case when c.redacted_at is null then null else to_char(c.redacted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end) || case when p_request_id is null then '{}'::jsonb else jsonb_build_object('request_id',p_request_id) end
 from public.discussion_comments c where c.id=p_id;
$$;
revoke all on function private.discussion_receipt(uuid,uuid) from public,anon,authenticated;

create function private.append_discussion_comment(p_report_id uuid,p_parent_id uuid,p_request_id uuid,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; existing public.discussion_comments%rowtype; parent public.discussion_comments%rowtype; body_text text; fingerprint bytea; stamp timestamptz; new_id uuid; root uuid; level integer; display_name text;
begin
 actor:=private.discussion_require_actor();
 if current_setting('transaction_isolation') not in ('read committed','read uncommitted') then raise sqlstate 'PT400' using message='Discussion writes require READ COMMITTED isolation.'; end if;
 -- Distinct two-int discussion namespace; collisions only serialize extra accounts.
 perform pg_advisory_xact_lock(1146311763,hashtext(actor::text));
 stamp:=clock_timestamp(); -- AFTER account lock, never transaction now().
 if p_report_id is null or p_request_id is null or (p_body is not null and jsonb_typeof(p_body)='string') is not true then raise sqlstate 'PT400' using message='discussion required input'; end if;
 body_text:=p_body#>>'{}';
 if char_length(body_text) not between 1 and 2000 or octet_length(body_text)>8192 or btrim(body_text,U&'\0009\000A\000B\000C\000D\0020\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')='' then raise sqlstate 'PT400' using message='discussion body invalid'; end if;
 fingerprint:=extensions.digest(convert_to(p_report_id::text||':'||coalesce(p_parent_id::text,'null')||':'||body_text,'UTF8'),'sha256');
 select * into existing from public.discussion_comments c where c.author_id=actor and c.create_request_id=p_request_id;
 if found then
  if existing.create_fingerprint<>fingerprint then raise sqlstate 'PT409' using message='discussion request reused'; end if;
  return private.discussion_receipt(existing.id,p_request_id); -- Current tombstone, no resurrection/quota charge.
 end if;
 perform r.id from public.reports r where r.id=p_report_id for key share;
 if not found then raise sqlstate 'PT404' using message='discussion finding unavailable'; end if;
 new_id:=gen_random_uuid();root:=new_id;level:=0;
 if p_parent_id is not null then
  select * into parent from public.discussion_comments c where c.report_id=p_report_id and c.id=p_parent_id for share;
  if not found then raise sqlstate 'PT404' using message='discussion parent unavailable'; end if;
  if parent.redacted_at is not null then raise sqlstate 'PT409' using message='discussion parent redacted'; end if;
  if parent.depth>=8 then raise sqlstate 'PT400' using message='discussion depth limit'; end if;
  root:=parent.root_id;level:=parent.depth+1;
 end if;
 if (select count(*) from public.discussion_comments c where c.author_id=actor and c.created_at>stamp-interval '24 hours')>=20 or (select count(*) from public.discussion_comments c where c.author_id=actor and c.created_at>stamp-interval '60 seconds')>=5 then raise sqlstate 'PT429' using message='discussion create limit'; end if;
 select case when jsonb_typeof(u.raw_user_meta_data->'display_name')='string' then nullif(left(btrim(u.raw_user_meta_data->>'display_name',' '),80),'') else null end into display_name from auth.users u where u.id=actor;
 display_name:=coalesce(display_name,'Contributor');
 insert into public.discussion_comments(id,report_id,parent_id,root_id,depth,author_id,author_name,body,created_at,create_request_id,create_fingerprint) values(new_id,p_report_id,p_parent_id,root,level,actor,display_name,body_text,stamp,p_request_id,fingerprint);
 return private.discussion_receipt(new_id,p_request_id);
exception
 when sqlstate 'PT400' or sqlstate 'PT401' or sqlstate 'PT403' or sqlstate 'PT404' or sqlstate 'PT409' or sqlstate 'PT429' then raise;
 when others then raise sqlstate 'PT500' using message='Discussion request could not be completed.';
end $$;
revoke all on function private.append_discussion_comment(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.append_discussion_comment(uuid,uuid,uuid,jsonb) to authenticated;

create function private.redact_discussion_comment(p_comment_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; target public.discussion_comments%rowtype;
begin
 actor:=auth.uid();
 if actor is null then raise sqlstate 'PT401' using message='discussion unauthorized'; end if;
 perform pg_advisory_xact_lock(1146311763,hashtext(actor::text));
 actor:=private.discussion_require_actor();
 if p_comment_id is null then raise sqlstate 'PT400' using message='discussion comment required'; end if;
 select * into target from public.discussion_comments c where c.id=p_comment_id for update;
 if not found then raise sqlstate 'PT404' using message='discussion target unavailable'; end if;
 if target.author_id is distinct from actor then raise sqlstate 'PT403' using message='discussion not owner'; end if;
 if target.redacted_at is null then
  update public.discussion_comments set body=null,author_name=null,redacted_at=clock_timestamp() where id=p_comment_id;
  insert into private.discussion_audit(comment_id,operation,actor_id,reason_code) values(p_comment_id,'own_redact',actor,'owner_request');
 end if;
 return private.discussion_receipt(p_comment_id);
exception
 when sqlstate 'PT400' or sqlstate 'PT401' or sqlstate 'PT403' or sqlstate 'PT404' or sqlstate 'PT409' or sqlstate 'PT429' then raise;
 when others then raise sqlstate 'PT500' using message='Discussion request could not be completed.';
end $$;
revoke all on function private.redact_discussion_comment(uuid) from public,anon,authenticated;
grant execute on function private.redact_discussion_comment(uuid) to authenticated;
grant usage on schema private to authenticated;

create function public.append_discussion_comment(p_report_id uuid,p_parent_id uuid,p_request_id uuid,p_body jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.append_discussion_comment(p_report_id,p_parent_id,p_request_id,p_body);$$;
create function public.redact_discussion_comment(p_comment_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.redact_discussion_comment(p_comment_id);$$;
revoke all on function public.append_discussion_comment(uuid,uuid,uuid,jsonb),public.redact_discussion_comment(uuid) from public,anon,authenticated;
grant execute on function public.append_discussion_comment(uuid,uuid,uuid,jsonb),public.redact_discussion_comment(uuid) to authenticated;

create function public.discussion_ancestors(p_report_id uuid,p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with recursive chain as (
  select c.id,c.parent_id,c.depth,1 as step from public.discussion_comments c where c.report_id=p_report_id and c.id=(select t.parent_id from public.discussion_comments t where t.report_id=p_report_id and t.id=p_id)
  union all
  select c.id,c.parent_id,c.depth,chain.step+1 from public.discussion_comments c join chain on c.id=chain.parent_id where c.report_id=p_report_id and chain.step<8
 ) select coalesce(jsonb_agg(public.discussion_public_comment(id) order by depth),'[]'::jsonb) from chain;
$$;
create function public.list_discussion_comments(p_report_id uuid,p_parent_id uuid default null,p_limit integer default 20,p_after_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare parent jsonb:=null; items jsonb; clipped jsonb; after_time timestamptz; has_more boolean; next_id uuid;
begin
 if p_report_id is null or p_limit is null or p_limit<1 or p_limit>50 then raise sqlstate 'PT400' using message='discussion page invalid'; end if;
 perform r.id from public.reports r where r.id=p_report_id;
 if not found then raise sqlstate 'PT404' using message='discussion finding unavailable'; end if;
 if p_parent_id is not null then
  parent:=public.discussion_public_comment(p_parent_id);
  if parent is null or (parent->>'report_id')::uuid<>p_report_id then raise sqlstate 'PT404' using message='discussion parent unavailable'; end if;
 end if;
 if p_after_id is not null then
  select c.created_at into after_time from public.discussion_comments c where c.id=p_after_id and c.report_id=p_report_id and c.parent_id is not distinct from p_parent_id;
  if not found then raise sqlstate 'PT400' using message='discussion cursor invalid'; end if;
 end if;
 select coalesce(jsonb_agg(public.discussion_public_comment(q.id) order by q.created_at,q.id),'[]'::jsonb) into items from (
  select c.id,c.created_at from public.discussion_comments c where c.report_id=p_report_id and c.parent_id is not distinct from p_parent_id and (p_after_id is null or (c.created_at,c.id)>(after_time,p_after_id)) order by c.created_at,c.id limit p_limit+1
 )q;
 has_more:=jsonb_array_length(items)>p_limit;
 select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into clipped from jsonb_array_elements(items) with ordinality a(value,ord) where ord<=p_limit;
 next_id:=case when has_more then (clipped->(p_limit-1)->>'id')::uuid else null end;
 return jsonb_build_object('parent',parent,'ancestors',case when p_parent_id is null then '[]'::jsonb else public.discussion_ancestors(p_report_id,p_parent_id) end,'comments',clipped,'has_more',has_more,'next_id',next_id);
end $$;
create function public.get_discussion_context(p_report_id uuid,p_comment_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare target jsonb;
begin
 if p_report_id is null or p_comment_id is null then raise sqlstate 'PT400' using message='discussion context invalid'; end if;
 target:=public.discussion_public_comment(p_comment_id);
 if target is null or (target->>'report_id')::uuid<>p_report_id then return jsonb_build_object('status','unavailable','comment',null,'ancestors','[]'::jsonb); end if;
 return jsonb_build_object('status','available','comment',target,'ancestors',public.discussion_ancestors(p_report_id,p_comment_id));
end $$;
revoke all on function public.discussion_ancestors(uuid,uuid),public.list_discussion_comments(uuid,uuid,integer,uuid),public.get_discussion_context(uuid,uuid) from public;
grant execute on function public.discussion_ancestors(uuid,uuid),public.list_discussion_comments(uuid,uuid,integer,uuid),public.get_discussion_context(uuid,uuid) to anon,authenticated;

create function private.discussion_redaction_capabilities(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=private.discussion_require_actor();
 if p_ids is null or cardinality(p_ids)>59 then raise sqlstate 'PT400' using message='discussion capability page invalid'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'can_redact',(c.author_id=actor and c.redacted_at is null) is true)),'[]'::jsonb) from public.discussion_comments c where c.id=any(p_ids));
end $$;
create function public.discussion_redaction_capabilities(p_ids uuid[]) returns jsonb language sql security invoker set search_path='' as $$select private.discussion_redaction_capabilities(p_ids);$$;
revoke all on function private.discussion_redaction_capabilities(uuid[]),public.discussion_redaction_capabilities(uuid[]) from public,anon,authenticated;
grant execute on function private.discussion_redaction_capabilities(uuid[]),public.discussion_redaction_capabilities(uuid[]) to authenticated;

-- Owner-only exact-comment emergency path. No client execute grant or standing role.
create function private.emergency_hide_discussion_comment(p_comment_id uuid,p_reason_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if session_user<>current_user then raise sqlstate 'PT403' using message='discussion operator only'; end if;
 if p_comment_id is null or p_reason_code is null or p_reason_code not in ('sensitive_content','abuse','legal') then raise sqlstate 'PT400' using message='discussion exact hide reason required'; end if;
 perform c.id from public.discussion_comments c where c.id=p_comment_id for update;
 if not found then raise sqlstate 'PT404' using message='discussion target unavailable'; end if;
 if exists(select 1 from public.discussion_comments c where c.id=p_comment_id and c.redacted_at is null) then
  update public.discussion_comments set body=null,author_name=null,redacted_at=clock_timestamp() where id=p_comment_id;
  insert into private.discussion_audit(comment_id,operation,operator_role,reason_code) values(p_comment_id,'emergency_hide',session_user,p_reason_code);
 end if;
 return private.discussion_receipt(p_comment_id);
end $$;
revoke all on function private.emergency_hide_discussion_comment(uuid,text) from public,anon,authenticated;

-- Native OAuth backend: OFF by default; identical additive migration.
-- OFF by default. Source only: no login membership/binding is granted by this migration.
-- Owner activation contract: inspect exact restricted NOINHERIT login, grant ONLY
-- tokenoverflow_oauth_backend membership to that named login, then INSERT its exact
-- name into private.oauth_backend_logins as owner. Never authenticator/anon/authenticated.
do $$begin
 if not exists(select 1 from pg_roles where rolname='tokenoverflow_oauth_backend') then
  create role tokenoverflow_oauth_backend nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
 end if;
 if exists(select 1 from pg_roles where rolname='tokenoverflow_oauth_backend' and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls)) then raise exception 'Unsafe OAuth backend role';end if;
end$$;
create table private.oauth_backend_logins(login name primary key check(login not in ('postgres','service_role','supabase_admin','authenticator','anon','authenticated')));
create table private.oauth_grants(
 provider_id text primary key check(char_length(provider_id) between 1 and 2048),
 generation_id uuid not null unique default gen_random_uuid(),account_id uuid references auth.users(id) on delete set null,
 client_id text not null,resource text not null default 'https://tokenoverflow.app/api/mcp' check(resource='https://tokenoverflow.app/api/mcp'),
 scopes text[] not null default '{}',state text not null check(state in ('PENDING','ACTIVE','TERMINAL')),
 created_at timestamptz not null default clock_timestamp(),approved_at timestamptz,approved_interaction_uid text,renewable boolean not null default false,expires_at timestamptz not null,terminal_at timestamptz,
 check(scopes<@array['reports:publish','fixes:publish','verifications:record']::text[])
);
create table private.oauth_records(
 model text not null check(model in ('Session','Interaction','Grant','AuthorizationCode','AccessToken','RefreshToken')),
 key_hash text not null check(key_hash~'^[a-f0-9]{64}$'),payload jsonb not null check(jsonb_typeof(payload)='object'),
 grant_id text references private.oauth_grants(provider_id) on delete restrict,uid text,
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,retain_until timestamptz not null,
 consumed_at timestamptz,revoked boolean not null default false,primary key(model,key_hash)
);
create unique index oauth_session_uid on private.oauth_records(model,uid) where model='Session' and uid is not null;
create index oauth_records_grant on private.oauth_records(grant_id);
alter table private.oauth_backend_logins enable row level security;
alter table private.oauth_grants enable row level security;
alter table private.oauth_records enable row level security;
revoke all on private.oauth_backend_logins,private.oauth_grants,private.oauth_records from public,anon,authenticated,tokenoverflow_oauth_backend;

create function private.oauth_require_backend() returns void language plpgsql security definer set search_path='' as $$begin
 if current_setting('transaction_isolation')<>'read committed' then raise sqlstate 'PO400' using message='OAuth requires READ COMMITTED.';end if;
 if not exists(select 1 from private.oauth_backend_logins b join pg_roles r on r.rolname=b.login where b.login=session_user and not(r.rolsuper or r.rolbypassrls or r.rolinherit or r.rolcreatedb or r.rolcreaterole or r.rolreplication) and pg_has_role(session_user,'tokenoverflow_oauth_backend','MEMBER')) then raise sqlstate 'PO503' using message='Native authorization is unavailable.';end if;
 if exists(with recursive reachable(roleid) as (
  select roleid from pg_auth_members where member=(select oid from pg_roles where rolname=session_user)
  union select m.roleid from pg_auth_members m join reachable r on m.member=r.roleid
 ) select 1 from reachable where roleid<>(select oid from pg_roles where rolname='tokenoverflow_oauth_backend')) then raise sqlstate 'PO503' using message='Native authorization is unavailable.';end if;
 if exists(select 1 from pg_roles where rolname='tokenoverflow_oauth_backend' and (rolcanlogin or rolsuper or rolbypassrls or rolinherit or rolcreatedb or rolcreaterole or rolreplication)) then raise sqlstate 'PO503' using message='Native authorization is unavailable.';end if;
end$$;
revoke all on function private.oauth_require_backend() from public,anon,authenticated,tokenoverflow_oauth_backend;

create function private.oauth_backend(p_operation text,p_args jsonb,p_policy jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m text;k text;payload jsonb;rec private.oauth_records%rowtype;g private.oauth_grants%rowtype;interaction private.oauth_records%rowtype;
 v_grant_id text;account uuid;client text;policy_client jsonb;params jsonb;resource text;v_scopes text[];allowed_scopes text[];scope_value text;stamp timestamptz;expiry timestamptz;ttl integer;required_scope text;context jsonb;d jsonb;kind text;name text;result_id uuid;parent_id uuid;parent_owner uuid;is_example boolean;total bigint;field text;operation text;failed_constraint text;failed_table text;failed_schema text;
begin
 perform private.oauth_require_backend();
 if (jsonb_typeof(p_args)='object' and p_policy->>'enabled'='true' and p_policy->>'resource'='https://tokenoverflow.app/api/mcp' and jsonb_typeof(p_policy->'clients')='array') is not true then raise sqlstate 'PO503' using message='Native authorization is unavailable.';end if;
 m:=p_args->>'model';k:=p_args->>'keyHash';payload:=p_args->'payload';
 if p_operation in ('upsert','find','find-index','consume','destroy') and (m is null or m not in ('Session','Interaction','Grant','AuthorizationCode','AccessToken','RefreshToken')) then raise sqlstate 'PO400' using message='Invalid OAuth model.';end if;
 if p_operation='find-index' then
  if m<>'Session' or p_args->>'index'<>'uid' then raise sqlstate 'PO400' using message='Invalid OAuth index.';end if;
  select key_hash into k from private.oauth_records where model=m and uid=p_args->>'value';
  if k is null then return null;end if;
 end if;
 if p_operation in ('find','find-index','consume','destroy') then
  -- Immutable v_grant_id read for lock order only; authoritative row re-read after grant lock.
  select * into rec from private.oauth_records r where r.model=m and r.key_hash=k;v_grant_id:=rec.grant_id;
 elsif p_operation='upsert' then
  if jsonb_typeof(payload)<>'object' or payload->>'kind' is distinct from m or k!~'^[a-f0-9]{64}$' then raise sqlstate 'PO400' using message='Invalid OAuth payload.';end if;
  v_grant_id:=case when m='Grant' then payload->>'jti' else payload->>'grantId' end;
 elsif p_operation='revoke' then v_grant_id:=p_args->>'grantId';
 elsif p_operation='disconnect' then null; -- Service-owned account/client args; no caller grant selector.
 elsif p_operation in ('approve','active-grant') then v_grant_id:=p_args->>'providerGrantId';
 elsif p_operation in ('check-access','prepare-publish','publish') then context:=p_args->'context';v_grant_id:=context->>'grantId';
 else raise sqlstate 'PO400' using message='Unsupported OAuth operation.';
 end if;
 -- Immutable association lookup only, never authority until rechecked after ordered locks.
 if v_grant_id is not null then select * into g from private.oauth_grants where provider_id=v_grant_id;end if;
 account:=g.account_id;client:=g.client_id;
 if p_operation='disconnect' then account:=(p_args->>'accountId')::uuid;client:=p_args->>'clientId';
 elsif g.provider_id is null and p_operation='upsert' and m='Grant' then account:=(payload->>'accountId')::uuid;client:=payload->>'clientId';
 elsif v_grant_id is null and p_operation='upsert' then account:=case when m='Session' then (payload->>'accountId')::uuid when m='Interaction' then (payload->'session'->>'accountId')::uuid end;client:=coalesce(payload->'params'->>'client_id','');
 elsif v_grant_id is null then account:=case when m='Session' then (rec.payload->>'accountId')::uuid when m='Interaction' then (rec.payload->'session'->>'accountId')::uuid end;client:=coalesce(rec.payload->'params'->>'client_id','');end if;
 -- Global order: account FK share, formal-account lock ONLY native writer, OAuth account/client,
 -- then grant, then credential. Never acquire formal lock after any OAuth lock.
 if account is not null then
  if p_operation in ('destroy','revoke') then
   -- Decreasing authority remains possible for banned/deleted accounts; lock row if present.
   perform u.id from auth.users u where u.id=account for share;
  else
   perform u.id from auth.users u where u.id=account and u.is_anonymous is false and (banned_until is null or banned_until<=clock_timestamp()) for share;
   if not found then if p_operation in ('find','find-index','active-grant') then return null;end if;raise sqlstate 'PO401' using message='Account unavailable.';end if;
  end if;
  if p_operation in ('prepare-publish','publish') then perform pg_advisory_xact_lock(hashtextextended(account::text,0));end if;
  perform pg_advisory_xact_lock(1330078036,hashtext(account::text||':'||coalesce(client,'')));
 end if;
 if v_grant_id is not null then
  select * into g from private.oauth_grants where provider_id=v_grant_id for update;
  if g.provider_id is not null and (g.account_id is distinct from account or g.client_id is distinct from client) then raise sqlstate 'PO409' using message='Immutable grant association changed.';end if;
 end if;
 stamp:=clock_timestamp();
 if p_operation='disconnect' then
  select c into policy_client from jsonb_array_elements(p_policy->'clients') c where c->>'clientId'=client;
  if account is null or client is null or policy_client is null then raise sqlstate 'PO403' using message='Client unavailable.';end if;
  -- Current permitted account row and account/client advisory already held; no formal quota lock.
  perform q.provider_id from private.oauth_grants q where q.account_id=account and q.client_id=client and q.state in ('PENDING','ACTIVE') order by q.provider_id for update;
  update private.oauth_grants q set state='TERMINAL',terminal_at=coalesce(q.terminal_at,stamp) where q.account_id=account and q.client_id=client and q.state in ('PENDING','ACTIVE');
  get diagnostics total=row_count;
  return jsonb_build_object('clientId',client,'disconnected',total>0);
 end if;
 if g.provider_id is not null and g.account_id is null and p_operation not in ('destroy','revoke') then
  if p_operation in ('find','find-index','active-grant') then return null;end if;
  if p_operation='consume' then return '"invalid"'::jsonb;end if;
  raise sqlstate 'PO401' using message='Account unavailable.';
 end if;
 if p_operation='active-grant' then
  if g.provider_id is null or g.state<>'ACTIVE' or g.expires_at<=stamp or g.approved_interaction_uid is null then return null;end if;
  select c into policy_client from jsonb_array_elements(p_policy->'clients') c where c->>'clientId'=g.client_id;
  if policy_client is null or g.resource is distinct from p_policy->>'resource' or not(g.scopes<@array(select jsonb_array_elements_text(policy_client->'scopes'))) then return null;end if;
  return jsonb_build_object('interactionUid',g.approved_interaction_uid,'providerGrantId',g.provider_id,'generationId',g.generation_id,'accountId',g.account_id,'clientId',g.client_id,'resource',g.resource,'scopes',g.scopes,'renewable',g.renewable and policy_client->>'renewable'='true');
 end if;
 if p_operation='upsert' then
  ttl:=(p_args->>'ttl')::integer;
  if ttl is null or ttl<1 or payload->>'exp' is null or payload->>'iat' is null then raise sqlstate 'PO400' using message='Invalid OAuth lifetime.';end if;
  expiry:=least(to_timestamp((payload->>'exp')::double precision),stamp+make_interval(secs=>ttl));
  if expiry<=stamp then raise sqlstate 'PO400' using message='Invalid OAuth lifetime.';end if;
  if m in ('AuthorizationCode','AccessToken','RefreshToken') then
   if payload ? 'jti' or v_grant_id is null or g.provider_id is null or g.state<>'ACTIVE' or g.expires_at<=stamp then raise sqlstate 'PO401' using message='Invalid OAuth grant.';end if;
   if payload->>'accountId' is distinct from g.account_id::text or payload->>'clientId' is distinct from g.client_id or not exists(select 1 from auth.users where id=g.account_id and is_anonymous is false and (banned_until is null or banned_until<=clock_timestamp()) for share) then raise sqlstate 'PO403' using message='Invalid OAuth binding.';end if;
   select c into policy_client from jsonb_array_elements(p_policy->'clients') c where c->>'clientId'=g.client_id;
   allowed_scopes:=array(select jsonb_array_elements_text(policy_client->'scopes'));
   v_scopes:=string_to_array(coalesce(payload->>'scope',''),' ');
   resource:=case when m='AccessToken' then payload->>'aud' else payload->>'resource' end;
   if policy_client is null or resource is distinct from g.resource or cardinality(v_scopes)=0 or not(v_scopes<@g.scopes and v_scopes<@allowed_scopes) then raise sqlstate 'PO403' using message='Invalid OAuth scope.';end if;
   if m='AuthorizationCode' and (ttl>120 or expiry>stamp+interval '120 seconds') or m='AccessToken' and (ttl>600 or expiry>stamp+interval '600 seconds') or m='RefreshToken' and (ttl>604800 or policy_client->>'renewable' is distinct from 'true') then raise sqlstate 'PO400' using message='Invalid OAuth lifetime.';end if;
   expiry:=least(expiry,g.expires_at);
  elsif m='Grant' then
   account:=(payload->>'accountId')::uuid;client:=payload->>'clientId';
   if account is null or client is null or v_grant_id is null or not exists(select 1 from auth.users where id=account and is_anonymous is false and (banned_until is null or banned_until<=clock_timestamp()) for share) then raise sqlstate 'PO403' using message='Invalid OAuth account.';end if;
   select c into policy_client from jsonb_array_elements(p_policy->'clients') c where c->>'clientId'=client;
   if policy_client is null then raise sqlstate 'PO403' using message='Client unavailable.';end if;
   if g.provider_id is null then
    insert into private.oauth_grants(provider_id,account_id,client_id,state,expires_at) values(v_grant_id,account,client,'PENDING',least(expiry,stamp+interval '30 days')) returning * into g;
   elsif g.state='TERMINAL' or g.account_id<>account or g.client_id<>client or g.expires_at<=stamp then raise sqlstate 'PO409' using message='Grant cannot be rebound.';
   end if;
   if g.state='ACTIVE' and (array(select unnest(string_to_array(coalesce(payload->'resources'->>g.resource,''),' ')))) is distinct from g.scopes then raise sqlstate 'PO409' using message='Grant cannot be rebound.';end if;
   expiry:=least(expiry,g.expires_at);
  elsif m='Interaction' then
   if ttl>600 then raise sqlstate 'PO400' using message='Invalid interaction lifetime.';end if;
   params:=payload->'params';resource:=case jsonb_typeof(params->'resource') when 'string' then params->>'resource' when 'array' then case when jsonb_array_length(params->'resource')=1 and jsonb_typeof(params->'resource'->0)='string' then params->'resource'->>0 else null end else null end;
   select c into policy_client from jsonb_array_elements(p_policy->'clients') c where c->>'clientId'=params->>'client_id';
   if policy_client is null or resource is distinct from 'https://tokenoverflow.app/api/mcp' or params->>'response_type' is distinct from 'code' or params->>'code_challenge_method' is distinct from 'S256' or coalesce(params->>'code_challenge','')!~'^[A-Za-z0-9_-]{43}$' or (policy_client->'redirectUris' ? (params->>'redirect_uri')) is not true then raise sqlstate 'PO400' using message='Invalid interaction.';end if;
  elsif m='Session' and ttl>2592000 then raise sqlstate 'PO400' using message='Invalid session lifetime.';
  end if;
  select * into rec from private.oauth_records r where r.model=m and r.key_hash=k for update;
  if found and (rec.consumed_at is not null or rec.revoked or rec.grant_id is distinct from v_grant_id or rec.expires_at<=stamp) then raise sqlstate 'PO409' using message='Credential cannot be rebound.';end if;
  insert into private.oauth_records(model,key_hash,payload,grant_id,uid,expires_at,retain_until) values(m,k,payload,v_grant_id,case when m='Session' then payload->>'uid' end,expiry,case when g.provider_id is not null then greatest(expiry,g.expires_at) else expiry end)
  on conflict(model,key_hash) do update set payload=excluded.payload,expires_at=least(private.oauth_records.expires_at,excluded.expires_at);
  return null;
 elsif p_operation='revoke' then
  if g.provider_id is not null then update private.oauth_grants set state='TERMINAL',terminal_at=coalesce(terminal_at,stamp) where provider_id=v_grant_id;end if;return null;
 elsif p_operation='approve' then
  perform r.key_hash from private.oauth_records r where (r.model='Interaction' and r.key_hash=p_args->>'interactionHash') or (r.model='Grant' and r.grant_id=v_grant_id) order by r.model,r.key_hash for update;
  select * into interaction from private.oauth_records r where r.model='Interaction' and r.key_hash=p_args->>'interactionHash';
  if interaction.key_hash is null or interaction.expires_at<=stamp or interaction.revoked or g.provider_id is null or g.state<>'PENDING' or g.expires_at<=stamp then raise sqlstate 'PO409' using message='Authorization unavailable.';end if;
  params:=interaction.payload->'params';resource:=case jsonb_typeof(params->'resource') when 'string' then params->>'resource' when 'array' then case when jsonb_array_length(params->'resource')=1 and jsonb_typeof(params->'resource'->0)='string' then params->'resource'->>0 else null end else null end;account:=(p_args->>'accountId')::uuid;
  if account is null or g.account_id<>account or (interaction.payload->'session'->>'accountId' is not null and interaction.payload->'session'->>'accountId'<>account::text) or params->>'client_id' is distinct from g.client_id or resource is distinct from g.resource or not exists(select 1 from auth.users where id=account and is_anonymous is false and (banned_until is null or banned_until<=clock_timestamp()) for share) then raise sqlstate 'PO403' using message='Authorization mismatch.';end if;
  select c into policy_client from jsonb_array_elements(p_policy->'clients') c where c->>'clientId'=g.client_id;
  v_scopes:=string_to_array(params->>'scope',' ');allowed_scopes:=array(select jsonb_array_elements_text(policy_client->'scopes'));
  select * into rec from private.oauth_records r where r.model='Grant' and r.grant_id=v_grant_id;
  if policy_client is null or cardinality(v_scopes)=0 or not(v_scopes<@allowed_scopes) or (policy_client->'redirectUris' ? (params->>'redirect_uri')) is not true or rec.payload->'resources'->>g.resource is distinct from params->>'scope' then raise sqlstate 'PO403' using message='Authorization mismatch.';end if;
  update private.oauth_grants set state='ACTIVE',scopes=v_scopes,approved_at=stamp,approved_interaction_uid=interaction.payload->>'jti',renewable=policy_client->>'renewable'='true' where provider_id=v_grant_id;
  return jsonb_build_object('interactionUid',interaction.payload->>'jti','providerGrantId',g.provider_id,'generationId',g.generation_id,'accountId',g.account_id,'clientId',g.client_id,'resource',g.resource,'scopes',v_scopes,'renewable',policy_client->>'renewable'='true');
 elsif p_operation in ('find','find-index','consume','destroy') then
  select * into rec from private.oauth_records r where r.model=m and r.key_hash=k for update;
  if rec.key_hash is null then return case when p_operation='consume' then '"invalid"'::jsonb else null end;end if;
  if m='Grant' and p_operation='destroy' then update private.oauth_grants set state='TERMINAL',terminal_at=coalesce(terminal_at,stamp) where provider_id=rec.grant_id;return null;end if;
  if p_operation='destroy' then
   if rec.consumed_at is null then delete from private.oauth_records where model=m and key_hash=k;else update private.oauth_records set revoked=true where model=m and key_hash=k;end if;return null;
  end if;
  if m in ('Grant','AuthorizationCode','AccessToken','RefreshToken') and (g.provider_id is null or g.state='TERMINAL' or g.expires_at<=stamp) then return case when p_operation='consume' then '"invalid"'::jsonb else null end;end if;
  if p_operation='consume' or m in ('AuthorizationCode','RefreshToken') and rec.consumed_at is not null then
   if m not in ('AuthorizationCode','RefreshToken') then raise sqlstate 'PO400' using message='Invalid consumption.';end if;
   if rec.consumed_at is not null then
    if m in ('AuthorizationCode','RefreshToken') then update private.oauth_grants set state='TERMINAL',terminal_at=coalesce(terminal_at,stamp) where provider_id=rec.grant_id;end if;
    -- Return outcome, COMMIT, THEN adapter throws InvalidGrant. Never UPDATE+RAISE rollback.
    return case when p_operation='consume' then '"replay-terminalized"'::jsonb else null end;
   end if;
   if rec.revoked or rec.expires_at<=stamp or g.state<>'ACTIVE' then return '"invalid"'::jsonb;end if;
   update private.oauth_records set consumed_at=stamp,payload='{}',uid=null where model=m and key_hash=k;
   return '"consumed"'::jsonb;
  end if;
  if rec.revoked or rec.expires_at<=stamp or rec.consumed_at is not null or m='Grant' and g.state<>'ACTIVE' then return null;end if;
  if m='Grant' then
   select c into policy_client from jsonb_array_elements(p_policy->'clients') c where c->>'clientId'=g.client_id;
   if policy_client is null or g.resource is distinct from p_policy->>'resource' or not(g.scopes<@array(select jsonb_array_elements_text(policy_client->'scopes'))) then return null;end if;
  end if;
  return jsonb_build_object('payload',rec.payload,'expiresAt',extract(epoch from rec.expires_at));
 elsif p_operation in ('check-access','prepare-publish','publish') then
  select * into rec from private.oauth_records r where r.model='AccessToken' and r.key_hash=context->>'credentialHash' for update;
  operation:=case when p_operation in ('prepare-publish','publish') then case p_args->>'kind' when 'report' then 'publish_report' when 'fix' then 'publish_fix' when 'verification' then 'record_verification' else null end else p_args->>'operation' end;
  required_scope:=case operation when 'publish_report' then 'reports:publish' when 'publish_fix' then 'fixes:publish' when 'record_verification' then 'verifications:record' else null end;
  if required_scope is null then raise sqlstate 'PO400' using message='Invalid operation.';end if;
  if g.provider_id is null or g.state<>'ACTIVE' or g.expires_at<=stamp or rec.key_hash is null or rec.revoked or rec.expires_at<=stamp or rec.grant_id<>g.provider_id then raise sqlstate 'PO401' using message='Authorization unavailable.';end if;
  select c into policy_client from jsonb_array_elements(p_policy->'clients') c where c->>'clientId'=g.client_id;
  if policy_client is null or context->>'accountId' is distinct from g.account_id::text or context->>'clientId' is distinct from g.client_id or context->>'resource' is distinct from g.resource or rec.payload->>'accountId' is distinct from g.account_id::text or rec.payload->>'clientId' is distinct from g.client_id or rec.payload->>'aud' is distinct from g.resource or not(required_scope=any(g.scopes)) or not(required_scope=any(string_to_array(rec.payload->>'scope',' '))) or not(policy_client->'scopes' ? required_scope) or (context->>'exp')::double precision<> (rec.payload->>'exp')::double precision or (rec.payload->>'exp')::double precision<=extract(epoch from stamp) or context->>'sessionUid' is distinct from rec.payload->>'sessionUid' or context->>'expiresWithSession' is distinct from rec.payload->>'expiresWithSession' then raise sqlstate 'PO403' using message='Authorization mismatch.';end if;
  if not exists(select 1 from auth.users where id=g.account_id and is_anonymous is false and (banned_until is null or banned_until<=clock_timestamp()) for share) then raise sqlstate 'PO401' using message='Account unavailable.';end if;
  if rec.payload->>'expiresWithSession'='true' then
   perform s.key_hash from private.oauth_records s where s.model='Session' and s.uid=rec.payload->>'sessionUid' and s.expires_at>stamp and not s.revoked and s.payload->>'accountId'=g.account_id::text and s.payload->'authorizations'->g.client_id->>'grantId'=g.provider_id for share;
   if not found then raise sqlstate 'PO401' using message='Session unavailable.';end if;
  end if;
  if p_operation='check-access' then return null;end if;
  -- Native writer is below; no client bearer, Identity conversion, Data API or raw table grants.
  kind:=p_args->>'kind';
  if p_operation='prepare-publish' then
   perform set_config('tokenoverflow.oauth_prepared_grant',g.provider_id,true),set_config('tokenoverflow.oauth_prepared_account',g.account_id::text,true),set_config('tokenoverflow.oauth_prepared_author','',true);
   select case when jsonb_typeof(raw_user_meta_data->'display_name')='string' then raw_user_meta_data->>'display_name' else null end into name from auth.users where id=g.account_id;
   return jsonb_build_object('displayName',name); -- Private minimal projection; JS uses existing trim().slice(0,80).
  end if;
  name:=current_setting('tokenoverflow.oauth_prepared_author',true);
  if name is null or name='' or current_setting('tokenoverflow.oauth_prepared_grant',true) is distinct from g.provider_id or current_setting('tokenoverflow.oauth_prepared_account',true) is distinct from g.account_id::text then raise sqlstate 'PO403' using message='Contribution was not prepared.';end if;
  if jsonb_typeof(p_args->'dataJson') is distinct from 'string' then raise sqlstate 'PO400' using message='Invalid contribution.';end if;
  d:=(p_args->>'dataJson')::jsonb;
  if jsonb_typeof(d) is distinct from 'object' or d->>'author_name' is distinct from name then raise sqlstate 'PO400' using message='Invalid contribution.';end if;
  -- Count exact compact JSON.stringify text from the shared-schema transaction, never jsonb::text formatting.
  if octet_length(convert_to(p_args->>'dataJson','UTF8'))>60000 then raise sqlstate 'PO413' using message='Contribution too large.';end if;
  if d ? 'evidence_bundle' then
   if jsonb_typeof(p_args->'bundleJson') is distinct from 'string' or (p_args->>'bundleJson')::jsonb is distinct from d->'evidence_bundle' then raise sqlstate 'PO400' using message='Invalid evidence bundle.';end if;
   if octet_length(convert_to(p_args->>'bundleJson','UTF8'))>12288 then raise sqlstate 'PO413' using message='Evidence bundle too large.';end if;
  end if;
  foreach field in array case kind when 'report' then array['title','summary','body','environment','reproduction','category'] when 'fix' then array['report_id','body','environment','evidence'] else array['fix_id','outcome','environment','notes'] end loop
   if (jsonb_typeof(d->field)='string') is not true then raise sqlstate 'PO400' using message='Invalid contribution.';end if;
  end loop;
  -- Formal advisory was acquired BEFORE OAuth locks above; legacy AFTER INSERT trigger is reentrant.
  stamp:=clock_timestamp();
  select (select count(*) from public.reports where author_id=g.account_id and created_at>stamp-interval '1 day')+(select count(*) from public.fixes where author_id=g.account_id and created_at>stamp-interval '1 day')+(select count(*) from public.verifications where author_id=g.account_id and created_at>stamp-interval '1 day') into total;
  if total>=100 then raise sqlstate 'PO429' using message='Contribution limit reached.';end if;
  if kind='report' then
   if d ? 'tags' and (jsonb_typeof(d->'tags')<>'array' or exists(select 1 from jsonb_array_elements(d->'tags') t where jsonb_typeof(t)<>'string')) then raise sqlstate 'PO400' using message='Invalid tags.';end if;
   insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,attempted_fixes,category,tags,evidence_bundle) values(g.account_id,name,d->>'title',d->>'summary',d->>'body',d->>'environment',d->>'reproduction',coalesce(d->>'attempted_fixes',''),d->>'category',array(select jsonb_array_elements_text(coalesce(d->'tags','[]'))),d->'evidence_bundle') returning id into result_id;
   parent_id:=result_id;
  elsif kind='fix' then
   parent_id:=(d->>'report_id')::uuid;select r.is_example into is_example from public.reports r where r.id=parent_id for share;
   if not found then raise sqlstate 'PO404' using message='Finding unavailable.';end if;if is_example then raise sqlstate 'PO403' using message='Example is read-only.';end if;
   insert into public.fixes(report_id,author_id,author_name,body,environment,evidence,evidence_bundle) values(parent_id,g.account_id,name,d->>'body',d->>'environment',d->>'evidence',d->'evidence_bundle') returning id into result_id;
  else
   select f.report_id,f.author_id,r.is_example into parent_id,parent_owner,is_example from public.fixes f join public.reports r on r.id=f.report_id where f.id=(d->>'fix_id')::uuid for share of f,r;
   if not found then raise sqlstate 'PO404' using message='Change unavailable.';end if;if (parent_owner is not null and parent_owner<>g.account_id and not is_example) is not true then raise sqlstate 'PO403' using message='Independent community result required.';end if;
   insert into public.verifications(fix_id,author_id,author_name,outcome,environment,notes,evidence_bundle) values((d->>'fix_id')::uuid,g.account_id,name,d->>'outcome',d->>'environment',d->>'notes',d->'evidence_bundle') returning id into result_id;
  end if;
  return jsonb_build_object('status',201,'id',result_id,'kind',kind,'url','/reports/'||parent_id::text||case kind when 'fix' then '#fix-'||result_id::text when 'verification' then '#verification-'||result_id::text else '' end);
 end if;
 raise sqlstate 'PO400' using message='Unsupported OAuth operation.';
exception
 when sqlstate 'PO400' or sqlstate 'PO401' or sqlstate 'PO403' or sqlstate 'PO404' or sqlstate 'PO409' or sqlstate 'PO413' or sqlstate 'PO429' or sqlstate 'PO503' then raise;
 when unique_violation then
  get stacked diagnostics failed_constraint=constraint_name,failed_table=table_name,failed_schema=schema_name;
  if kind='verification' and failed_schema='public' and failed_table='verifications' and failed_constraint='verifications_fix_id_author_id_environment_key' then raise sqlstate 'PO409' using message='Result already recorded.';end if;
  raise sqlstate 'PO500' using message='Could not complete the request.';
 when invalid_text_representation or check_violation or not_null_violation then raise sqlstate 'PO400' using message='Invalid OAuth request.';
 when others then raise sqlstate 'PO500' using message='Could not complete the request.';
end$$;
revoke all on function private.oauth_backend(text,jsonb,jsonb) from public,anon,authenticated;
grant usage on schema private to tokenoverflow_oauth_backend;
grant execute on function private.oauth_backend(text,jsonb,jsonb) to tokenoverflow_oauth_backend;
