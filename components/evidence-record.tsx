import type { EvidenceBundleV1, Observation } from '@/lib/types';
import styles from './evidence.module.css';
import { EvidenceText } from './evidence-text';

function ObservedResult({ value, label, level }: { value: Observation; label: string; level: 4 | 5 }) {
 const Heading = level === 4 ? 'h4' : 'h5';
 return <section className={styles.observation}><Heading>{label}</Heading>
  {value.output.length > 0 ? <>{value.output.trim().length === 0 && <p className="muted">Whitespace-only output recorded.</p>}<pre>{value.output}</pre></> : <p className="muted">Recorded output is empty.</p>}
  {value.exit_code !== undefined && <div className={styles.exit}>Exit code: {value.exit_code}</div>}
 </section>;
}

export function EvidenceRecord({ bundle, kind }: { bundle?: EvidenceBundleV1 | null; kind: 'report' | 'fix' | 'verification' }) {
 if (!bundle) return <p className={styles.missing}>No structured check recorded. Refer to the original description and notes; before / after details and versions may be incomplete.</p>;
 const title = kind === 'report' ? 'Reported baseline' : bundle.after_result ? 'Reported before / after' : 'Reported check · rerun not recorded';
 const Subheading = kind === 'verification' ? 'h5' : 'h4';
 const observationLevel = kind === 'verification' ? 5 : 4;
 return <section className={styles.record} aria-label={title}>
  {kind === 'verification' ? <h4>{title}</h4> : <h3>{title}</h3>}
  <div className={styles.check}><Subheading>{bundle.check.kind === 'command' ? 'Command' : 'Repeatable steps'}{kind !== 'report' && bundle.after_result && ' · shared instructions'}</Subheading><pre><EvidenceText text={bundle.check.instructions}/></pre></div>
  <div className={styles.check}><Subheading>Expected correct result</Subheading><pre>{bundle.check.expected_result}</pre></div>
  <div className={styles.comparison}>
   <ObservedResult value={bundle.before_result} label={kind === 'report' ? 'Baseline observation' : 'Before the change'} level={observationLevel}/>
   {kind !== 'report' && (bundle.after_result ? <ObservedResult value={bundle.after_result} label="After the change" level={observationLevel}/> : <section className={styles.observation}><Subheading>After the change</Subheading><p className="muted">Rerun not recorded. This remains a proposed change.</p></section>)}
  </div>
  <Subheading>Supplied version references</Subheading>
  <table className={styles.versions}><thead><tr><th scope="col">Kind</th><th scope="col">Name</th><th scope="col">Version</th></tr></thead><tbody>{bundle.versions.map(version => <tr key={JSON.stringify([version.kind, version.name])}><td>{version.kind}</td><td>{version.name}</td><td>{version.version === null ? 'Unknown · not supplied' : version.version}</td></tr>)}</tbody></table>
 </section>;
}
