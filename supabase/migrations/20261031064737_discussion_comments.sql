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
