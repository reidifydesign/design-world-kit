// Check project copy against VOICE.md rules, and flag figures PRODUCT.md does not contain.
import fs from 'node:fs';
import path from 'node:path';
import { FILES } from './world.mjs';

const EXT = new Set(['.md', '.mdx', '.txt', '.html', '.htm', '.tsx', '.jsx', '.vue', '.svelte', '.astro']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache']);
const MAX_BYTES = 1024 * 1024;
const EM_DASH = String.fromCharCode(0x2014);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const straight = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

// Figures an agent tends to invent: percentages, money, multipliers, "N+", counts of years or clients.
const FIGURE_RES = [
  /\d+(?:[.,]\d+)?\s?%/g,
  /[$€£₹]\s?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM]\b)?/g,
  /\b(?:USD|EUR|GBP|INR)\s?\d[\d,.]*/g,
  /\b\d+(?:\.\d+)?x\b/gi,
  /\b\d[\d,]*\+/g,
  /\b\d[\d,]*\s+(?:years?|clients?|customers?|projects?|users?|reviews?|countries|awards?|members?|stores?|orders?|hours?|days?|weeks?|months?)\b/gi,
];
const squash = (s) => straight(s).toLowerCase().replace(/\s+/g, '');

// Violations of the hard rules in one snippet. Returns messages; used by check for "After" examples.
export function textViolations(text, rules) {
  const out = [];
  const t = straight(text).toLowerCase();
  for (const w of rules.bannedWords) {
    if (new RegExp(`(?<![a-z0-9])${esc(straight(w).toLowerCase())}(?![a-z0-9])`).test(t)) out.push(`banned word "${w}"`);
  }
  for (const p of rules.bannedPhrases) {
    if (t.includes(straight(p).toLowerCase())) out.push(`banned phrase "${p}"`);
  }
  if (rules.emDash && text.includes(EM_DASH)) out.push('em dash');
  if (rules.curlyQuotes && /[‘’“”]/.test(text)) out.push('curly quote or apostrophe');
  return out;
}

function prepare(file, raw) {
  const ext = path.extname(file).toLowerCase();
  let text = raw.replace(/^[﻿]/, '');
  if (ext === '.html' || ext === '.htm') {
    const blank = (m) => m.replace(/[^\n]/g, ' ');
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, blank)
      .replace(/<style[\s\S]*?<\/style>/gi, blank)
      .replace(/<!--[\s\S]*?-->/g, blank)
      .replace(/<[^>]+>/g, blank);
  }
  return text;
}

export function collectFiles(targets, cwd) {
  const out = [];
  const walk = (p, explicit) => {
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      return;
    }
    const base = path.basename(p);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(base)) return;
      for (const e of fs.readdirSync(p)) walk(path.join(p, e), false);
    } else if (st.isFile()) {
      if (/^\.env/i.test(base)) return;
      if (FILES.includes(base) && !explicit) return;
      if (!explicit && !EXT.has(path.extname(base).toLowerCase())) return;
      if (st.size > MAX_BYTES) return;
      out.push(p);
    }
  };
  for (const t of targets) walk(path.resolve(cwd, t), true);
  return [...new Set(out)];
}

function fencedMask(lines) {
  // true for lines inside fenced code blocks in markdown-like files
  const mask = [];
  let fence = null;
  for (const l of lines) {
    const m = l.match(/^\s*(```+|~~~+)/);
    if (m) {
      if (!fence) {
        fence = m[1][0];
        mask.push(true);
        continue;
      }
      if (m[1][0] === fence) {
        fence = null;
        mask.push(true);
        continue;
      }
    }
    mask.push(Boolean(fence));
  }
  return mask;
}

export function checkCopy(files, { rules, productText, cwd }) {
  const findings = [];
  const productSquashed = productText ? squash(productText) : null;
  for (const file of files) {
    const rel = (path.relative(cwd, file) || path.basename(file)).split(path.sep).join('/');
    const add = (severity, code, line, message) => findings.push({ file: rel, severity, code, line, message });
    const text = prepare(file, fs.readFileSync(file, 'utf8'));
    const lines = text.split(/\r?\n/);
    const isMd = ['.md', '.mdx', '.txt'].includes(path.extname(file).toLowerCase());
    const skip = isMd ? fencedMask(lines) : lines.map(() => false);
    let bangs = 0;
    let firstExcess = 0;
    lines.forEach((l, i) => {
      if (skip[i]) return;
      const line = i + 1;
      for (const v of textViolations(l, rules)) add('error', 'VOICE', line, v);
      const b = (l.match(/!/g) || []).length;
      if (b && rules.exclamationMax !== null) {
        bangs += b;
        if (!firstExcess && bangs > rules.exclamationMax) firstExcess = line;
      }
      const seen = new Set();
      for (const re of FIGURE_RES) {
        for (const m of l.matchAll(re)) {
          const fig = m[0].trim();
          if (seen.has(fig)) continue;
          seen.add(fig);
          if (productSquashed === null) add('warn', 'FIGURE', line, `"${fig}" has no source: PRODUCT.md was not found`);
          else if (!productSquashed.includes(squash(fig))) add('warn', 'FIGURE', line, `"${fig}" is not in PRODUCT.md; add it under Evidence on Hand or remove it`);
        }
      }
    });
    if (firstExcess) add('error', 'VOICE', firstExcess, `${bangs} exclamation ${bangs === 1 ? 'mark' : 'marks'}; the limit is ${rules.exclamationMax} per file`);
    if (rules.maxSentenceWords) {
      let block = [];
      let start = 0;
      const flush = () => {
        if (block.length) {
          const para = block.join(' ');
          for (const s of para.split(/(?<=[.!?])\s+/)) {
            const n = s.split(/\s+/).filter(Boolean).length;
            if (n > rules.maxSentenceWords) add('warn', 'LENGTH', start, `a sentence runs ${n} words (limit ${rules.maxSentenceWords}): "${s.slice(0, 50).trim()}..."`);
          }
        }
        block = [];
      };
      lines.forEach((l, i) => {
        if (skip[i] || /^\s*(#|\||<)/.test(l) || l.trim() === '') return flush();
        if (!block.length) start = i + 1;
        block.push(l.trim());
      });
      flush();
    }
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
