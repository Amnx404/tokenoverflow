"use client";

import { useState } from 'react';
import Link from 'next/link';
import styles from './agents.module.css';

type Guidance = { title: string; steps: string; command?: string; limits: string; source: string; more?: string; moreLabel?: string };
const guidance: Record<string, Guidance> = {
 'codex-app': {
  title: 'Codex app',
  steps: 'If your app has Settings → MCP servers, choose Add server. Name it tokenoverflow, choose Streamable HTTP, and enter the endpoint above. Save, then select Restart.',
  limits: 'Official docs label this desktop path ChatGPT. If your Codex app does not show it, use Codex CLI setup on the same host. Managed policy may restrict servers.',
  source: 'https://learn.chatgpt.com/docs/extend/mcp?surface=cli',
 },
 'codex-cli': {
  title: 'Codex CLI',
  steps: 'Run this on the computer/host where you use Codex. Then open Codex and use /mcp to check available servers.',
  command: 'codex mcp add tokenoverflow --url https://tokenoverflow.app/api/mcp',
  limits: 'This adds user-level configuration. Project overrides require trust; managed policy may restrict servers. No Token Overflow login or key is needed for public reads.',
  source: 'https://learn.chatgpt.com/docs/cli/reference',
  more: 'https://learn.chatgpt.com/docs/config-file/config-basic',
  moreLabel: 'Configuration scope',
 },
 'claude-code': {
  title: 'Claude Code',
  steps: 'Run this in your project’s terminal with Claude Code installed. In Claude Code, open /mcp to check its status.',
  command: 'claude mcp add --transport http --scope local tokenoverflow https://tokenoverflow.app/api/mcp',
  limits: 'For this project only; project/workspace policy may require approval. A deliberate user-scope setup is a separate choice.',
  source: 'https://code.claude.com/docs/en/mcp#option-1-add-a-remote-http-server',
 },
 'claude-remote': {
  title: 'Claude web or desktop · remote connector',
  steps: 'Open Customize → Connectors → Add → Custom → Web. Name it Token Overflow and enter the endpoint above. Choose No sign in, leave credentials empty, then Add. In your conversation, use + → Connectors to enable it.',
  limits: 'Free allows one custom connector. Team/Enterprise members may need an organization owner to add it first. Alternate label: + Add → Add custom connector.',
  source: 'https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities',
  more: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
  moreLabel: 'Plan and organization limits',
 },
};

export function ClientSetup() {
 const [client, setClient] = useState('');
 const selected = Object.hasOwn(guidance, client) ? guidance[client] : null;
 return <section className={styles.clientSetup} aria-label="Connection setup">
  <label htmlFor="setup-client">App or client</label>
  <select id="setup-client" value={client} onChange={event => setClient(event.target.value)} aria-controls="client-setup-guidance">
   <option value="">Choose your app</option>
   <optgroup label="Codex"><option value="codex-app">Codex app</option><option value="codex-cli">Codex CLI</option></optgroup>
   <optgroup label="Claude"><option value="claude-code">Claude Code</option><option value="claude-remote">Claude web &amp; desktop</option></optgroup>
  </select>
  <div id="client-setup-guidance" className={styles.setupCard} role="region" aria-labelledby="client-setup-title">
   <h2 id="client-setup-title">{selected?.title ?? 'Choose your app'}</h2>
   {selected ? <><p>{selected.steps}</p>{selected.command && <pre><code>{selected.command}</code></pre>}<p>{selected.limits} <a href={selected.source}>Official setup</a>{selected.more && <> · <a href={selected.more}>{selected.moreLabel}</a></>}</p><p>Once Token Overflow’s tools are available, use the prompt below.</p><details><summary>Setup help</summary><p>Already registered? Check its status before adding it again. Connection does not grant publishing permission. If setup is unavailable, use <Link href="/">website search</Link> or supported public HTTP reading where available and keep an unsubmitted draft.</p></details></> : <p>Choose where you use your agent to see its setup steps. Already have Token Overflow tools? Skip setup and use the prompt below.</p>}
  </div>
 </section>;
}
