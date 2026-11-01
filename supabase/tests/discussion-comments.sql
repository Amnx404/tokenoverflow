-- SOURCE ONLY: not executed. Future isolated PostgreSQL17 owner fixture, never production.
-- All IDs/accounts below are synthetic and transaction rolled back; no external Auth/provider call.
begin;
do $$ begin
 if has_table_privilege('authenticated','public.discussion_comments','INSERT') or has_table_privilege('authenticated','public.discussion_comments','UPDATE') or has_table_privilege('authenticated','public.discussion_comments','DELETE') then raise exception 'client writes granted'; end if;
 if has_column_privilege('anon','public.discussion_comments','author_id','SELECT') or has_column_privilege('authenticated','public.discussion_comments','create_fingerprint','SELECT') or has_column_privilege('authenticated','public.discussion_comments','create_request_id','SELECT') then raise exception 'private field granted'; end if;
 if not has_function_privilege('authenticated','public.append_discussion_comment(uuid,uuid,uuid,jsonb)','EXECUTE') or not has_function_privilege('authenticated','private.append_discussion_comment(uuid,uuid,uuid,jsonb)','EXECUTE') then raise exception 'invoker/definer chain missing'; end if;
 if has_function_privilege('anon','private.append_discussion_comment(uuid,uuid,uuid,jsonb)','EXECUTE') or has_function_privilege('authenticated','private.emergency_hide_discussion_comment(uuid,text)','EXECUTE') then raise exception 'unsafe routine grant'; end if;
end $$;
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('a0000000-0000-4000-8000-000000000001','discussion-a@example.invalid',false,'{"display_name":"  Synthetic A  "}'),
 ('a0000000-0000-4000-8000-000000000002','discussion-b@example.invalid',false,'{}'),
 ('a0000000-0000-4000-8000-000000000003','discussion-anon@example.invalid',true,'{}');
insert into public.reports(id,author_id,author_name,title,summary,body,environment,reproduction,category,tags,is_example) values
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Synthetic','Synthetic discussion fixture','A source-only isolated discussion fixture.','Synthetic context, not a finding.','Unknown runtime','Synthetic reproduction, no code executed.','Other','{}',true),
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','Synthetic','Another synthetic finding','A separate source-only discussion fixture.','Synthetic context, not a finding.','Unknown runtime','Synthetic reproduction, no code executed.','Other','{}',false);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
-- Missing JWT anonymous flag is NOT used as authority: current account row must be false.
do $$ declare saved jsonb; current_receipt jsonb; root_id uuid; child jsonb; body_value text:=E'  exact\r\nbody\t '; failed boolean;
begin
 saved:=public.append_discussion_comment('b0000000-0000-4000-8000-000000000001',null,'c0000000-0000-4000-8000-000000000001',to_jsonb(body_value));root_id:=(saved->>'id')::uuid;
 if (public.discussion_public_comment(root_id)->>'body') is distinct from body_value or public.discussion_public_comment(root_id)->>'author_name'<>'Synthetic A' then raise exception 'raw body/name mismatch'; end if;
 child:=public.append_discussion_comment('b0000000-0000-4000-8000-000000000001',root_id,'c0000000-0000-4000-8000-000000000002','"child"'::jsonb);
 if (child->>'depth')::int<>1 or (child->>'root_id')::uuid<>root_id then raise exception 'adjacency mismatch'; end if;
 failed:=false;begin perform public.append_discussion_comment('b0000000-0000-4000-8000-000000000002',root_id,gen_random_uuid(),'"foreign"'::jsonb);exception when sqlstate 'PT404' then failed:=true;end;if not failed then raise exception 'foreign parent accepted';end if;
 failed:=false;begin perform public.append_discussion_comment('b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),'42'::jsonb);exception when sqlstate 'PT400' then failed:=true;end;if not failed then raise exception 'numeric body accepted';end if;
 failed:=false;begin perform private.append_discussion_comment('b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),null);exception when sqlstate 'PT400' then failed:=true;end;if not failed then raise exception 'NULL body / STRICT bypass';end if;
 for idx in 1..3 loop perform public.append_discussion_comment('b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),'"quota row"'::jsonb);end loop;
 failed:=false;begin perform public.append_discussion_comment('b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),'"sixth"'::jsonb);exception when sqlstate 'PT429' then failed:=true;end;if not failed then raise exception '60 second limit missing';end if;
 perform public.redact_discussion_comment(root_id); -- Redaction available AT create cap.
 current_receipt:=public.append_discussion_comment('b0000000-0000-4000-8000-000000000001',null,'c0000000-0000-4000-8000-000000000001',to_jsonb(body_value));
 if current_receipt->>'id'<>saved->>'id' or current_receipt->>'redacted_at' is null then raise exception 'idempotent tombstone receipt lost';end if;
 if jsonb_array_length(public.get_discussion_context('b0000000-0000-4000-8000-000000000001',(child->>'id')::uuid)->'ancestors')<>1 then raise exception 'tombstone ancestor missing';end if;
 failed:=false;begin perform public.append_discussion_comment('b0000000-0000-4000-8000-000000000001',root_id,gen_random_uuid(),'"late reply"'::jsonb);exception when sqlstate 'PT409' then failed:=true;end;if not failed then raise exception 'redacted parent accepted';end if;
 failed:=false;begin perform public.append_discussion_comment('b0000000-0000-4000-8000-000000000001',null,'c0000000-0000-4000-8000-000000000001','"changed"'::jsonb);exception when sqlstate 'PT409' then failed:=true;end;if not failed then raise exception 'changed reuse accepted';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","client_id":null}',true);
do $$ declare failed boolean:=false;begin
 begin perform private.append_discussion_comment('b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),'"OAuth denied"'::jsonb);exception when sqlstate 'PT403' then failed:=true;end;if not failed then raise exception 'private OAuth bypass';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ declare failed boolean:=false;begin
 begin perform private.append_discussion_comment('b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),'"anonymous denied"'::jsonb);exception when sqlstate 'PT403' then failed:=true;end;if not failed then raise exception 'anonymous account bypass';end if;
end $$;
reset role;
-- Actual SOURCE case for account-FK-null attribution: active descendant must survive with false capability.
create temporary table discussion_ids_before as select id from public.discussion_comments where report_id='b0000000-0000-4000-8000-000000000001';
delete from auth.users where id='a0000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select id from discussion_ids_before except select id from public.discussion_comments) then raise exception 'account deletion removed discussion node';end if;
 if not exists(select 1 from public.discussion_comments where parent_id is not null and body='child' and author_id is null and author_name='Synthetic A') then raise exception 'active orphan attribution/descendant lost';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare orphan uuid; capability jsonb;begin
 select id into orphan from public.discussion_comments where report_id='b0000000-0000-4000-8000-000000000001' and parent_id is not null and redacted_at is null limit 1;
 capability:=public.discussion_redaction_capabilities(array[orphan]);
 if jsonb_array_length(capability)<>1 or capability->0->'can_redact' is distinct from 'false'::jsonb then raise exception 'orphan capability not strict false';end if;
end $$;
reset role;
-- Planned future isolated fixtures (not claimed executed by this source):
-- * Create depth0..8 across two nonanonymous accounts; depth9 rejects PT400, self/cross-report root FKs reject; reparent/time/fingerprint/body edits and DELETE reject.
-- * Owner deletes account A: author_id SET NULL, same text/tombstone/descendant IDs remain; active orphan capability is strictly false, never JSON null. No new account may claim redaction.
-- * anon/auth role SELECT safe columns succeeds, SELECT*/author/request/fingerprint/audit and direct table writes fail; private mutations directly enforce same actor/quota/ownership rules.
-- * Page roots/children with limit20/50, equal stored-microsecond timestamps, deleted/foreign/wrong-parent cursor PT400; selected context returns <=8 ordered ancestors, foreign target unavailable; no subtree scan.
-- * Five rolling-minute / twenty rolling-day creates count tombstones. Across >=4 minute windows fill20; twenty-first PT429; no mutation test may rewrite created_at to fake clock/retention.
-- * TWO SESSION account-lock race: hold advisory lock past transaction start, create at release boundary, prove sampled clock_timestamp AFTER lock (not transaction now), cap+sameUUID race only one row; changed sameUUID PT409.
-- * TWO SESSION parent FOR SHARE vs redact FOR UPDATE: committed redaction before append validation PT409; append validates first then redaction waits. Missing/foreign parent PT404, no late reply to already-redacted parent.
-- * Emergency authenticated execute denied; reviewed owner-only exact hide preserves IDs/descendants/private request fingerprint, emits body-free fixed-reason audit; repeat hide no undo/refund.
rollback;
