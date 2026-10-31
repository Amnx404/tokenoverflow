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
