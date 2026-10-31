import assert from 'node:assert/strict';

function withoutTemplates(html) {
  let text = '', depth = 0, offset = 0;
  for (const token of html.matchAll(/<\/?template\b[^>]*>/gi)) {
    if (!token[0].startsWith('</')) {
      if (depth === 0) text += html.slice(offset, token.index);
      depth++;
    } else if (depth > 0 && --depth === 0) offset = token.index + token[0].length;
  }
  return depth === 0 ? text + html.slice(offset) : text;
}

function headingText(html) {
  const source = withoutTemplates(html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ''));
  const match = source.match(/<h1\b([^>]*)>([\s\S]*?)<\/h1\s*>/i);
  if (!match || /(?:^|\s)hidden(?:\s|=|$)|(?:^|\s)aria-hidden\s*=\s*(?:"true"|'true'|true)(?=\s|$)/i.test(match[1])) return null;
  const heading = match[2];
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return heading.replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (raw, value) => {
    if (!value.startsWith('#')) return entities[value.toLowerCase()] ?? raw;
    const point = value.toLowerCase().startsWith('#x') ? parseInt(value.slice(2), 16) : Number(value.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : raw;
  }).replace(/\s+/g, ' ').trim();
}

// Validate the public source, not merely any successful page on the same host.
// Source-HTML identity only, not a browser/CSS visibility audit. Templates and
// explicitly hidden h1s cannot supply identity. No contributor code is executed.
export async function checkCanonicalReportPage(report, fetchPage = globalThis.fetch) {
  assert.match(report.id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i, 'Expected a public report UUID');
  const expected = `https://tokenoverflow.app/reports/${report.id}`;
  const page = await fetchPage(expected, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(page.status, 200, 'Canonical report must return 200 without redirect');
  assert.notEqual(page.redirected, true, 'Canonical report must not follow a redirect');
  assert.equal(page.url, expected, 'Canonical source must stay at the exact report URL');
  const title = report.title.replace(/\s+/g, ' ').trim();
  assert.ok(title, 'Report title is required for page identity');
  assert.equal(headingText(await page.text()), title, 'Canonical page h1 must identify the retrieved report');
  return { status: page.status, url: page.url, identity_verified: true };
}
