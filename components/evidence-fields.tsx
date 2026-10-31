'use client';

import { useId, useState } from 'react';
import styles from './evidence.module.css';

type RecordKind = 'report' | 'fix' | 'verification';
const versionKinds = ['package', 'runtime', 'os', 'model', 'api', 'other'] as const;

function ObservationFields({ phase, baseline = false }: { phase: 'before' | 'after'; baseline?: boolean }) {
 return <fieldset className={styles.group}>
  <legend>{baseline ? 'Baseline observation' : phase === 'before' ? 'Before the change' : 'After the change'}</legend>
  <label>Observed output<textarea name={`evidence_${phase}_output`} rows={4} placeholder="Paste the observed output exactly. Leave empty if the check produced no output."/></label>
  <label>Exit code · optional<input name={`evidence_${phase}_exit_code`} type="number" min={0} max={255} step={1} placeholder="0–255; leave empty for a non-process check"/></label>
  <p className="fine-print">Supply output or an exit code. Exit code 0 alone does not establish that the check passed.</p>
 </fieldset>;
}

/** Plain named fields are assembled and validated by the shared server action. */
export function EvidenceFields({ kind }: { kind: RecordKind }) {
 const [enabled, setEnabled] = useState(false);
 const [afterRecorded, setAfterRecorded] = useState(false);
 const [unknownVersions, setUnknownVersions] = useState([false]);
 const helpId = useId();
 return <fieldset className={styles.editor}>
  <legend>Record a check · optional</legend>
  <label className={styles.toggle}><input type="checkbox" name="evidence_enabled" value="1" checked={enabled} onChange={event => setEnabled(event.target.checked)} aria-describedby={helpId}/>Add structured check and version details</label>
  <p id={helpId} className="fine-print">Keep your original description. These details record what you observed; they do not verify execution.</p>
  {enabled && <div className={styles.fields}>
   <label>Check type<select name="evidence_check_kind"><option value="command">Command</option><option value="steps">Repeatable steps</option></select></label>
   <label>{kind === 'report' ? 'Baseline command or steps' : 'Same command or steps for before and after'}<textarea name="evidence_check_instructions" rows={3} required placeholder="Record the exact command or repeatable steps. Nothing is run automatically."/></label>
   <label>Expected correct result<textarea name="evidence_check_expected_result" rows={2} required placeholder="What should this check show when the behavior is correct?"/></label>
   <ObservationFields phase="before" baseline={kind === 'report'}/>
   {kind === 'report' ? <p className="fine-print">This records the baseline only. The investigation stays open; no fixing rerun is implied.</p> : <>
    {kind === 'fix' && <label className={styles.toggle}><input type="checkbox" name="evidence_after_recorded" value="1" checked={afterRecorded} onChange={event => setAfterRecorded(event.target.checked)}/>I recorded a rerun after this change</label>}
    {(kind === 'verification' || afterRecorded) ? <ObservationFields phase="after"/> : <p className="fine-print">Rerun not recorded. You can still publish the proposed change with its limitations.</p>}
    {kind === 'verification' && <p className="fine-print">Record both observations for your selected worked/failed result. If the original baseline did not fail, describe that in an open finding instead of recording a failed fix.</p>}
   </>}
   <fieldset className={styles.group}><legend>Relevant versions</legend>
    <input type="hidden" name="evidence_version_count" value={unknownVersions.length}/>
    {unknownVersions.map((unknown, index) => <fieldset key={index} className={styles.version}>
     <legend>Version {index + 1}</legend>
     <div className={styles.versionFields}>
      <label>Kind<select name={`evidence_versions.${index}.kind`}>{versionKinds.map(value => <option key={value} value={value}>{value === 'os' ? 'OS' : value === 'api' ? 'API' : value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
      <label>Name<input name={`evidence_versions.${index}.name`} required placeholder="e.g. Node.js"/></label>
      <label>Version<input name={`evidence_versions.${index}.version`} required={!unknown} disabled={unknown} placeholder={unknown ? 'Unknown' : 'Exact version'}/></label>
     </div>
     <label className={styles.toggle}><input type="checkbox" name={`evidence_versions.${index}.unknown`} value="1" checked={unknown} onChange={event => setUnknownVersions(values => values.map((value, row) => row === index ? event.target.checked : value))}/>Version is unknown</label>
    </fieldset>)}
    <div className={styles.versionActions}>
     <button type="button" className="button secondary" disabled={unknownVersions.length >= 12} onClick={() => setUnknownVersions(values => [...values, false])}>Add version</button>
     {unknownVersions.length > 1 && <button type="button" className="button secondary" onClick={() => setUnknownVersions(values => values.slice(0, -1))}>Remove last version</button>}
     <span className="fine-print" role="status">{unknownVersions.length} of 12 version references</span>
    </div>
    <p className="fine-print">Use one reference per kind and exact name. These are supplied versions, not an automatically detected inventory.</p>
   </fieldset>
  </div>}
 </fieldset>;
}
