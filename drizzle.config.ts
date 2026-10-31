import { defineConfig } from 'drizzle-kit';

// Introspection only. Existing SQL owns constraints, policies and private routines.
// Do not run push/generate against the partial runtime mapping in schema.ts.
export default defineConfig({
  dialect:'postgresql', schema:'./server/db/schema.ts', out:'./drizzle',
  dbCredentials:{url:process.env.DATABASE_URL ?? ''},
  schemaFilter:['public'],
});
