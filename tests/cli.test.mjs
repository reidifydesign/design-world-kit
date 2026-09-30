import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run } from '../src/cli.mjs';
import { buildContext, claudeHookJson } from '../src/load.mjs';
import { installHook, hookSnippet } from '../src/hook.mjs';
import { findRoot } from '../src/world.mjs';
import { tmp, write, exampleCopy, capture, EXAMPLE, REPO } from './helpers.mjs';

test('init writes three files, keeps existing ones, replaces with --force', () => {
  const d = tmp();
  const c = capture();
  assert.equal(run(['init', d], { cwd: d, ...c }), 0);
  for (const f of ['PRODUCT.md', 'DESIGN.md', 'VOICE.md']) assert.ok(fs.existsSync(path.join(d, f)));
  fs.writeFileSync(path.join(d, 'VOICE.md'), 'mine');
  const c2 = capture();
  run(['init', d], { cwd: d, ...c2 });
  assert.equal(fs.readFileSync(path.join(d, 'VOICE.md'), 'utf8'), 'mine');
  assert.match(c2.text(), /kept/);
  run(['init', d, '--force', '--only', 'voice'], { cwd: d, ...capture() });
  assert.notEqual(fs.readFileSync(path.join(d, 'VOICE.md'), 'utf8'), 'mine');
  assert.equal(run(['init', d, '--only', 'nope'], { cwd: d, ...capture() }), 2);
});

test('check prints a status line and exit code; --json is parseable', () => {
  const c = capture();
  assert.equal(run(['check', '.'], { cwd: EXAMPLE, ...c }), 0);
  assert.match(c.text(), /Status: DRAFT/);
  const j = capture();
  run(['check', '.', '--json'], { cwd: EXAMPLE, ...j });
  const parsed = JSON.parse(j.text());
  assert.equal(parsed.status, 'DRAFT');
  assert.equal(parsed.counts.open, 2);
  assert.equal(run(['check', '.', '--strict'], { cwd: EXAMPLE, ...capture() }), 1);
  assert.equal(run(['check', tmp()], { cwd: EXAMPLE, ...capture() }), 1);
});

test('copy exits 1 on rule violations and 0 on clean copy', () => {
  const bad = capture();
  assert.equal(run(['copy', 'drafts/homepage.md'], { cwd: EXAMPLE, ...bad }), 1);
  assert.match(bad.text(), /banned word "leverage"/);
  const d = exampleCopy();
  write(d, 'ok.md', 'We set your card in metal type.\n');
  assert.equal(run(['copy', 'ok.md'], { cwd: d, ...capture() }), 0);
  assert.equal(run(['copy'], { cwd: d, ...capture() }), 2);
});

test('load names missing files, states the rules and embeds the files', () => {
  const ctx = buildContext(EXAMPLE);
  assert.match(ctx, /status DRAFT, 2 open items/);
  assert.match(ctx, /authoritative over your own instincts/);
  assert.match(ctx, /===== DESIGN\.md =====/);
  assert.doesNotMatch(ctx, /Fictional example/); // comments are stripped
  const d = exampleCopy();
  fs.unlinkSync(path.join(d, 'VOICE.md'));
  assert.match(buildContext(d), /===== VOICE\.md: MISSING =====/);
});

test('load with no world says so, or stays silent on request', () => {
  const d = tmp();
  assert.match(buildContext(d), /none found/);
  assert.equal(buildContext(d, { ifMissing: 'silent' }), '');
});

test('load caps large files', () => {
  const d = exampleCopy();
  fs.appendFileSync(path.join(d, 'PRODUCT.md'), '\n' + 'x'.repeat(20000));
  const ctx = buildContext(d);
  assert.match(ctx, /PRODUCT\.md truncated/);
  assert.ok(ctx.length < 10000, `context was ${ctx.length} characters`);
  assert.match(ctx, /===== VOICE\.md =====/);
  for (const f of ['DESIGN.md', 'VOICE.md']) fs.appendFileSync(path.join(d, f), '\n' + 'y'.repeat(20000));
  const all = buildContext(d);
  assert.ok(all.length < 10000, `context was ${all.length} characters`);
  assert.match(all, /DESIGN\.md truncated/);
});

test('the claude format is a SessionStart JSON envelope', () => {
  const j = JSON.parse(claudeHookJson('hello'));
  assert.equal(j.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(j.hookSpecificOutput.additionalContext, 'hello');
  assert.equal(claudeHookJson(''), '');
});

test('hook install merges, is idempotent and refuses broken JSON', () => {
  const d = tmp();
  write(d, '.claude/settings.json', JSON.stringify({ permissions: { allow: ['Read'] }, hooks: { SessionStart: [{ matcher: 'x', hooks: [{ type: 'command', command: 'echo hi' }] }] } }));
  assert.equal(installHook(d).action, 'installed');
  const s = JSON.parse(fs.readFileSync(path.join(d, '.claude', 'settings.json'), 'utf8'));
  assert.deepEqual(s.permissions.allow, ['Read']);
  assert.equal(s.hooks.SessionStart.length, 2);
  assert.equal(installHook(d).action, 'already-installed');
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, '.claude', 'settings.json'), 'utf8')).hooks.SessionStart.length, 2);
  const bad = tmp();
  write(bad, '.claude/settings.json', '{ nope');
  assert.equal(installHook(bad).action, 'refused');
  assert.equal(fs.readFileSync(path.join(bad, '.claude', 'settings.json'), 'utf8'), '{ nope');
  assert.equal(hookSnippet('x').hooks.SessionStart[0].hooks[0].command, 'x');
});

test('findRoot walks up to the folder that holds the world files', () => {
  const d = exampleCopy();
  const deep = path.join(d, 'a', 'b');
  fs.mkdirSync(deep, { recursive: true });
  assert.equal(findRoot(deep), d);
});

test('the binary runs end to end, and the example hook script emits valid JSON', () => {
  const r = spawnSync(process.execPath, [path.join(REPO, 'bin', 'design-world-kit.mjs'), 'check', '.'], { cwd: EXAMPLE, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Status: DRAFT/);
  const h = spawnSync(process.execPath, [path.join(REPO, 'hooks', 'session-start.mjs')], { cwd: EXAMPLE, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: EXAMPLE } });
  assert.equal(h.status, 0);
  assert.match(JSON.parse(h.stdout).hookSpecificOutput.additionalContext, /DESIGN WORLD/);
  const bad = spawnSync(process.execPath, [path.join(REPO, 'bin', 'design-world-kit.mjs'), 'nonsense'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});
