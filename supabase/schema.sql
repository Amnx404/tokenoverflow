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
