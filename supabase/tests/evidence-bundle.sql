-- Isolated reviewed artifact only. Run as postgres with ON_ERROR_STOP; all data rolls back.
-- Set fixture.expected_restricted=true before execution for the phase3 grant checks.
begin isolation level read committed;
create function pg_temp.assert_bundle(value jsonb, kind text, expected boolean, label text)
returns void language plpgsql as $$
begin
 if private.evidence_bundle_valid(value,kind) is distinct from expected then
  raise exception 'Bundle acceptance mismatch: %', label;
 end if;
end $$;
create temporary table evidence_test_context(name text primary key,value text) on commit drop;
grant select,insert on evidence_test_context to anon,authenticated;
insert into evidence_test_context values ('alice',gen_random_uuid()::text),('bob',gen_random_uuid()::text);
insert into auth.users(id,aud,role,email) select value::uuid,'authenticated','authenticated',value||'@fixture.invalid' from evidence_test_context;

do $$
declare b jsonb := '{"contract_version":1,"check":{"kind":"command","instructions":"check","expected_result":"expected"},"before_result":{"output":"","exit_code":0},"after_result":null,"versions":[{"kind":"runtime","name":"Node","version":null}]}'::jsonb;
 v jsonb; key text; loc text[]; n integer; boundary jsonb;
begin
 perform pg_temp.assert_bundle(b,'report',true,'baseline empty-output exit zero');
 perform pg_temp.assert_bundle(b,'fix',true,'proposed fix without rerun');
 perform pg_temp.assert_bundle(b,'verification',false,'verification missing rerun');
 perform pg_temp.assert_bundle(null,'report',false,'helper SQL null is not accepted');
 perform pg_temp.assert_bundle('null','report',false,'JSON null');
 foreach key in array array['contract_version','check','before_result','after_result','versions'] loop
  perform pg_temp.assert_bundle(b-key,'report',false,'missing root '||key);
 end loop;
 foreach key in array array['kind','instructions','expected_result'] loop
  perform pg_temp.assert_bundle(jsonb_set(b,'{check}',(b->'check')-key),'report',false,'missing check '||key);
 end loop;
 foreach key in array array['kind','name','version'] loop
  perform pg_temp.assert_bundle(jsonb_set(b,'{versions,0}',(b#>'{versions,0}')-key),'report',false,'missing version '||key);
 end loop;
 perform pg_temp.assert_bundle(jsonb_set(b,'{before_result}','{"exit_code":0}'),'report',false,'required output missing');
 perform pg_temp.assert_bundle(jsonb_set(b,'{before_result}','{"output":""}'),'report',false,'empty output no exit');
 perform pg_temp.assert_bundle(jsonb_set(b,'{before_result}','{"output":" \t\n"}'),'report',true,'whitespace raw output');
 foreach v in array array['-1'::jsonb,'256'::jsonb,'1.5'::jsonb,'"0"'::jsonb,'null'::jsonb] loop
  perform pg_temp.assert_bundle(jsonb_set(b,'{before_result,exit_code}',v),'report',false,'invalid exit code');
 end loop;
 foreach v in array array['0'::jsonb,'255'::jsonb,'1.0'::jsonb,'1e0'::jsonb] loop
  perform pg_temp.assert_bundle(jsonb_set(b,'{before_result,exit_code}',v),'report',true,'semantic integer');
 end loop;
 perform pg_temp.assert_bundle(jsonb_set(b,'{contract_version}','1.0'),'report',true,'semantic contract one');
 perform pg_temp.assert_bundle(jsonb_set(b,'{check,instructions}','" check"'),'report',false,'direct normalized check required');
 perform pg_temp.assert_bundle(jsonb_set(b,'{versions,0,name}','"Node "'),'report',false,'direct normalized version required');
 perform pg_temp.assert_bundle(jsonb_set(b,'{versions,0,name}',to_jsonb(E'\tNode\t'::text)),'report',true,'tabs are not U0020');
 perform pg_temp.assert_bundle(jsonb_set(b,'{check,extra}','true',true),'report',false,'unknown nested key');
 perform pg_temp.assert_bundle(jsonb_set(b,'{versions}','[]'),'report',false,'versions empty');
 perform pg_temp.assert_bundle(jsonb_set(b,'{versions}',(select jsonb_agg(jsonb_build_object('kind','other','name',i::text,'version',null)) from generate_series(1,13) i)),'report',false,'versions overflow');
 perform pg_temp.assert_bundle(jsonb_set(b,'{versions}',(b->'versions')||(b->'versions')),'report',false,'duplicate exact version identity');
 perform pg_temp.assert_bundle(jsonb_set(b,'{versions}',(b->'versions')||'[{"kind":"runtime","name":"node","version":null}]'),'report',true,'version case retained');
 perform pg_temp.assert_bundle(jsonb_set(b,'{versions}',(b->'versions')||'[{"kind":"runtime","name":"é","version":null},{"kind":"runtime","name":"é","version":null}]'),'report',true,'Unicode normalization retained');
 perform pg_temp.assert_bundle(jsonb_set(b,'{before_result,output}',to_jsonb(repeat('😀',6000))),'report',false,'Unicode object storage ceiling remains independent');
 perform pg_temp.assert_bundle(jsonb_set(b,'{check,instructions}',to_jsonb(repeat('😀',2000))),'report',true,'supplementary codepoint upper boundary');
 perform pg_temp.assert_bundle(jsonb_set(b,'{check,instructions}',to_jsonb(repeat('😀',2001))),'report',false,'supplementary codepoint overflow');
 b := jsonb_set(b,'{after_result}','{"output":"after","exit_code":0}');
 perform pg_temp.assert_bundle(b,'report',false,'report after denied');
 perform pg_temp.assert_bundle(b,'fix',true,'fix after retained');
 perform pg_temp.assert_bundle(b,'verification',true,'result after required');
 boundary := jsonb_set(jsonb_set(jsonb_set(jsonb_set(b,'{check,instructions}',to_jsonb(repeat('i',2000))),'{check,expected_result}',to_jsonb(repeat('e',2000))),'{before_result,output}',to_jsonb(repeat('b',6000))),'{after_result,output}','""');
 boundary := jsonb_set(boundary,'{versions}',(select jsonb_agg(jsonb_build_object('kind','other','name',lpad(i::text,80,'x'),'version',repeat('v',120))) from generate_series(1,12) i));
 n := 16384-octet_length(boundary::text);
 if n not between 0 and 5999 then raise exception 'Invalid exact-byte fixture'; end if;
 boundary := jsonb_set(boundary,'{after_result,output}',to_jsonb(repeat('a',n)));
 if octet_length(boundary::text) <> 16384 then raise exception 'Boundary serializer mismatch'; end if;
 perform pg_temp.assert_bundle(boundary,'fix',true,'exact 16384 storage bytes');
 perform pg_temp.assert_bundle(jsonb_set(boundary,'{after_result,output}',to_jsonb(repeat('a',n+1))),'fix',false,'16385 storage bytes');
 insert into evidence_test_context values ('bundle',b::text);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select value from evidence_test_context where name='alice'),true);
do $$
declare r uuid; f uuid; bundle jsonb := (select value::jsonb from evidence_test_context where name='bundle');
begin
 insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,category,evidence_bundle)
 values(auth.uid(),'A SQL fixture','Typed evidence SQL fixture',repeat('s',20),repeat('b',20),'fixture',repeat('r',20),'Other',jsonb_set(bundle,'{after_result}','null')) returning id into r;
 insert into public.fixes(report_id,author_id,author_name,body,environment,evidence,evidence_bundle)
 values(r,auth.uid(),'A SQL fixture',repeat('b',20),'fixture',repeat('e',10),bundle) returning id into f;
 insert into evidence_test_context values ('report',r::text),('fix',f::text);
 if not exists(select 1 from public.fix_ownership(r) where id=f and is_own_fix) then raise exception 'Own-fix helper false'; end if;
 if private.fix_is_independent(f) then raise exception 'Self-fix independence true'; end if;
 if private.fix_is_independent(gen_random_uuid()) then raise exception 'Missing fix independence true'; end if;
 begin
  insert into public.verifications(fix_id,author_id,author_name,outcome,environment,notes,evidence_bundle)
  values(f,auth.uid(),'A SQL fixture','worked','fixture',repeat('n',10),bundle);
  raise exception 'Self-result was allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,category,evidence_bundle)
  values(auth.uid(),'A SQL fixture','Invalid literal-null bundle',repeat('s',20),repeat('b',20),'fixture',repeat('r',20),'Other','null');
  raise exception 'Literal-null stored';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select value from evidence_test_context where name='bob'),true);
do $$
declare f uuid := (select value::uuid from evidence_test_context where name='fix'); r uuid := (select value::uuid from evidence_test_context where name='report'); t text;
begin
 if not private.fix_is_independent(f) then raise exception 'Independent helper false'; end if;
 if exists(select 1 from public.fix_ownership(r) where is_own_fix) then raise exception 'Other account owns fix'; end if;
 insert into public.verifications(fix_id,author_id,author_name,outcome,environment,notes,evidence_bundle)
 values(f,auth.uid(),'A SQL independent','failed','fixture negative',repeat('n',10),(select value::jsonb from evidence_test_context where name='bundle'));
 if current_setting('fixture.expected_restricted',true) = 'true' then
  foreach t in array array['reports','fixes','verifications'] loop
   begin execute format('select author_id from public.%I limit 1',t); raise exception 'Authenticated author readable in %',t; exception when insufficient_privilege then null; end;
  end loop;
 end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$
declare t text; q text;
begin
 begin perform * from public.fix_ownership((select value::uuid from evidence_test_context where name='report')); raise exception 'Anonymous helper callable'; exception when insufficient_privilege then null; end;
 if current_setting('fixture.expected_restricted',true) = 'true' then
  foreach t in array array['reports','fixes','verifications'] loop
   begin execute format('select author_id from public.%I limit 1',t); raise exception 'Hidden author readable in %',t; exception when insufficient_privilege then null; end;
  end loop;
  if exists(select 1 from public.report_feed where author_id is not null) then raise exception 'Feed account identity visible'; end if;
 end if;
 if not exists(select 1 from public.search_reports('Typed evidence') where id=(select value::uuid from evidence_test_context where name='report')) then raise exception 'Invoker search failed'; end if;
 if not exists(select 1 from public.fixes where evidence_bundle=(select value::jsonb from evidence_test_context where name='bundle')) then raise exception 'Evidence lost in public columns'; end if;
end $$;
reset role;
rollback;
