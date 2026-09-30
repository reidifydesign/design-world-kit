// A small YAML subset parser, enough for DESIGN.md / VOICE.md front matter.
// Supports: nested maps (spaces only), scalars, quoted strings, inline lists [a, b],
// block lists (- item), comments. Anything else throws with a line number.
// It is deliberately not a full YAML parser: no anchors, no multi-line scalars, no flow maps.

export class YamlError extends Error {
  constructor(message, line) {
    super(`line ${line}: ${message}`);
    this.line = line;
  }
}

function stripComment(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q) q = null;
    } else if (c === '"' || c === "'") {
      q = c;
    } else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
      return s.slice(0, i);
    }
  }
  return s;
}

function scalar(raw, line) {
  const s = raw.trim();
  if (s === '') return '';
  if (s[0] === '"' || s[0] === "'") {
    const q = s[0];
    if (s.length < 2 || s[s.length - 1] !== q) throw new YamlError('unterminated quoted string', line);
    return s.slice(1, -1);
  }
  if (s[0] === '[') return inlineList(s, line);
  if (s[0] === '{') throw new YamlError('flow maps are not supported; use nested keys', line);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function inlineList(s, line) {
  if (s[s.length - 1] !== ']') throw new YamlError('unterminated inline list', line);
  const inner = s.slice(1, -1);
  const out = [];
  let cur = '';
  let q = null;
  for (const c of inner) {
    if (q) {
      cur += c;
      if (c === q) q = null;
    } else if (c === '"' || c === "'") {
      q = c;
      cur += c;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (q) throw new YamlError('unterminated quote in list', line);
  if (cur.trim() !== '' || out.length) out.push(cur);
  return out.map((x) => scalar(x, line)).filter((x) => x !== '');
}

export function parseYaml(text, lineOffset = 0) {
  const rows = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1 + lineOffset;
    if (/^\s*\t/.test(raw)) throw new YamlError('tabs are not allowed for indentation', line);
    const noComment = stripComment(raw).replace(/\s+$/, '');
    if (noComment.trim() === '') return;
    const indent = noComment.length - noComment.trimStart().length;
    rows.push({ indent, text: noComment.trim(), line });
  });
  let pos = 0;

  const isItem = (t) => t.startsWith('- ') || t === '-';

  function parseBlock(indent) {
    if (pos >= rows.length) return {};
    if (isItem(rows[pos].text)) return parseList(indent);
    return parseMap(indent);
  }

  function parseList(indent) {
    const out = [];
    while (pos < rows.length && rows[pos].indent === indent && isItem(rows[pos].text)) {
      const r = rows[pos];
      pos++;
      const rest = r.text === '-' ? '' : r.text.slice(2);
      out.push(scalar(rest, r.line));
    }
    if (pos < rows.length && rows[pos].indent > indent) throw new YamlError('unexpected indentation in list', rows[pos].line);
    return out;
  }

  function parseMap(indent) {
    const out = {};
    while (pos < rows.length) {
      const r = rows[pos];
      if (r.indent < indent) break;
      if (r.indent > indent) throw new YamlError('unexpected indentation', r.line);
      if (isItem(r.text)) throw new YamlError('list item where a key was expected', r.line);
      const m = r.text.match(/^("[^"]*"|'[^']*'|[^:]+?)\s*:(?:\s+(.*))?$/);
      if (!m) throw new YamlError(`expected "key: value", got "${r.text}"`, r.line);
      let key = m[1].trim();
      if (/^["']/.test(key)) key = key.slice(1, -1);
      if (Object.prototype.hasOwnProperty.call(out, key)) throw new YamlError(`duplicate key "${key}"`, r.line);
      pos++;
      const rest = m[2];
      if (rest === undefined || rest === '') {
        if (pos < rows.length && rows[pos].indent > indent) {
          out[key] = parseBlock(rows[pos].indent);
        } else if (pos < rows.length && rows[pos].indent === indent && isItem(rows[pos].text)) {
          out[key] = parseList(indent);
        } else {
          out[key] = null;
        }
      } else {
        out[key] = scalar(rest, r.line);
      }
    }
    return out;
  }

  if (!rows.length) return {};
  const v = parseBlock(rows[0].indent);
  if (pos < rows.length) throw new YamlError('unexpected content', rows[pos].line);
  return v;
}
