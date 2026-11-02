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
