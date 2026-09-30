import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkWorld, exitCode } from '../src/check.mjs';
import { initWorld } from '../src/init.mjs';
import { tmp, write, exampleCopy, codes, EXAMPLE } from './helpers.mjs';

test('empty folder is EMPTY and every file is reported missing', () => {
  const r = checkWorld(tmp());
  assert.equal(r.status, 'EMPTY');
  assert.equal(r.missing.length, 3);
  assert.equal(exitCode(r), 1);
});

test('a fresh init is structurally valid but DRAFT, with open items counted', () => {
  const d = tmp();
  initWorld(d);
  const r = checkWorld(d);
  assert.equal(r.counts.error, 0, JSON.stringify(r.findings.filter((f) => f.severity === 'error')));
  assert.equal(r.status, 'DRAFT');
  assert.ok(r.counts.open >= 15);
  assert.equal(exitCode(r), 0);
  assert.equal(exitCode(r, true), 1);
});

test('the shipped example is DRAFT with exactly its two open items and no errors', () => {
  const r = checkWorld(EXAMPLE);
  assert.equal(r.counts.error, 0);
  assert.equal(r.counts.warn, 0, JSON.stringify(r.findings));
  assert.equal(r.counts.open, 2);
  assert.equal(r.status, 'DRAFT');
});

test('filling every open item makes the example READY', () => {
  const d = exampleCopy();
  const p = path.join(d, 'PRODUCT.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\[\[CONFIRM:[^\]]*\]\]/g, 'Settled.'));
  assert.equal(checkWorld(d).status, 'READY');
});

test('missing one file is INCOMPLETE, not INVALID', () => {
  const d = exampleCopy();
  fs.unlinkSync(path.join(d, 'VOICE.md'));
  const r = checkWorld(d);
  assert.equal(r.status, 'INCOMPLETE');
  assert.deepEqual(r.missing, ['VOICE.md']);
});

test('PRODUCT.md: missing and empty required sections are errors, aliases are accepted', () => {
  const d = tmp();
  write(d, 'PRODUCT.md', '# P\n\n## Audience\nfolks\n\n## Purpose\nx\n\n## Facts\ny\n\n## Limits\n\n');
  const r = checkWorld(d);
  assert.ok(!codes(r, 'PRODUCT.md').includes('MISSING-SECTION'));
  assert.ok(codes(r, 'PRODUCT.md').includes('EMPTY-SECTION'));
  write(d, 'PRODUCT.md', '# P\n\n## Audience\nfolks\n');
  assert.equal(codes(checkWorld(d), 'PRODUCT.md').filter((c) => c === 'MISSING-SECTION').length, 3);
});

test('unfilled placeholders are errors; guidance comments are ignored', () => {
  const d = exampleCopy();
  const p = path.join(d, 'PRODUCT.md');
  fs.appendFileSync(p, '\n<!-- TODO in a comment is fine -->\n\nTODO write this\nPrice {{price}}\n');
  const r = checkWorld(d);
  const un = r.findings.filter((f) => f.code === 'UNFILLED');
  assert.equal(un.length, 2);
  assert.equal(r.status, 'INVALID');
});

test('DESIGN.md: broken reference, bad colour and circular reference', () => {
  const d = exampleCopy();
  const p = path.join(d, 'DESIGN.md');
  let t = fs.readFileSync(p, 'utf8');
  t = t.replace('backgroundColor: "{colors.accent}"', 'backgroundColor: "{colors.nope}"');
  t = t.replace('primary: "#1f2a30"', 'primary: "#zzz"');
  t = t.replace('on-accent: "#f3efe4"', 'on-accent: "{colors.loop}"\n  loop: "{colors.on-accent}"');
  fs.writeFileSync(p, t);
  const r = checkWorld(d);
  const msgs = r.findings.filter((f) => f.file === 'DESIGN.md').map((f) => f.message).join('\n');
  assert.match(msgs, /unknown token \{colors\.nope\}/);
  assert.match(msgs, /not a colour value/);
  assert.match(msgs, /circular reference/);
  assert.equal(r.status, 'INVALID');
});

test('DESIGN.md: sections out of order and duplicates are errors', () => {
  const d = exampleCopy();
  const p = path.join(d, 'DESIGN.md');
  const t = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, t.replace('## Typography', '## Shapes').replace('## Colors', '## Colors\n\nx\n\n## Colors'));
  const c = codes(checkWorld(d), 'DESIGN.md');
  assert.ok(c.includes('DUP-SECTION'));
  assert.ok(c.includes('SECTION-ORDER') || c.includes('DUP-SECTION'));
  const d2 = exampleCopy();
  const p2 = path.join(d2, 'DESIGN.md');
  const t2 = fs.readFileSync(p2, 'utf8').replace('## Components', '## Overview2\n\n## Components').replace('## Colors', '## Components');
  fs.writeFileSync(p2, t2);
  assert.ok(codes(checkWorld(d2), 'DESIGN.md').includes('SECTION-ORDER'));
});

test('DESIGN.md: a hex colour in the prose that no token holds is flagged', () => {
  const d = exampleCopy();
  const p = path.join(d, 'DESIGN.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('**Primary, called ink (#1f2a30):**', '**Primary, called ink (#111111):**'));
  const f = checkWorld(d).findings.find((x) => x.code === 'PROSE-COLOR-DRIFT');
  assert.ok(f && /#111111/.test(f.message));
});

test('DESIGN.md: front matter is optional but warned about; a bad one is an error', () => {
  const d = exampleCopy();
  const p = path.join(d, 'DESIGN.md');
  const body = fs.readFileSync(p, 'utf8').split('\n---\n')[1];
  fs.writeFileSync(p, body);
  assert.ok(codes(checkWorld(d), 'DESIGN.md').includes('NO-TOKENS'));
  fs.writeFileSync(p, '---\nname: X\ncolors: [a\n---\n' + body);
  assert.ok(codes(checkWorld(d), 'DESIGN.md').includes('FRONT-MATTER'));
});

test('DESIGN.md: omitted sections silence the recommendation', () => {
  const d = exampleCopy();
  const p = path.join(d, 'DESIGN.md');
  let t = fs.readFileSync(p, 'utf8');
  t = t.replace(/## Do's and Don'ts[\s\S]*$/, '');
  fs.writeFileSync(p, t);
  assert.ok(codes(checkWorld(d), 'DESIGN.md').includes('NO-SECTION'));
  fs.writeFileSync(p, t.replace('version: alpha', 'version: alpha\nomitted: ["Do\'s and Don\'ts"]'));
  assert.ok(!codes(checkWorld(d), 'DESIGN.md').includes('NO-SECTION'));
});

test('VOICE.md: nothing to enforce is a warning; bad types are errors', () => {
  const d = exampleCopy();
  const p = path.join(d, 'VOICE.md');
  const body = fs.readFileSync(p, 'utf8').split('\n---\n')[1];
  fs.writeFileSync(p, '---\nname: V\n---\n' + body);
  assert.ok(codes(checkWorld(d), 'VOICE.md').includes('NOTHING-TO-ENFORCE'));
  fs.writeFileSync(p, '---\nname: V\nbanned_words: nope\npunctuation:\n  em_dash: maybe\n---\n' + body);
  const c = codes(checkWorld(d), 'VOICE.md');
  assert.ok(c.includes('BAD-LIST'));
  assert.ok(c.includes('BAD-VALUE'));
});

test('VOICE.md: an "After" example that breaks the file\'s own rules is flagged', () => {
  const d = exampleCopy();
  const p = path.join(d, 'VOICE.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('- After: We set your card', '- After: We leverage metal type to set your card'));
  const f = checkWorld(d).findings.find((x) => x.code === 'EXAMPLE-BREAKS-RULE');
  assert.ok(f && /leverage/.test(f.message));
});

test('CRLF files give the same result as LF files', () => {
  const lf = checkWorld(EXAMPLE);
  const d = exampleCopy();
  for (const f of ['PRODUCT.md', 'DESIGN.md', 'VOICE.md']) {
    const p = path.join(d, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
  }
  const crlf = checkWorld(d);
  assert.equal(crlf.status, lf.status);
  assert.deepEqual(crlf.counts, lf.counts);
});
