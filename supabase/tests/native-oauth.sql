-- SOURCE ONLY, NOT EXECUTED. Future isolated disposable fixture, never hosted.
-- Before this script: reviewed owner creates ONLY synthetic active auth.users fixtures,
-- and an exact dedicated NOINHERIT login oauth_fixture_login with only backend membership;
-- owner inserts that exact login into private.oauth_backend_logins. No wildcard/app-login grant.
-- Driver must connect AS that login (SET ROLE alone does not change session_user), READ COMMITTED.
-- No real token/secret is represented: hashes below are inert fixed SQL-fixture markers.
\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
\set SHOW_CONTEXT never
begin isolation level read committed;
set local role tokenoverflow_oauth_backend;
do $$begin
 if session_user<>'oauth_fixture_login' then raise exception 'Isolated synthetic login required';end if;
 if has_table_privilege(session_user,'private.oauth_records','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','private.oauth_records','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Unsafe provider table grant';end if;
 if has_function_privilege('authenticated','private.oauth_backend(text,jsonb,jsonb)','EXECUTE') or has_function_privilege('anon','private.oauth_backend(text,jsonb,jsonb)','EXECUTE') then raise exception 'Unsafe provider routine grant';end if;
end$$;
create function pg_temp.call_oauth(op text,args jsonb) returns jsonb language sql as $$
 select private.oauth_backend(op,args,'{"enabled":true,"issuer":"https://synthetic-issuer.invalid","resource":"https://tokenoverflow.app/api/mcp","clients":[{"clientId":"synthetic-static-client","redirectUris":["http://127.0.0.1:4321/callback"],"scopes":["reports:publish"],"renewable":true}],"ttl":{"authorizationCodeSeconds":120,"accessTokenSeconds":600,"interactionSeconds":600,"refreshIdleSeconds":604800,"refreshFamilySeconds":2592000}}');
$$;
create function pg_temp.ok(value boolean) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'OAuth fixture assertion';end if;end$$;
-- Actual API sequence planned: SDK Grant.save PENDING, private approve ACTIVE, SDK load ACTIVE.
do $$declare t bigint:=floor(extract(epoch from clock_timestamp()));pending jsonb;binding jsonb;begin
 perform pg_temp.call_oauth('upsert',jsonb_build_object('model','Grant','keyHash',repeat('1',64),'ttl',2592000,'payload',jsonb_build_object('kind','Grant','jti','synthetic-opaque-grant','iat',t,'exp',t+2592000,'accountId','a0000000-0000-4000-8000-000000000001','clientId','synthetic-static-client','resources',jsonb_build_object('https://tokenoverflow.app/api/mcp','reports:publish'))));
 pending:=pg_temp.call_oauth('find',jsonb_build_object('model','Grant','keyHash',repeat('1',64)));perform pg_temp.ok(pending is null);
 perform pg_temp.call_oauth('upsert',jsonb_build_object('model','Interaction','keyHash',repeat('2',64),'ttl',600,'payload',jsonb_build_object('kind','Interaction','jti','synthetic-interaction-uid','iat',t,'exp',t+600,'params',jsonb_build_object('client_id','synthetic-static-client','redirect_uri','http://127.0.0.1:4321/callback','response_type','code','scope','reports:publish','resource','https://tokenoverflow.app/api/mcp','code_challenge_method','S256','code_challenge',repeat('x',43)))));
 binding:=pg_temp.call_oauth('approve',jsonb_build_object('interactionHash',repeat('2',64),'providerGrantId','synthetic-opaque-grant','accountId','a0000000-0000-4000-8000-000000000001'));
 perform pg_temp.ok(binding->>'interactionUid'='synthetic-interaction-uid' and binding->>'providerGrantId'='synthetic-opaque-grant' and (binding->>'renewable')::boolean);
 perform pg_temp.call_oauth('destroy',jsonb_build_object('model','Interaction','keyHash',repeat('2',64)));
 binding:=pg_temp.call_oauth('active-grant','{"providerGrantId":"synthetic-opaque-grant"}');perform pg_temp.ok(binding->>'interactionUid'='synthetic-interaction-uid');
 perform pg_temp.call_oauth('upsert',jsonb_build_object('model','RefreshToken','keyHash',repeat('5',64),'ttl',604800,'payload',jsonb_build_object('kind','RefreshToken','iat',t,'exp',t+604800,'grantId','synthetic-opaque-grant','accountId','a0000000-0000-4000-8000-000000000001','clientId','synthetic-static-client','resource','https://tokenoverflow.app/api/mcp','scope','reports:publish')));
end$$;
commit; -- Future disposable fixture state only; permits a real durable replay assertion in next transaction.
begin isolation level read committed;
set local role tokenoverflow_oauth_backend;
select pg_temp.ok(pg_temp.call_oauth('consume',jsonb_build_object('model','RefreshToken','keyHash',repeat('5',64)))='"consumed"'::jsonb);
commit;
begin isolation level read committed;
set local role tokenoverflow_oauth_backend;
select pg_temp.ok(pg_temp.call_oauth('consume',jsonb_build_object('model','RefreshToken','keyHash',repeat('5',64)))='"replay-terminalized"'::jsonb);
commit; -- Durable outcome precedes later adapter InvalidGrant; never UPDATE+RAISE rollback.
begin isolation level read committed;
set local role tokenoverflow_oauth_backend;
select pg_temp.ok(pg_temp.call_oauth('active-grant','{"providerGrantId":"synthetic-opaque-grant"}') is null);
rollback;
-- Remaining future separately leased changed-risk driver cases (not inferred passed):
-- * Same grant/account/client/resource/scopes immutable; changed/subset/foreign capability binds fail.
-- * TWO actual refresh consume transactions: loser waits then terminalizes exact generation; new generation unaffected.
-- * Native publish locks account FK→formal quota→OAuth account/client→grant→credential; revoke/account-ban vs writer ordered.
-- * Missing/banned/nonanonymous account denies issuance/publish, read returns undefined; terminal cleanup still possible.
-- * Additional direct/transitive login membership rejects even NOINHERIT; default empty owner binding denies503.
-- * prepare under locks -> JS exact trim().slice(0,80) neutral name -> exact compact60000/12288 string bytes; no jsonb formatting claim.
-- * SQL final prepared grant/account/name match, exact bundle semantic equality, shared formal100 cap/evidence/example/self-result constraints.
-- * Known public.verifications unique(fix_id,author_id,environment)409 only; unrelated23505 generic500, no raw message.
-- * Session uid/current account/live expiry AND authorizations[clientId].grantId exact when expiresWithSession=true.
-- * Consumed tombstones retain hash/grant/expiry only; no raw native jti/body/Supabase bearer; no resurrection.
-- * Profile OFF/empty client registry and Data API/native path unavailable. No actual credential/Provider construction in source QA.

-- v2 disconnect future source cases, NOT executed by this source-only package:
-- * Fresh Node POST produces ONE ordinary branded Identity; pass same identity to disconnect helper.
-- * Service ignores supplied account/grant extras and derives only verified identity.user.id; unconfigured client403.
-- * Seed owner A/client X PENDING+ACTIVE, owner B/client X ACTIVE, owner A/client Y ACTIVE.
--   Disconnect A/X locks account share ->OAuth account/client ->matching grants ordered by provider_id,
--   terminals only A/X and returns {clientId:X,disconnected:true}; B/X and A/Y remain ACTIVE/unmodified.
-- * Repeat returns false; no grant IDs/list/global signout/cookie mutation or reconnect generation reuse.
-- * Current banned/deleted/nonanonymous account rejected; no client/body/native actor supplies ownership.
-- * Same account/client concurrent issuance/revoke observes terminal markers, other account/client unaffected.
