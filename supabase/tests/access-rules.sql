-- Run as postgres after schema.sql and the guardrail change. No extensions
-- required. Every fixture (including auth users and keys) is rolled back.
-- A failed assertion raises an error; the caller must stop on SQL errors.
begin isolation level read committed;

create temporary table test_context (name text primary key, value text) on commit drop;
grant select, insert, update on test_context to anon, authenticated;
insert into test_context values
 ('alice', gen_random_uuid()::text), ('bob', gen_random_uuid()::text);
insert into auth.users(id, aud, role, email)
select value::uuid, 'authenticated', 'authenticated', value || '@test.invalid'
from test_context where name in ('alice', 'bob');

-- Fixture-only privileged assertion: application clients no longer SELECT raw
-- author IDs after privacy closure. This temporary function is rolled back.
create function pg_temp.fixture_contribution_count() returns bigint
language sql security definer set search_path = '' as $$
 select (select count(*) from public.reports where author_id=auth.uid())
      + (select count(*) from public.fixes where author_id=auth.uid())
      + (select count(*) from public.verifications where author_id=auth.uid());
$$;
revoke all on function pg_temp.fixture_contribution_count() from public;
grant execute on function pg_temp.fixture_contribution_count() to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select value from test_context where name='alice'), true);
do $$
declare report_id uuid; fix_id uuid; key_data jsonb;
begin
  insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,category,tags)
  values(auth.uid(),'Test Alice','Access rule fixture',repeat('s',20),repeat('b',20),'test environment',repeat('r',20),'Other',array[' MiXeDLookup ', 'mixedlookup', E'\tNextJS\n', '', null])
  returning id into report_id;
  insert into test_context values ('report',report_id::text);
  if (select tags from public.reports where id=report_id) is distinct from array['mixedlookup','nextjs'] then
    raise exception 'Tags are not canonical';
  end if;
  if not exists(select 1 from public.search_reports(' MIXEDLOOKUP ') where id=report_id) then
    raise exception 'Mixed-case tag lookup failed';
  end if;

  begin
    insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,category)
    values((select value::uuid from test_context where name='bob'),'Wrong owner','Ownership test',repeat('s',20),repeat('b',20),'test',repeat('r',20),'Other');
    raise exception 'Wrong owner was permitted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,category,is_example)
    values(auth.uid(),'Example bypass','Example bypass test',repeat('s',20),repeat('b',20),'test',repeat('r',20),'Other',true);
    raise exception 'Example bypass was permitted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,category,created_at)
    values(auth.uid(),'Backdate bypass','Backdate bypass test',repeat('s',20),repeat('b',20),'test',repeat('r',20),'Other',now()-interval '2 days');
    raise exception 'Backdating was permitted';
  exception when insufficient_privilege then null; end;

  insert into public.fixes(report_id,author_id,author_name,body,environment,evidence)
  values(report_id,auth.uid(),'Alice',repeat('b',20),'test',repeat('e',10)) returning id into fix_id;
  insert into test_context values ('fix',fix_id::text);
  begin
    insert into public.verifications(fix_id,author_id,author_name,outcome,environment,notes)
    values(fix_id,auth.uid(),'Alice','worked','test',repeat('n',10));
    raise exception 'Self-verification was permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform token_hash from private.agent_keys;
    raise exception 'Private key table was readable';
  exception when insufficient_privilege then null; end;
  key_data := public.create_agent_key('Transactional test');
  insert into test_context values ('key',key_data->>'token'), ('key_id',key_data->>'id');
end;
$$;

select set_config('request.jwt.claim.sub', (select value from test_context where name='bob'), true);
do $$
declare bob_fix uuid;
begin
  insert into public.fixes(report_id,author_id,author_name,body,environment,evidence)
  values((select value::uuid from test_context where name='report'),auth.uid(),'Bob',repeat('b',20),'test',repeat('e',10)) returning id into bob_fix;
  insert into test_context values ('bob_fix',bob_fix::text);
  if public.list_agent_keys() <> '[]'::jsonb then raise exception 'Another account key appeared in list'; end if;
  if public.revoke_agent_key((select value::uuid from test_context where name='key_id')) then raise exception 'Another account key was revoked'; end if;
  insert into public.verifications(fix_id,author_id,author_name,outcome,environment,notes)
  values((select value::uuid from test_context where name='fix'),auth.uid(),'Bob','worked','independent test',repeat('n',10));
  -- A key belongs to Alice even when called within Bob's signed-in session.
  perform public.agent_contribute((select value from test_context where name='key'),'report',
    jsonb_build_object('author_name','Agent Alice','title','Agent canonical tags', 'summary',repeat('s',20), 'body',repeat('b',20),
      'environment','test','reproduction',repeat('r',20),'category','Other','tags',jsonb_build_array(' AGENTTAG ','agenttag')));
end;
$$;

reset role;
do $$
begin
 if not exists(select 1 from public.reports where author_id=(select value::uuid from test_context where name='alice') and tags=array['agenttag']) then
  raise exception 'Agent owner or tags incorrect';
 end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if not exists(select 1 from public.report_feed where id=(select value::uuid from test_context where name='report')) then
    raise exception 'Anonymous public reading failed';
  end if;
  perform 1 from public.fixes;
  perform 1 from public.verifications;
  begin
    insert into public.fixes(report_id,author_id,author_name,body,environment,evidence)
    values((select value::uuid from test_context where name='report'),(select value::uuid from test_context where name='alice'),'Anonymous',repeat('b',20),'test',repeat('e',10));
    raise exception 'Anonymous write was permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform token_hash from private.agent_keys;
    raise exception 'Anonymous private key read was permitted';
  exception when insufficient_privilege then null; end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select value from test_context where name='alice'), true);
do $$
declare i integer; total bigint;
begin
  insert into public.verifications(fix_id,author_id,author_name,outcome,environment,notes)
  values((select value::uuid from test_context where name='bob_fix'),auth.uid(),'Alice','worked','independent test',repeat('n',10));
  -- Two reports, one fix and one verification: fill the shared account limit.
  for i in 1..96 loop
    insert into public.fixes(report_id,author_id,author_name,body,environment,evidence)
    values((select value::uuid from test_context where name='report'),auth.uid(),'Alice',repeat('b',20),'quota test',repeat('e',10));
  end loop;
  select pg_temp.fixture_contribution_count() into total;
  if total <> 100 then raise exception 'Expected exactly 100 contributions, got %', total; end if;
  begin
    insert into public.fixes(report_id,author_id,author_name,body,environment,evidence)
    values((select value::uuid from test_context where name='report'),auth.uid(),'Alice',repeat('b',20),'over quota',repeat('e',10));
    raise exception 'Direct contribution exceeded quota' using errcode='23514';
  exception when raise_exception then
    if sqlerrm <> 'Daily contribution limit reached' then raise; end if;
  end;
  begin
    insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,category)
    values(auth.uid(),'Alice','Over quota report',repeat('s',20),repeat('b',20),'test',repeat('r',20),'Other');
    raise exception 'Report exceeded quota' using errcode='23514';
  exception when raise_exception then
    if sqlerrm <> 'Daily contribution limit reached' then raise; end if;
  end;
  begin
    insert into public.verifications(fix_id,author_id,author_name,outcome,environment,notes)
    values((select value::uuid from test_context where name='bob_fix'),auth.uid(),'Alice','failed','over quota verification',repeat('n',10));
    raise exception 'Verification exceeded quota' using errcode='23514';
  exception when raise_exception then
    if sqlerrm <> 'Daily contribution limit reached' then raise; end if;
  end;
  begin
    perform public.agent_contribute((select value from test_context where name='key'),'fix',
      jsonb_build_object('report_id',(select value from test_context where name='report'),'author_name','Agent Alice','body',repeat('b',20),'environment','test','evidence',repeat('e',10)));
    raise exception 'Agent contribution exceeded quota' using errcode='23514';
  exception when raise_exception then
    if sqlerrm <> 'Daily contribution limit reached' then raise; end if;
  end;
  if not public.revoke_agent_key((select value::uuid from test_context where name='key_id')) then
    raise exception 'Own key revocation failed';
  end if;
end;
$$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.agent_contribute((select value from test_context where name='key'),'fix','{}'::jsonb);
    raise exception 'Revoked key was permitted';
  exception when invalid_authorization_specification then null; end;
end;
$$;
reset role;
rollback;
