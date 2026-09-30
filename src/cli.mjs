import path from 'node:path';
import { findRoot, readWorld, FILES } from './world.mjs';
import { checkWorld, exitCode } from './check.mjs';
import { checkCopy, collectFiles } from './copy.mjs';
import { parseVoiceRules } from './voice.mjs';
import { buildContext, claudeHookJson } from './load.mjs';
import { initWorld } from './init.mjs';
import { hookSnippet, installHook, DEFAULT_COMMAND } from './hook.mjs';

const HELP = `design-world-kit: PRODUCT.md, DESIGN.md and VOICE.md for design agents

Usage:
  design-world-kit init [dir] [--force] [--only product,design,voice]
  design-world-kit check [dir] [--strict] [--json]
  design-world-kit copy <file|dir>... [--root dir] [--strict] [--json]
  design-world-kit load [dir] [--format text|claude] [--if-missing notice|silent]
  design-world-kit hook [print|install] [dir] [--command "<cmd>"]

Commands:
  init    write the three templates into a project (never overwrites without --force)
  check   validate the three files: sections, tokens, references, order, open items
  copy    check copy against VOICE.md, and flag figures PRODUCT.md does not contain
  load    print what a design agent should read first (used by the session-start hook)
  hook    print the Claude Code SessionStart settings, or merge them into .claude/settings.json

Exit codes: 0 fine, 1 problems found, 2 bad usage.
`;

function parseArgs(argv) {
  const pos = [];
  const opt = {};
  const valued = new Set(['root', 'format', 'if-missing', 'only', 'command']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (valued.has(k)) opt[k] = v !== undefined ? v : argv[++i];
      else opt[k] = v === undefined ? true : v;
    } else pos.push(a);
  }
  return { pos, opt };
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const label = { error: 'FAIL', warn: 'WARN', open: 'OPEN' };

function showRoot(root, cwd) {
  return path.resolve(root) === path.resolve(cwd) ? '.' : root;
}

function printCheck(r, cwd, out) {
  out(`Design world at ${showRoot(r.root, cwd)}`);
  out('');
  for (const name of FILES) {
    const fs_ = r.findings.filter((f) => f.file === name);
    const errs = fs_.filter((f) => f.severity === 'error').length;
    const warns = fs_.filter((f) => f.severity === 'warn').length;
    const opens = fs_.filter((f) => f.severity === 'open').length;
    const level = errs ? 'FAIL' : warns ? 'WARN' : 'OK';
    const tail = [errs && plural(errs, 'error'), warns && plural(warns, 'warning'), opens && `${opens} open`].filter(Boolean).join(', ') || 'clean';
    out(`${name.padEnd(11)} ${level.padEnd(5)} ${tail}`);
    for (const f of fs_.sort((a, b) => a.line - b.line)) {
      out(`  ${label[f.severity].padEnd(5)} ${f.line ? String(f.line).padStart(3) : '  -'}  ${f.message}`);
    }
  }
  out('');
  out(`Status: ${r.status}  (${plural(r.counts.error, 'error')}, ${plural(r.counts.warn, 'warning')}, ${r.counts.open} open)`);
}

export function run(argv, { cwd = process.cwd(), out = (s) => process.stdout.write(s + '\n'), err = (s) => process.stderr.write(s + '\n') } = {}) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    out(HELP.trimEnd());
    return cmd ? 0 : 2;
  }
  const { pos, opt } = parseArgs(rest);
  const dirArg = pos[0] ? path.resolve(cwd, pos[0]) : cwd;

  if (cmd === 'init') {
    const only = opt.only ? String(opt.only).split(',').map((s) => s.trim().toLowerCase()) : null;
    if (only && only.some((o) => !['product', 'design', 'voice'].includes(o))) {
      err('--only takes product, design, voice');
      return 2;
    }
    const target = pos[0] ? dirArg : findRoot(cwd);
    const res = initWorld(target, { force: Boolean(opt.force), only });
    for (const r of res) out(`${r.action.padEnd(8)} ${path.join(showRoot(target, cwd), r.name)}`);
    if (res.some((r) => r.action === 'kept')) out('Existing files were kept. Use --force to replace them.');
    out('Next: fill each [[CONFIRM: ...]], then run "design-world-kit check".');
    return 0;
  }

  if (cmd === 'check') {
    const root = pos[0] ? dirArg : opt.root ? path.resolve(cwd, opt.root) : findRoot(cwd);
    const r = checkWorld(root);
    if (opt.json) {
      const { world, ...rest2 } = r;
      out(JSON.stringify(rest2, null, 2));
    } else printCheck(r, cwd, out);
    return exitCode(r, Boolean(opt.strict));
  }

  if (cmd === 'copy') {
    if (!pos.length) {
      err('copy needs at least one file or directory');
      return 2;
    }
    const root = opt.root ? path.resolve(cwd, opt.root) : findRoot(cwd);
    const world = readWorld(root);
    const rules = world.files['VOICE.md'].exists ? parseVoiceRules(world.files['VOICE.md'].text) : parseVoiceRules('');
    const files = collectFiles(pos, cwd);
    if (!files.length) {
      err('no readable copy files found (md, mdx, txt, html, tsx, jsx, vue, svelte, astro)');
      return 2;
    }
    const findings = checkCopy(files, { rules, productText: world.files['PRODUCT.md'].exists ? world.files['PRODUCT.md'].text : null, cwd });
    const errors = findings.filter((f) => f.severity === 'error').length;
    const warns = findings.filter((f) => f.severity === 'warn').length;
    if (opt.json) out(JSON.stringify({ root, files: files.length, errors, warnings: warns, findings }, null, 2));
    else {
      const notes = [];
      if (!world.files['VOICE.md'].exists) notes.push('VOICE.md not found: only figures were checked');
      if (!world.files['PRODUCT.md'].exists) notes.push('PRODUCT.md not found: every figure is unsourced');
      out(`Checking ${plural(files.length, 'file')} against VOICE.md and PRODUCT.md at ${showRoot(root, cwd)}`);
      for (const n of notes) out(`note: ${n}`);
      out('');
      for (const f of findings) out(`${label[f.severity].padEnd(5)} ${f.file}:${f.line}  ${f.message}`);
      if (!findings.length) out('OK    nothing to report');
      out('');
      out(`${plural(errors, 'error')}, ${plural(warns, 'warning')} in ${plural(files.length, 'file')}`);
    }
    return errors || (opt.strict && warns) ? 1 : 0;
  }

  if (cmd === 'load') {
    const root = pos[0] ? dirArg : process.env.CLAUDE_PROJECT_DIR ? path.resolve(process.env.CLAUDE_PROJECT_DIR) : findRoot(cwd);
    const ctx = buildContext(root, { ifMissing: opt['if-missing'] === 'silent' ? 'silent' : 'notice' });
    const fmt = opt.format || 'text';
    if (fmt !== 'text' && fmt !== 'claude') {
      err('--format takes text or claude');
      return 2;
    }
    const text = fmt === 'claude' ? claudeHookJson(ctx) : ctx;
    if (text) out(text);
    return 0;
  }

  if (cmd === 'hook') {
    const action = pos[0] === 'install' || pos[0] === 'print' ? pos[0] : 'print';
    const dir = pos[0] === action ? pos[1] : pos[0];
    const root = dir ? path.resolve(cwd, dir) : findRoot(cwd);
    const command = opt.command && typeof opt.command === 'string' ? opt.command : DEFAULT_COMMAND;
    if (action === 'print') {
      out(JSON.stringify(hookSnippet(command), null, 2));
      out('');
      out('Put this in .claude/settings.json (or run "design-world-kit hook install"). Other agents: point their session-start');
      out('step at "design-world-kit load", or paste its output into AGENTS.md or CLAUDE.md. See docs/hooks.md.');
      return 0;
    }
    const res = installHook(root, command);
    if (res.action === 'refused') {
      err(`refused: ${res.reason} (${res.file})`);
      return 1;
    }
    out(`${res.action}: ${res.file}`);
    return 0;
  }

  err(`unknown command "${cmd}"\n`);
  err(HELP.trimEnd());
  return 2;
}
