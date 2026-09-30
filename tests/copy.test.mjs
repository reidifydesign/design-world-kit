import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { checkCopy, collectFiles, textViolations } from '../src/copy.mjs';
import { parseVoiceRules } from '../src/voice.mjs';
import { tmp, write, EXAMPLE } from './helpers.mjs';

const rules = parseVoiceRules(fs.readFileSync(path.join(EXAMPLE, 'VOICE.md'), 'utf8'));
const product = fs.readFileSync(path.join(EXAMPLE, 'PRODUCT.md'), 'utf8');

function run(text, ext = '.md', overrides = {}) {
  const d = tmp();
  const f = write(d, 'copy' + ext, text);
  return checkCopy([f], { rules: { ...rules, ...overrides }, productText: product, cwd: d });
}

test('voice rules parse from the example front matter', () => {
  assert.ok(rules.bannedWords.includes('seamless'));
  assert.equal(rules.emDash, true);
  assert.equal(rules.exclamationMax, 0);
  assert.equal(rules.maxSentenceWords, 28);
});

test('banned words match whole words only, case-insensitively', () => {
  assert.deepEqual(textViolations('A Seamless job.', rules), ['banned word "seamless"']);
  assert.deepEqual(textViolations('Unlocking is fine, unlock is not: no.', rules), ['banned word "unlock"']);
  assert.deepEqual(textViolations('seamlessly', rules), []);
});

test('banned phrases match with curly apostrophes, punctuation rules fire', () => {
  assert.equal(textViolations('In today’s fast-paced world, hello', rules).length > 0, true);
  assert.ok(textViolations('a ' + String.fromCharCode(0x2014) + ' b', rules).includes('em dash'));
  assert.ok(textViolations('it’s', rules).includes('curly quote or apostrophe'));
  assert.deepEqual(textViolations("it's fine", rules), []);
});

test('the bad homepage draft produces errors and unsourced figures', () => {
  const f = checkCopy([path.join(EXAMPLE, 'drafts', 'homepage.md')], { rules, productText: product, cwd: EXAMPLE });
  const figs = f.filter((x) => x.code === 'FIGURE').map((x) => x.message.match(/"([^"]+)"/)[1]);
  assert.deepEqual(figs.sort(), ['$2', '24 hours', '300+', '98%']);
  assert.ok(f.some((x) => x.severity === 'error' && /cutting-edge/.test(x.message)));
  assert.ok(f.some((x) => /exclamation/.test(x.message)));
});

test('figures that PRODUCT.md contains pass, whatever the spacing', () => {
  assert.deepEqual(run('Printing in the same building for 12 years.\nThe minimum run is 50 cards.\n'), []);
  assert.equal(run('Open for 12  years now.\n').length, 0);
  assert.equal(run('Open for 13 years now.\n').length, 1);
});

test('with no PRODUCT.md every figure is unsourced', () => {
  const d = tmp();
  const f = write(d, 'c.md', 'We grew 40%.\n');
  const r = checkCopy([f], { rules, productText: null, cwd: d });
  assert.match(r[0].message, /PRODUCT\.md was not found/);
});

test('fenced code is skipped in markdown, tags and scripts are skipped in html', () => {
  assert.deepEqual(run('```\nleverage 99%\n```\n'), []);
  assert.deepEqual(run('<p class="leverage">Hello</p><script>var leverage = 99%;</script>', '.html'), []);
  assert.equal(run('<p>We leverage it</p>', '.html').length, 1);
});

test('sentence length is a warning with a line number', () => {
  const long = 'word '.repeat(40).trim() + '.';
  const f = run(`# Title\n\nShort one.\n\n${long}\n`);
  assert.equal(f.length, 1);
  assert.equal(f[0].code, 'LENGTH');
  assert.equal(f[0].severity, 'warn');
  assert.equal(f[0].line, 5);
});

test('exclamation limit counts across the file', () => {
  const f = run('One! Two!\nThree!\n', '.md', { exclamationMax: 2, bannedWords: [] });
  assert.equal(f.length, 1);
  assert.match(f[0].message, /3 exclamation marks/);
  assert.equal(run('One! Two!\n', '.md', { exclamationMax: 2 }).length, 0);
});

test('collectFiles walks directories, skips world files, node_modules and env files', () => {
  const d = tmp();
  write(d, 'a.md', 'x');
  write(d, 'PRODUCT.md', 'x');
  write(d, 'node_modules/b.md', 'x');
  write(d, '.env', 'SECRET=1');
  write(d, 'sub/c.html', 'x');
  write(d, 'sub/d.png', 'x');
  const names = collectFiles([d], d).map((p) => path.relative(d, p).split(path.sep).join('/')).sort();
  assert.deepEqual(names, ['a.md', 'sub/c.html']);
  assert.deepEqual(collectFiles([path.join(d, '.env')], d), []);
});
