// Front matter and section extraction for the three world files.
import { parseYaml } from './yaml.mjs';

export function splitFrontMatter(text) {
  const t = text.replace(/^[﻿]/, '');
  const lines = t.split(/\r?\n/);
  if (lines[0] !== '---') return { data: null, raw: null, body: t, bodyStartLine: 1, error: null };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { data: null, raw: null, body: t, bodyStartLine: 1, error: { line: 1, message: 'front matter opens with --- but never closes' } };
  }
  const raw = lines.slice(1, end).join('\n');
  let data = null;
  let error = null;
  try {
    data = parseYaml(raw, 1);
  } catch (e) {
    error = { line: e.line || 1, message: e.message };
  }
  return { data, raw, body: lines.slice(end + 1).join('\n'), bodyStartLine: end + 2, error };
}

export function normKey(s) {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[`*_'’"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Level-2 sections outside fenced code blocks. Returns [{title, key, line, body}].
export function sections(body, startLine = 1) {
  const out = [];
  let fence = null;
  let cur = null;
  body.split(/\r?\n/).forEach((l, i) => {
    const line = startLine + i;
    const f = l.match(/^\s*(```+|~~~+)/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
    }
    const h = !fence && l.match(/^##\s+(.+?)\s*#*\s*$/);
    if (h) {
      cur = { title: h[1].trim(), key: normKey(h[1]), line, body: '' };
      out.push(cur);
    } else if (cur) {
      cur.body += l + '\n';
    }
  });
  return out;
}

// Body text with HTML comments and fenced code removed, for "is this section empty" tests.
export function meaningful(body) {
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*(```+|~~~+)[\s\S]*?^\s*\1/gm, '')
    .trim();
}
