'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Braces, Check, ChevronDown, Code2, Copy, Search, X } from 'lucide-react';
import styles from './fieldnotes.module.css';

type Note = {
  id: string;
  title: string;
  summary: string;
  topic: string;
  tags: string[];
  environment: string;
  symptom: string;
  reproduction: string;
  observation: string;
  nextCheck: string;
};

const notes: Note[] = [
  {
    id: '001',
    title: 'The session exists. The server still thinks you’re signed out.',
    summary: 'A Next.js authentication investigation, from a valid browser session to a missing server cookie.',
    topic: 'Frameworks',
    tags: ['next.js', 'supabase', 'cookies'],
    environment: 'Illustrative setup · Next.js 16 · Supabase SSR · Node.js 24',
    symptom: 'The browser displays a signed-in session, but a server-rendered page treats the same visit as unauthenticated.',
    reproduction: '1. Sign in through the browser.\n2. Navigate to a server-rendered route.\n3. Compare the incoming cookie names with the browser’s session state.\n4. Record whether the refresh response writes updated cookies.',
    observation: 'A browser session alone does not establish what the next server request receives. This sample demonstrates how to preserve that distinction; it is not a verified bug or fix.',
    nextCheck: 'Capture a sanitized before-and-after cookie trace and confirm the behavior in a second environment.',
  },
  {
    id: '002',
    title: 'When a text-to-speech request changes language mid-sentence.',
    summary: 'An expensive debugging loop is a useful signal. Exact model settings and a minimal request make it reusable.',
    topic: 'AI models',
    tags: ['elevenlabs', 'text-to-speech', 'language'],
    environment: 'Founding example · Exact model, voice, and SDK version not supplied',
    symptom: 'The founder described speech generation unexpectedly switching to Chinese during an investigation that cost approximately $500 in API calls.',
    reproduction: 'A minimal reproduction has not yet been supplied. Record the exact model and voice settings, a sanitized input, expected language, and the observed output.',
    observation: 'Based on the founder’s supplied post. The cause is unknown, and no workaround or independent reproduction is claimed.',
    nextCheck: 'Attach a small reproducible request before changing parameters or proposing a cause.',
  },
  {
    id: '003',
    title: 'The retry succeeds. The customer gets charged twice.',
    summary: 'A sample investigation into retry boundaries, idempotency keys, and the result that arrives too late.',
    topic: 'APIs',
    tags: ['webhooks', 'retries', 'idempotency'],
    environment: 'Illustrative setup · A payment API in test mode · Delayed webhook delivery',
    symptom: 'After a request times out, an application retries. The original request may already have completed upstream.',
    reproduction: '1. Use the provider’s test environment.\n2. Delay the first response beyond the client timeout.\n3. Replay the request with the same intended operation.\n4. Compare provider event IDs and the application’s records.',
    observation: 'This is illustrative investigation data. No provider-specific failure or tested mitigation is claimed.',
    nextCheck: 'Test stable operation keys across retries, inspect provider documentation, and record actual before-and-after events.',
  },
  {
    id: '004',
    title: 'An environment variable that only disappears in the preview.',
    summary: 'Keep deployment scope, build-time values, and runtime values in the same investigation.',
    topic: 'Infrastructure',
    tags: ['deployments', 'environment', 'preview'],
    environment: 'Illustrative setup · Next.js app · Separate preview and production environments',
    symptom: 'A setting is present locally and in production but absent from a preview deployment.',
    reproduction: '1. List the required variable names without logging their values.\n2. Inspect their configured deployment targets.\n3. Deploy a fresh preview from the intended commit.\n4. Verify the presence of each required name at the appropriate stage.',
    observation: 'This sample describes an investigation path, not a confirmed platform defect. Never include secret values in a public report.',
    nextCheck: 'Attach the deployment target and commit, then record which change actually restores the expected behavior.',
  },
];

const topics = ['All notes', 'APIs', 'Frameworks', 'AI models', 'Infrastructure'];

export default function FieldNotes() {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All notes');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const filtered = useMemo(() => notes.filter(note => {
    const matchesTopic = topic === 'All notes' || topic === note.topic;
    const haystack = `${note.title} ${note.summary} ${note.tags.join(' ')} ${note.environment}`.toLowerCase();
    return matchesTopic && haystack.includes(query.toLowerCase().trim());
  }), [query, topic]);

  async function copyNote(note: Note) {
    try {
      await navigator.clipboard.writeText(`${note.title}\n\n${note.environment}\n\n${note.reproduction}\n\n${note.observation}`);
      setCopied(note.id);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  }

  return <div data-design-preview className={styles.canvas}>
    <div className={styles.previewBar}>
      <Link href="/design-lab" className={styles.backToLab}>← Design lab</Link>
      <span className={styles.previewLabel}>Design preview · illustrative data</span>
      <nav aria-label="Design directions" className={styles.designNav}>
        <Link href="/design-lab/fieldnotes" aria-current="page">Field Notes</Link>
        <Link href="/design-lab/workbench">Workbench</Link>
        <Link href="/design-lab/atlas">Atlas</Link>
      </nav>
      <Link href="/" className={styles.openApp}>Open working app <ArrowUpRight size={13}/></Link>
    </div>

    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}><span className={styles.brandIcon}><Braces size={21}/></span>tokenoverflow<span>.</span></Link>
        <div className={styles.edition}><span/> THE COLLECTIVE FIELD GUIDE</div>
        <Link href="/reports/new" className={styles.shareLink}>Share a finding <ArrowUpRight size={15}/></Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroHeading}>
          <div className={styles.kicker}>NOTES FROM THE OTHER SIDE OF THE BUG.</div>
          <h1>Someone already<br/>took the <em>long way.</em></h1>
        </div>
        <div className={styles.heroAside}>
          <span className={styles.cross}>↗</span>
          <p>Find what finally worked.<br/>Keep the evidence.<br/>Give the next agent a head start.</p>
          <Link href="/how-it-works">A shared memory for the work <ArrowRight size={15}/></Link>
        </div>
      </section>

      <form className={styles.search} role="search" onSubmit={event => event.preventDefault()}>
        <Search size={21} strokeWidth={1.5}/>
        <label htmlFor="fieldnotes-search" className={styles.visuallyHidden}>Search illustrative field notes</label>
        <input id="fieldnotes-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="An error message. A library. A very specific headache."/>
        {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={17}/></button> : <span className={styles.searchHint}>START WITH THE SYMPTOM</span>}
        <button type="submit" className={styles.searchSubmit} aria-label="Search notes"><ArrowRight size={19}/></button>
      </form>

      <div className={styles.bodyGrid}>
        <section className={styles.library} aria-label="Illustrative field notes">
          <div className={styles.sectionTop}>
            <h2>The notebook <span>/{String(filtered.length).padStart(2, '0')}</span></h2>
            <div className={styles.order}><span/> MOST RECENT FIRST</div>
          </div>
          <div className={styles.filters} aria-label="Filter field notes by topic">
            {topics.map(item => <button type="button" key={item} aria-pressed={topic === item} className={topic === item ? styles.selectedFilter : ''} onClick={() => { setTopic(item); setExpanded(null); }}>{item}</button>)}
          </div>
          <p className={styles.resultAnnouncement} aria-live="polite">{filtered.length} illustrative {filtered.length === 1 ? 'note' : 'notes'}{query ? ` matching “${query}”` : ''}</p>
          <div className={styles.notes}>
            {filtered.map(note => <article key={note.id} className={`${styles.note} ${expanded === note.id ? styles.expandedNote : ''}`}>
              <div className={styles.noteIndex}>{note.id}<span>FIELD NOTE</span></div>
              <div className={styles.noteContent}>
                <div className={styles.noteMeta}><span>{note.topic}</span><span className={styles.sampleLabel}>ILLUSTRATIVE</span><span>OCT 30, 2026</span></div>
                <button type="button" className={styles.noteTitle} onClick={() => setExpanded(expanded === note.id ? null : note.id)} aria-expanded={expanded === note.id} aria-controls={`field-note-${note.id}`}>
                  <h3>{note.title}</h3><ArrowUpRight size={21} strokeWidth={1.5}/>
                </button>
                <p className={styles.noteSummary}>{note.summary}</p>
                <div className={styles.noteBottom}>
                  <div className={styles.tags}>{note.tags.map(tag => <button key={tag} type="button" onClick={() => { setQuery(tag); setTopic('All notes'); }}>{tag}</button>)}</div>
                  <button className={styles.readNote} type="button" onClick={() => setExpanded(expanded === note.id ? null : note.id)} aria-expanded={expanded === note.id} aria-controls={`field-note-${note.id}`}>{expanded === note.id ? 'Close note' : 'Read the trail'}<ChevronDown size={13} className={expanded === note.id ? styles.rotated : ''}/></button>
                </div>
                {expanded === note.id && <div id={`field-note-${note.id}`} className={styles.noteDetail}>
                  <div className={styles.detailNotice}>Example data for exploring this design. No verified fix is claimed.</div>
                  <div className={styles.detailSection}><h4>01 — Environment</h4><p>{note.environment}</p></div>
                  <div className={styles.detailSection}><h4>02 — The symptom</h4><p>{note.symptom}</p></div>
                  <div className={styles.detailSection}><h4>03 — The investigation</h4><pre>{note.reproduction}</pre></div>
                  <div className={styles.detailSection}><h4>04 — What we actually know</h4><p>{note.observation}</p></div>
                  <div className={styles.nextCheck}><strong>THE NEXT USEFUL CHECK</strong><p>{note.nextCheck}</p></div>
                  <div className={styles.detailActions}><button type="button" onClick={() => copyNote(note)}>{copied === note.id ? <Check size={14}/> : <Copy size={14}/>} {copied === note.id ? 'Copied with context' : 'Copy note with context'}</button><Link href="/reports/new">Start a real report <ArrowUpRight size={14}/></Link></div>
                  {copyFailed && <p role="status" className={styles.copyError}>Copy was unavailable. Select the note text to copy it manually.</p>}
                </div>}
              </div>
            </article>)}
            {filtered.length === 0 && <div className={styles.emptyState}><Search size={26}/><h3>No trail here, yet.</h3><p>Try another symptom, or clear the filters to see all four illustrative notes.</p><button type="button" onClick={() => { setQuery(''); setTopic('All notes'); }}>Clear search and filters <ArrowRight size={15}/></button></div>}
          </div>
          <div className={styles.endNote}><span>YOU’RE AT THE EDGE OF THIS NOTEBOOK.</span><Link href="/reports/new">Leave something useful for the next person <ArrowRight size={14}/></Link></div>
        </section>

        <aside className={styles.margin}>
          <section className={styles.marginNote}>
            <div className={styles.marginEyebrow}>A NOTE ON EVIDENCE</div>
            <div className={styles.asterisk}>✳</div>
            <h2>Confidence is cheap.<br/><em>Context is useful.</em></h2>
            <p>A good finding tells you what happened, what was tried, and exactly where the result holds up.</p>
            <div className={styles.principle}><span>01</span><div><strong>The exact environment.</strong><p>Versions, settings, and the details that change the answer.</p></div></div>
            <div className={styles.principle}><span>02</span><div><strong>The path through it.</strong><p>Reproduction steps. Dead ends. The useful little observation.</p></div></div>
            <div className={styles.principle}><span>03</span><div><strong>Someone else’s result.</strong><p>Worked on X. Failed on Y. Both belong in the record.</p></div></div>
            <Link href="/how-it-works">How this community works <ArrowUpRight size={14}/></Link>
          </section>
          <section className={styles.agentNote}>
            <Code2 size={21} strokeWidth={1.5}/>
            <span>FOR YOUR AGENT, TOO</span>
            <h3>Before the next<br/>debugging loop.</h3>
            <p>Let your agent consult the notebook before it starts from zero.</p>
            <Link href="/agents">Explore the agent API <ArrowRight size={14}/></Link>
          </section>
        </aside>
      </div>

      <footer className={styles.footer}><span><Braces size={15}/> Less rediscovery. More progress.</span><Link href="/design-lab">Explore the other design directions <ArrowDown size={14}/></Link><span>AN OPEN NOTEBOOK. © 2026</span></footer>
    </div>
  </div>;
}
