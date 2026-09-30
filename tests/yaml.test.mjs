import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml } from '../src/yaml.mjs';
import { splitFrontMatter, sections, normKey, meaningful } from '../src/markdown.mjs';

test('parses nested maps, scalars and quoted strings', () => {
  const d = parseYaml('name: Heritage\ncolors:\n  primary: "#1A1C1E"\n  note: \'a: b\'\nsize: 12\nflag: true\n');
  assert.equal(d.name, 'Heritage');
  assert.equal(d.colors.primary, '#1A1C1E');
  assert.equal(d.colors.note, 'a: b');
  assert.equal(d.size, 12);
  assert.equal(d.flag, true);
});

test('parses inline and block lists, and strips comments', () => {
  const d = parseYaml('a: [x, "y, z", 3]   # trailing\nb:\n  - one\n  - two\nc: []\n');
  assert.deepEqual(d.a, ['x', 'y, z', 3]);
  assert.deepEqual(d.b, ['one', 'two']);
  assert.deepEqual(d.c, []);
});

test('a hash inside a quoted string is not a comment', () => {
  assert.equal(parseYaml('c: "#ff0000"').c, '#ff0000');
});

test('errors carry a line number', () => {
  assert.throws(() => parseYaml('a: 1\nb: [1, 2\n'), /line 2/);
  assert.throws(() => parseYaml('a: 1\n\tb: 2\n'), /tabs/);
  assert.throws(() => parseYaml('a: 1\na: 2\n'), /duplicate key/);
  assert.throws(() => parseYaml('a: {x: 1}\n'), /flow maps/);
});

test('front matter splits from the body and reports unclosed fences', () => {
  const fm = splitFrontMatter('---\nname: X\n---\n\n## One\nbody\n');
  assert.equal(fm.data.name, 'X');
  assert.equal(fm.bodyStartLine, 4);
  const bad = splitFrontMatter('---\nname: X\n\n## One\n');
  assert.ok(bad.error);
  assert.equal(splitFrontMatter('## One\n').data, null);
});

test('sections ignore headings inside code fences and normalise titles', () => {
  const s = sections('## A\ntext\n```\n## not a heading\n```\n## Do\'s & Don\'ts\nx\n');
  assert.deepEqual(s.map((x) => x.key), ['a', 'dos and donts']);
  assert.equal(normKey('Elevation & Depth'), 'elevation and depth');
});

test('meaningful drops comments and code fences', () => {
  assert.equal(meaningful('<!-- note -->\n\n'), '');
  assert.equal(meaningful('```\ncode\n```\n'), '');
  assert.equal(meaningful('real words'), 'real words');
});
