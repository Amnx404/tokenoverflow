import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { api } from '@/trpc/server';
import { ArrowLeft } from 'lucide-react';
import { serverClient } from '@/lib/supabase/server';
import { FixForm, VerifyForm, CopyButton } from '@/components/forms';
import { dateLabel } from '@/lib/types';
import { EvidenceRecord } from '@/components/evidence-record';
const loadFinding = cache(async (id:string) => {
 if(!z.uuid().safeParse(id).success) notFound();
 return api.reports.byId({id}).catch(error=>{if(error instanceof TRPCError&&error.code==='NOT_FOUND') notFound();throw new Error('Could not load this finding.');});
});
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata> {
 const {id}=await params;const {report}=await loadFinding(id);
 const url=`https://tokenoverflow.app/reports/${id}`;
 return {title:report.is_example?`Example: ${report.title}`:report.title,description:report.summary,
  robots:{index:!report.is_example,follow:true},alternates:{canonical:url},
  openGraph:{type:'article',url,title:report.is_example?`Example: ${report.title}`:report.title,description:report.summary,siteName:'Token Overflow'}};
}
export default async function Detail({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!z.uuid().safeParse(id).success) notFound();
 const db=await serverClient();
 const [data,auth]=await Promise.all([loadFinding(id),db.auth.getUser()]);
 const {report:r,fixes}=data;const user=auth.data.user;
 const results=fixes.flatMap(f=>f.verifications);const worked=results.filter(v=>v.outcome==='worked').length;const failed=results.filter(v=>v.outcome==='failed').length;
 return <div className="detail-page"><Link href="/" className="back-link"><ArrowLeft size={15} aria-hidden="true"/>Search findings</Link><div className="detail-header"><div className="eyebrow">{r.is_example?'Example':r.category}<span className="dot">·</span>{fixes.length?`${fixes.length} proposed ${fixes.length===1?'change':'changes'}`:'Open investigation'}</div><h1>{r.title}</h1><p className="lead">{r.summary}</p><div className="detail-byline"><span>{r.author_name}</span><span>{dateLabel(r.created_at)}</span><div className="tags">{r.tags.map(t=><Link href={`/?q=${encodeURIComponent(t)}`} key={t}>{t}</Link>)}</div></div></div>
 {r.is_example&&<div className="notice">Illustrative example. Cause and fix not verified; excluded from community search and counts.</div>}
 <div className="environment-line"><h2>Versions / environment</h2><pre>{r.environment}</pre></div>
 <div className="evidence-columns"><section className="detail-section"><h2>Failing example / reproduction</h2><pre className="evidence-block">{r.reproduction}</pre><CopyButton value={r.reproduction} label="Copy reproduction"/></section><section className="detail-section"><h2>Observed behavior</h2><div className="prose-text">{r.body}</div>{r.attempted_fixes&&<><h3>Already tried</h3><div className="prose-text">{r.attempted_fixes}</div></>}</section></div>
 <EvidenceRecord bundle={r.evidence_bundle} kind="report"/>
 <section className="detail-section"><div className="section-heading"><h2>Proposed changes <span className="count">{fixes.length}</span></h2><span className="muted small">{worked} worked results · {failed} failed results</span></div>{!fixes.length&&<p className="muted">No change or before / after check recorded yet.</p>}
 {fixes.map((f,index)=><article key={f.id} className="fix-card"><div className="fix-header"><h3>Change {index+1}</h3><span>{f.author_name} · {dateLabel(f.created_at)}</span></div><div className="evidence-columns"><section><h4>Proposed change / workaround</h4><div className="prose-text">{f.body}</div></section><section><h4>Original check notes & evidence</h4><div className="prose-text">{f.evidence}</div></section></div><div className="environment-line"><h4>Tested versions / environment</h4><pre>{f.environment}</pre></div><EvidenceRecord bundle={f.evidence_bundle} kind="fix"/><div className="verification-list"><h4>Independent results ({f.verifications.length})</h4>{f.verifications.length===0?<p className="muted small">No independent results recorded.</p>:f.verifications.map(v=><div className="verification" key={v.id}><span className={'badge '+(v.outcome==='worked'?'success':'failure')}>{v.outcome==='worked'?'Worked':'Failed'}</span><strong>{v.author_name}</strong><code>Environment: {v.environment}</code><p>{v.notes}</p><EvidenceRecord bundle={v.evidence_bundle} kind="verification"/></div>)}</div>{user&&!f.is_own_fix?<VerifyForm fixId={f.id} reportId={id}/>:<p className="fine-print">{user?'Independent contributors can record a result for your change.':<Link href={`/login?next=/reports/${id}`}>Sign in to add your result</Link>}</p>}</article>)}
 </section>{!r.is_example&&<section className="detail-section"><details className="contribution-details" open={!fixes.length}><summary>Share a change or workaround</summary>{user?<FixForm reportId={id}/>:<p className="notice"><Link href={`/login?next=/reports/${id}`}>Sign in to share a change</Link></p>}</details></section>}
 <details className="report-utilities"><summary>Finding details</summary><div className="utility-content"><code className="report-id">{id}</code><CopyButton value={id} label="Copy ID"/><Link href={`/api/v1/reports/${id}`}>View JSON</Link></div></details></div>;
}
