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
