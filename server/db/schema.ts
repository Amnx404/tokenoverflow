import { customType, boolean, integer, jsonb, pgSchema, pgTable, pgView, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { EvidenceBundleV1 } from '@/lib/types';

// Runtime mappings for the existing Supabase schema. supabase/schema.sql remains
// authoritative for RLS, checks, generated search_document, indexes and routines.
export const reports = pgTable('reports', {
  id: uuid().primaryKey().defaultRandom(), author_id: uuid(), author_name: text().notNull(),
  title: text().notNull(), summary: text().notNull(), body: text().notNull(),
  environment: text().notNull(), reproduction: text().notNull(), attempted_fixes: text().notNull().default(''),
  category: text().notNull(), tags: text().array().notNull().default([]),
  evidence_bundle: jsonb().$type<EvidenceBundleV1>(),
  is_example: boolean().notNull().default(false), created_at: timestamp({withTimezone:true, mode:'string'}).notNull().defaultNow(),
});
export const fixes = pgTable('fixes', {
  id: uuid().primaryKey().defaultRandom(), report_id: uuid().notNull().references(()=>reports.id,{onDelete:'cascade'}),
  author_id: uuid().notNull(), author_name: text().notNull(), body: text().notNull(),
  environment: text().notNull(), evidence: text().notNull(), evidence_bundle: jsonb().$type<EvidenceBundleV1>(),
  created_at: timestamp({withTimezone:true, mode:'string'}).notNull().defaultNow(),
});
export const verifications = pgTable('verifications', {
  id: uuid().primaryKey().defaultRandom(), fix_id: uuid().notNull().references(()=>fixes.id,{onDelete:'cascade'}),
  author_id: uuid().notNull(), author_name: text().notNull(), outcome: text().$type<'worked'|'failed'>().notNull(),
  environment: text().notNull(), notes: text().notNull(), evidence_bundle: jsonb().$type<EvidenceBundleV1>(),
  created_at: timestamp({withTimezone:true, mode:'string'}).notNull().defaultNow(),
});
export const reportFeed = pgView('report_feed', {
  id: uuid().notNull(), author_id: uuid(), author_name: text().notNull(), title: text().notNull(), summary: text().notNull(),
  environment: text().notNull(), category: text().notNull(), tags: text().array().notNull(),
  is_example: boolean().notNull(), created_at: timestamp({withTimezone:true,mode:'string'}).notNull(),
  fix_count: integer().notNull(), worked_count: integer().notNull(), failed_count: integer().notNull(),
}).existing();

// Additive mapping only; discussion SQL owns its restrictive grants/immutable adjacency.
const discussionFingerprint=customType<{data:Buffer}>({dataType(){return 'bytea';}});
export const discussionComments=pgTable('discussion_comments',{
 id:uuid().primaryKey(),report_id:uuid().notNull(),parent_id:uuid(),root_id:uuid().notNull(),depth:integer().notNull(),
 author_id:uuid(),author_name:text(),body:text(),created_at:timestamp({withTimezone:true,mode:'string'}).notNull(),redacted_at:timestamp({withTimezone:true,mode:'string'}),
 create_request_id:uuid().notNull(),create_fingerprint:discussionFingerprint().notNull(),
});

// Private OFF-default provider storage. No Data API table grant; canonical SQL owns guards.
const oauthPrivate=pgSchema('private');
export const oauthBackendLogins=oauthPrivate.table('oauth_backend_logins',{login:text().primaryKey()});
export const oauthGrants=oauthPrivate.table('oauth_grants',{
 provider_id:text().primaryKey(),generation_id:uuid().notNull(),account_id:uuid(),client_id:text().notNull(),resource:text().notNull(),scopes:text().array().notNull(),state:text().notNull(),
 created_at:timestamp({withTimezone:true,mode:'string'}).notNull(),approved_at:timestamp({withTimezone:true,mode:'string'}),approved_interaction_uid:text(),renewable:boolean().notNull(),expires_at:timestamp({withTimezone:true,mode:'string'}).notNull(),terminal_at:timestamp({withTimezone:true,mode:'string'}),
});
export const oauthProviderRecords=oauthPrivate.table('oauth_records',{
 model:text().notNull(),key_hash:text().notNull(),payload:jsonb().notNull(),grant_id:text(),uid:text(),created_at:timestamp({withTimezone:true,mode:'string'}).notNull(),expires_at:timestamp({withTimezone:true,mode:'string'}).notNull(),retain_until:timestamp({withTimezone:true,mode:'string'}).notNull(),consumed_at:timestamp({withTimezone:true,mode:'string'}),revoked:boolean().notNull(),
},table=>[primaryKey({columns:[table.model,table.key_hash]})]);
