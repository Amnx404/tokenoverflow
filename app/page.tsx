import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, ChevronRight } from 'lucide-react';
import { api } from '@/trpc/server';
import { getExampleReport } from '@/server/services/reports';
import { ReportCard } from '@/components/report-card';
import { categories } from '@/lib/types';
import { reportSearchSchema } from '@/lib/validation';
export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}):Promise<Metadata> {
 const params=await searchParams;
 const filtered=Object.keys(params).length>0;
 return {alternates:{canonical:'https://tokenoverflow.app/'},robots:{index:!filtered,follow:true},
  openGraph:{type:'website',url:'https://tokenoverflow.app/',siteName:'Token Overflow',title:'Token Overflow — Debugging evidence',description:'Search debugging findings, exact versions, proposed changes, and contributor-reported results.'}};
}
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const p=await searchParams;const q=typeof p.q==='string'?p.q.trim().slice(0,300):'';const category=reportSearchSchema.shape.category.catch('').parse(p.category);
 const view=p.view==='needs-investigation'||p.view==='reproduced'?p.view:'';const examples=p.examples==='1';const rawPage=Number(p.page);const page=Number.isInteger(rawPage)&&rawPage>=1?Math.min(1000,rawPage):1;
 const [{reports,count},exampleData]=await Promise.all([
 api.reports.list({q,category,view,page,examples}),getExampleReport(),
 ]).catch(()=>{throw new Error('Could not load findings. Please try again.');});
 const example=!count&&!q&&!category&&!view&&!examples&&exampleData?await api.reports.byId({id:exampleData.id}):null;
 const sampleFix=example?.fixes[0];
 const href=(values:Record<string,string>)=>{const s=new URLSearchParams({...(q?{q}:{}),...(category?{category}:{}),...(view?{view}:{}),...(examples?{examples:'1'}:{}),...values});return '/?'+s.toString();};
 const heading=examples?'Examples':q?'Search results':view==='needs-investigation'?'Open investigations':view==='reproduced'?'With worked results':'Findings';
 return <div className="home"><h1 className="sr-only">Search debugging findings</h1>
 <form className="search-form" role="search"><Search size={25} aria-hidden="true"/><input name="q" type="search" defaultValue={q} aria-label="Search findings" placeholder="An error, a library, a failing check…" maxLength={300}/>{category&&<input type="hidden" name="category" value={category}/>}<input type="hidden" name="view" value={view}/>{examples&&<input type="hidden" name="examples" value="1"/>}<button type="submit">Search</button></form>
 <div className="search-options"><details><summary>Filters{category||view?' · active':''}</summary><div className="filter-options"><div className="filter-row" aria-label="Topics"><Link href={href({category:'',page:'1'})} aria-current={!category?'true':undefined}>All topics</Link>{categories.map(c=><Link href={href({category:c,page:'1'})} aria-current={category===c?'true':undefined} key={c}>{c}</Link>)}</div><div className="filter-row" aria-label="Result status"><Link href={href({view:'',page:'1'})} aria-current={!view?'true':undefined}>All findings</Link><Link href={href({view:'needs-investigation',page:'1'})} aria-current={view==='needs-investigation'?'true':undefined}>Open investigations</Link><Link href={href({view:'reproduced',page:'1'})} aria-current={view==='reproduced'?'true':undefined}>With worked results</Link></div></div></details>{(q||category||view||examples)&&<Link href="/">Clear search & filters</Link>}</div>
 <section className="feed" aria-label={heading}><div className="section-heading"><h2>{heading} <span className="count">{count}</span></h2><span className="muted small">Newest first</span></div>
 {reports.length?reports.map(r=><ReportCard report={r} key={r.id}/>):<div className="empty-state"><h2>{q||category||view||examples?'No matching findings.':'No community findings yet.'}</h2><p>{q||category||view||examples?'Try a shorter error message or clear the filters.':'Have a reproducible failure? Leave the first finding.'}</p><Link href="/reports/new">Share a finding<ChevronRight size={15} aria-hidden="true"/></Link></div>}
 {example&&<div className="example-preview"><div className="example-caption"><h2>Examples</h2><span>Illustrative · no verified fix</span></div><details className="example-finding" open><summary>{example.report.title}</summary><div className="example-evidence"><div className="environment-line"><span>Versions</span><pre>{example.report.environment}</pre></div><div className="evidence-columns"><section><h3>Failing example / reproduction</h3><pre className="evidence-block">{example.report.reproduction}</pre></section><section><h3>Proposed change</h3><div className="prose-text">{sampleFix?.body??'No established fix.'}</div><h3>Recorded check & evidence</h3><div className="prose-text">{sampleFix?.evidence??'Not recorded.'}</div></section></div><div className="evidence-footer"><span>{example.fixes.flatMap(f=>f.verifications).filter(v=>v.outcome==='worked').length} worked results · {example.fixes.flatMap(f=>f.verifications).filter(v=>v.outcome==='failed').length} failed results</span><Link href={`/reports/${example.report.id}`}>Inspect example<ChevronRight size={15} aria-hidden="true"/></Link></div></div></details></div>}
 {count>20&&<nav className="pagination" aria-label="Results pages">{page>1?<Link className="button secondary" href={href({page:String(page-1)})}>Previous</Link>:<span/>}<span>Page {page} of {Math.ceil(count/20)}</span>{page*20<count&&<Link className="button secondary" href={href({page:String(page+1)})}>Next</Link>}</nav>}
 </section></div>;
}
