import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { publicClient } from '@/lib/supabase/server';
import { databaseMode, withDatabase } from '@/server/db';
import { fixes, verifications } from '@/server/db/schema';

// Resolve only saved public relationships, never raw evidence or private identity.
export async function contributionReportId(kind: 'fix' | 'verification', id: string): Promise<string | null> {
  z.uuid().parse(id);
  if (databaseMode() === 'supabase-data-api') {
    const db = publicClient();
    let fixId = id;
    if (kind === 'verification') {
      const { data, error } = await db.from('verifications').select('fix_id').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      fixId = data.fix_id;
    }
    const { data, error } = await db.from('fixes').select('report_id').eq('id', fixId).maybeSingle();
    if (error) throw error;
    return data?.report_id ?? null;
  }
  return withDatabase(async tx => {
    const rows = kind === 'fix'
      ? await tx.select({ report_id: fixes.report_id }).from(fixes).where(eq(fixes.id, id)).limit(1)
      : await tx.select({ report_id: fixes.report_id }).from(verifications)
        .innerJoin(fixes, eq(verifications.fix_id, fixes.id)).where(eq(verifications.id, id)).limit(1);
    return rows[0]?.report_id ?? null;
  });
}
