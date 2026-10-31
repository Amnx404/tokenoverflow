import type { ReactNode } from 'react';

// Render explicit links without interpreting contributed HTML, Markdown or commands.
// Keep every original character, including punctuation trimmed from a link target.
export function EvidenceText({ text }: { text: string }) {
 const parts: ReactNode[] = [];
 const starts = /https?:\/\//gi;
 let copied = 0;
 let scannedUntil = 0;
 for (const match of text.matchAll(starts)) {
  const start = match.index;
  const boundary = start === 0 || /[\s([{'"<]/.test(text[start - 1]) ||
   (start === scannedUntil + 1 && /[,;]/.test(text[start - 1]));
  if (start < scannedUntil || !boundary) continue;
  let end = start + match[0].length;
  let queryOrFragment = false;
  while (end < text.length && !/[ \r\n"'<>]/.test(text[end])) {
   // Two prose-adjacent URLs may have no space between them. Query/fragment
   // punctuation stays part of the first URL rather than becoming a separator.
   if (!queryOrFragment &&
    ((/[,;]/.test(text[end]) && /^https?:\/\//i.test(text.slice(end + 1))) ||
     (text[end] === '(' && text[end - 1] === ')' && /^https?:\/\//i.test(text.slice(end + 1))))) break;
   if (text[end] === '?' || text[end] === '#') queryOrFragment = true;
   end++;
  }
  scannedUntil = end;
  const whole = text.slice(start, end);
  // URL() can silently strip controls and convert backslashes. Reject the
  // entire raw token before trimming or parsing, never link a repaired prefix.
  if ([...whole].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === '\\') ||
   /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(whole)) continue;
  const excess: Record<string, number> = { ')': 0, ']': 0, '}': 0 };
  for (const char of whole) {
   if (char in excess) excess[char]++;
   const closer = char === '(' ? ')' : char === '[' ? ']' : char === '{' ? '}' : undefined;
   if (closer) excess[closer]--;
  }
  let targetEnd = whole.length;
  while (targetEnd > 0) {
   const last = whole[targetEnd - 1];
   if (excess[last] > 0) {
    excess[last]--;
    targetEnd--;
   } else if (!queryOrFragment && /[.,;!]/.test(last)) {
    targetEnd--;
   } else break;
  }
  const target = whole.slice(0, targetEnd);
  const authority = /^https?:\/\/([^/?#]+)/i.exec(target)?.[1];
  if (!authority || authority.includes('@')) continue;
  try {
   const url = new URL(target);
   const host = url.hostname;
   const dnsHost = host.endsWith('.') ? host.slice(0, -1) : host;
   if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !host ||
    (!host.startsWith('[') && (dnsHost.length > 253 || dnsHost.split('.').some(label =>
     label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))))) continue;
  } catch { continue; }
  parts.push(text.slice(copied, start));
  parts.push(<a key={start} href={target} rel="noopener noreferrer nofollow ugc" referrerPolicy="no-referrer">{target}</a>);
  copied = start + target.length;
 }
 parts.push(text.slice(copied));
 return <>{parts}</>;
}
