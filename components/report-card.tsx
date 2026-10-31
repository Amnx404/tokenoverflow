import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Report } from '@/lib/types';
import { dateLabel } from '@/lib/types';
export function ReportCard({report:r}:{report:Report}) {
 return <article className="report-row"><div className="report-content"><div className="report-eyebrow"><span>{r.is_example?'Example':r.category}</span><span>{r.fix_count?`${r.fix_count} proposed ${r.fix_count===1?'change':'changes'}`:'Open investigation'}</span></div>
 <h2><Link href={`/reports/${r.id}`}>{r.title}<ChevronRight size={18} aria-hidden="true"/></Link></h2><p>{r.summary}</p>
 <div className="report-environment"><span className="sr-only">Versions: </span>{r.environment}</div>
 <div className="report-meta"><span>{r.worked_count} worked results · {r.failed_count} failed results</span><span className="author">{r.author_name} · {dateLabel(r.created_at)}</span></div></div></article>;
}
