// Structural validation of PRODUCT.md, DESIGN.md and VOICE.md.
// Findings: { file, severity: 'error' | 'warn' | 'open', code, message, line }.
// 'open' is a [[CONFIRM: ...]] marker: a fact the project has not settled yet.
import { splitFrontMatter, sections, normKey, meaningful } from './markdown.mjs';
import { readWorld, FILES } from './world.mjs';
import { parseVoiceRules, hasAnyRule } from './voice.mjs';
import { textViolations } from './copy.mjs';

// ---------- section vocabularies ----------

const PRODUCT_REQUIRED = [
  { id: 'users', label: 'Users', aliases: ['users', 'audience', 'who it is for', 'users and audience'] },
  { id: 'purpose', label: 'Product Purpose', aliases: ['product purpose', 'purpose', 'what it is', 'what this is'] },
  { id: 'evidence', label: 'Evidence on Hand', aliases: ['evidence on hand', 'evidence', 'facts', 'facts on hand', 'proof'] },
  { id: 'constraints', label: 'Capabilities and Constraints', aliases: ['capabilities and constraints', 'constraints', 'limits', 'capabilities'] },
];
const PRODUCT_RECOMMENDED = [
  { id: 'notclaimed', label: 'Not Claimed', aliases: ['not claimed', 'do not claim', 'never claim', 'off limits', 'not stated'] },
  { id: 'positioning', label: 'Positioning', aliases: ['positioning', 'position'] },
  { id: 'brand', label: 'Brand Commitments', aliases: ['brand commitments', 'brand', 'identity'] },
];

// Section order from the Google DESIGN.md specification (read 2026-09-30).
const DESIGN_ORDER = [
  { id: 'overview', label: 'Overview', aliases: ['overview', 'brand and style'] },
  { id: 'colors', label: 'Colors', aliases: ['colors', 'colours'] },
  { id: 'typography', label: 'Typography', aliases: ['typography'] },
  { id: 'layout', label: 'Layout', aliases: ['layout', 'layout and spacing'] },
  { id: 'elevation', label: 'Elevation and Depth', aliases: ['elevation and depth', 'elevation'] },
  { id: 'shapes', label: 'Shapes', aliases: ['shapes'] },
  { id: 'components', label: 'Components', aliases: ['components'] },
  { id: 'dosdonts', label: "Do's and Don'ts", aliases: ['dos and donts', 'do and dont', 'dos donts'] },
];
const DESIGN_RECOMMENDED = ['overview', 'colors', 'typography', 'dosdonts'];

const VOICE_REQUIRED = [
  { id: 'voice', label: 'Voice', aliases: ['voice', 'voice summary', 'overview', 'who is speaking', 'the voice'] },
  { id: 'rules', label: 'Rules', aliases: ['rules', 'writing rules', 'always', 'style rules'] },
];
const VOICE_RECOMMENDED = [
  { id: 'never', label: 'Never', aliases: ['never', 'never say', 'banned', 'banned words', 'do not say'] },
  { id: 'examples', label: 'Examples', aliases: ['examples', 'before and after', 'sample lines'] },
];

const TYPO_FIELDS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFeature', 'fontVariation'];
const COMPONENT_PROPS = ['backgroundColor', 'textColor', 'typography', 'rounded', 'padding', 'size', 'height', 'width'];

const find = (secs, def) => secs.find((s) => def.aliases.includes(s.key));

// ---------- helpers ----------

export function blankComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}
function blankCode(text) {
  return text
    .replace(/^(\s*)(```+|~~~+)[\s\S]*?^\s*\2[^\n]*$/gm, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
}

function placeholderFindings(file, text) {
  const out = [];
  const noComments = blankComments(text);
  noComments.split(/\r?\n/).forEach((l, i) => {
    const re = /\[\[CONFIRM:?\s*([^\]]*?)\s*\]\]/g;
    let m;
    while ((m = re.exec(l))) {
      out.push({ file, severity: 'open', code: 'OPEN', line: i + 1, message: m[1] || 'unsettled fact' });
    }
  });
  blankCode(noComments)
    .split(/\r?\n/)
    .forEach((l, i) => {
      const hit = l.match(/\{\{[^}]*\}\}|\bTODO\b|\bTBD\b|lorem ipsum|<(?:your|insert|todo)[^>]*>/i);
      if (hit) {
        out.push({
          file,
          severity: 'error',
          code: 'UNFILLED',
          line: i + 1,
          message: `unfilled placeholder "${hit[0]}"; write the fact or use [[CONFIRM: ...]] so it is counted`,
        });
      }
    });
  return out;
}

function sectionChecks(file, secs, required, recommended, add) {
  const seen = new Set();
  for (const s of secs) {
    if (seen.has(s.key)) add(file, 'error', 'DUP-SECTION', s.line, `duplicate section "${s.title}"`);
    seen.add(s.key);
  }
  for (const def of required) {
    const s = find(secs, def);
    if (!s) add(file, 'error', 'MISSING-SECTION', 1, `missing required section "## ${def.label}"`);
    else if (!meaningful(s.body)) {
      add(file, 'error', 'EMPTY-SECTION', s.line, `section "${s.title}" is empty; write it or put [[CONFIRM: ...]] in it`);
    }
  }
  for (const def of recommended) {
    const s = find(secs, def);
    if (!s) add(file, 'warn', 'NO-SECTION', 1, `no "## ${def.label}" section (recommended)`);
    else if (!meaningful(s.body)) add(file, 'warn', 'EMPTY-SECTION', s.line, `section "${s.title}" is empty`);
  }
}

// ---------- PRODUCT.md ----------

function checkProduct(f, add) {
  const fm = splitFrontMatter(f.text);
  if (fm.error) add(f.name, 'error', 'FRONT-MATTER', fm.error.line, fm.error.message);
  const secs = sections(fm.body, fm.bodyStartLine);
  sectionChecks(f.name, secs, PRODUCT_REQUIRED, PRODUCT_RECOMMENDED, add);
}

// ---------- DESIGN.md ----------

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(.+\)$/i;
const DIM = /^-?\d*\.?\d+(?:px|em|rem|%|vh|vw|ch|pt|ms|s)?$/;
const REF = /^\{([A-Za-z0-9_.-]+)\}$/;

function isColor(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return HEX.test(s) || FUNC.test(s) || /^[a-z]+$/i.test(s) || REF.test(s);
}
function isDimension(v) {
  if (typeof v === 'number') return true;
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return DIM.test(s) || REF.test(s);
}
function lookup(data, dotted) {
  let cur = data;
  for (const part of dotted.split('.')) {
    if (cur && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, part)) cur = cur[part];
    else return { found: false };
  }
  return { found: true, value: cur };
}
// Follow a chain of {references}; return { ok, reason }.
function resolveRef(data, ref) {
  let cur = ref;
  const trail = [];
  for (let i = 0; i < 12; i++) {
    const m = typeof cur === 'string' && cur.trim().match(REF);
    if (!m) return { ok: true, value: cur };
    if (trail.includes(m[1])) return { ok: false, reason: `circular reference ${trail.concat(m[1]).join(' -> ')}` };
    trail.push(m[1]);
    const r = lookup(data, m[1]);
    if (!r.found) return { ok: false, reason: `unknown token {${m[1]}}` };
    cur = r.value;
  }
  return { ok: false, reason: 'reference chain too deep' };
}
const normHex = (h) => {
  let s = h.toLowerCase().replace('#', '');
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join('');
  return '#' + s.slice(0, 6);
};

function checkDesign(f, add) {
  const fm = splitFrontMatter(f.text);
  const file = f.name;
  if (fm.error) add(file, 'error', 'FRONT-MATTER', fm.error.line, fm.error.message);
  const d = fm.data;
  if (!fm.raw && !fm.error) {
    add(file, 'warn', 'NO-TOKENS', 1, 'no YAML front matter; tokens give agents exact values (see docs/formats.md)');
  }
  const colorValues = new Set();
  if (d && typeof d === 'object') {
    if (!d.name || typeof d.name !== 'string') add(file, 'error', 'NO-NAME', 1, 'front matter needs a string "name"');
    const groups = ['colors', 'typography', 'rounded', 'spacing', 'components'];
    for (const g of groups) {
      if (d[g] !== undefined && (d[g] === null || typeof d[g] !== 'object' || Array.isArray(d[g]))) {
        add(file, 'error', 'BAD-GROUP', 1, `"${g}" must be a map of tokens`);
      }
    }
    for (const [k, v] of Object.entries(d.colors || {})) {
      if (!isColor(v)) add(file, 'error', 'BAD-COLOR', 1, `colors.${k}: "${v}" is not a colour value`);
      else {
        const r = resolveRef(d, v);
        if (!r.ok) add(file, 'error', 'BAD-REF', 1, `colors.${k}: ${r.reason}`);
        else if (typeof r.value === 'string' && HEX.test(r.value.trim())) colorValues.add(normHex(r.value.trim()));
      }
    }
    for (const [k, v] of Object.entries(d.typography || {})) {
      if (!v || typeof v !== 'object') {
        add(file, 'error', 'BAD-TYPE', 1, `typography.${k} must be a map`);
        continue;
      }
      if (!v.fontFamily) add(file, 'warn', 'TYPE-NO-FAMILY', 1, `typography.${k} has no fontFamily`);
      for (const [p, pv] of Object.entries(v)) {
        if (!TYPO_FIELDS.includes(p)) add(file, 'warn', 'TYPE-UNKNOWN-FIELD', 1, `typography.${k}.${p} is not a spec field`);
        else if (p === 'fontSize' && !isDimension(pv)) add(file, 'error', 'BAD-DIM', 1, `typography.${k}.fontSize: "${pv}" is not a dimension`);
      }
    }
    for (const g of ['rounded', 'spacing']) {
      for (const [k, v] of Object.entries(d[g] || {})) {
        if (!isDimension(v)) add(file, 'error', 'BAD-DIM', 1, `${g}.${k}: "${v}" is not a dimension`);
        else if (typeof v === 'string' && REF.test(v.trim())) {
          const r = resolveRef(d, v);
          if (!r.ok) add(file, 'error', 'BAD-REF', 1, `${g}.${k}: ${r.reason}`);
        }
      }
    }
    for (const [name, comp] of Object.entries(d.components || {})) {
      if (!comp || typeof comp !== 'object') {
        add(file, 'error', 'BAD-COMPONENT', 1, `components.${name} must be a map`);
        continue;
      }
      for (const [p, pv] of Object.entries(comp)) {
        if (!COMPONENT_PROPS.includes(p)) add(file, 'warn', 'COMPONENT-UNKNOWN-PROP', 1, `components.${name}.${p} is not a spec property`);
        if (typeof pv === 'string' && REF.test(pv.trim())) {
          const r = resolveRef(d, pv);
          if (!r.ok) add(file, 'error', 'BAD-REF', 1, `components.${name}.${p}: ${r.reason}`);
        }
      }
    }
  }
  // section order and duplicates (the spec rejects duplicate headings)
  const secs = sections(fm.body, fm.bodyStartLine);
  const omitted = new Set(
    (d && Array.isArray(d.omitted) ? d.omitted : []).map((o) => normKey(typeof o === 'string' ? o : (o && o.section) || '')),
  );
  let maxIdx = -1;
  const seen = new Set();
  for (const s of secs) {
    const idx = DESIGN_ORDER.findIndex((def) => def.aliases.includes(s.key));
    if (idx === -1) continue;
    if (seen.has(idx)) {
      add(file, 'error', 'DUP-SECTION', s.line, `duplicate section "${s.title}"`);
      continue;
    }
    seen.add(idx);
    if (idx < maxIdx) {
      add(file, 'error', 'SECTION-ORDER', s.line, `"${s.title}" is out of order; the spec order is ${DESIGN_ORDER.map((x) => x.label).join(', ')}`);
    }
    maxIdx = Math.max(maxIdx, idx);
    if (!meaningful(s.body)) add(file, 'warn', 'EMPTY-SECTION', s.line, `section "${s.title}" is empty`);
  }
  for (const id of DESIGN_RECOMMENDED) {
    const def = DESIGN_ORDER.find((x) => x.id === id);
    if (!secs.some((s) => def.aliases.includes(s.key)) && !def.aliases.some((a) => omitted.has(a))) {
      add(file, 'warn', 'NO-SECTION', 1, `no "## ${def.label}" section (recommended)`);
    }
  }
  // prose drift: a hex colour written in the Colors section that no token holds
  const colorsDef = DESIGN_ORDER[1];
  const cs = secs.find((s) => colorsDef.aliases.includes(s.key));
  if (cs && colorValues.size) {
    const seenHex = new Set();
    cs.body.split(/\r?\n/).forEach((l, i) => {
      for (const m of l.matchAll(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g)) {
        const n = normHex(m[0]);
        if (!colorValues.has(n) && !seenHex.has(n)) {
          seenHex.add(n);
          add(file, 'warn', 'PROSE-COLOR-DRIFT', cs.line + 1 + i, `${m[0]} is written in the Colors prose but no colour token holds it`);
        }
      }
    });
  }
}

// ---------- VOICE.md ----------

function checkVoice(f, add) {
  const fm = splitFrontMatter(f.text);
  const file = f.name;
  if (fm.error) add(file, 'error', 'FRONT-MATTER', fm.error.line, fm.error.message);
  const d = fm.data && typeof fm.data === 'object' ? fm.data : null;
  if (d) {
    for (const k of ['banned_words', 'banned_phrases']) {
      if (d[k] !== undefined && !Array.isArray(d[k])) add(file, 'error', 'BAD-LIST', 1, `"${k}" must be a list`);
      else if (Array.isArray(d[k]) && d[k].some((x) => typeof x !== 'string')) add(file, 'error', 'BAD-LIST', 1, `"${k}" must hold only strings`);
    }
    const p = d.punctuation;
    if (p !== undefined && (p === null || typeof p !== 'object' || Array.isArray(p))) add(file, 'error', 'BAD-GROUP', 1, '"punctuation" must be a map');
    else if (p) {
      for (const k of ['em_dash', 'curly_quotes']) {
        if (p[k] !== undefined && !['banned', 'allowed'].includes(p[k])) add(file, 'error', 'BAD-VALUE', 1, `punctuation.${k} must be banned or allowed`);
      }
      if (p.exclamation_max !== undefined && typeof p.exclamation_max !== 'number') add(file, 'error', 'BAD-VALUE', 1, 'punctuation.exclamation_max must be a number');
    }
    const l = d.limits;
    if (l !== undefined && (l === null || typeof l !== 'object' || Array.isArray(l))) add(file, 'error', 'BAD-GROUP', 1, '"limits" must be a map');
    else if (l && l.max_sentence_words !== undefined && typeof l.max_sentence_words !== 'number') add(file, 'error', 'BAD-VALUE', 1, 'limits.max_sentence_words must be a number');
  }
  const rules = parseVoiceRules(f.text);
  if (!hasAnyRule(rules)) {
    add(file, 'warn', 'NOTHING-TO-ENFORCE', 1, 'no banned words, phrases or punctuation rules in the front matter, so "copy" has nothing to enforce');
  }
  const secs = sections(fm.body, fm.bodyStartLine);
  sectionChecks(file, secs, VOICE_REQUIRED, VOICE_RECOMMENDED, add);
  // self-consistency: lines labelled "After:" in Examples must obey the file's own rules
  const ex = find(secs, VOICE_RECOMMENDED[1]);
  if (ex) {
    ex.body.split(/\r?\n/).forEach((l, i) => {
      const m = l.match(/^\s*(?:[-*]\s*)?(?:\*\*)?after(?:\*\*)?\s*:\s*(.+)$/i);
      if (!m) return;
      for (const v of textViolations(m[1], rules)) {
        add(file, 'warn', 'EXAMPLE-BREAKS-RULE', ex.line + 1 + i, `an "After" example breaks this file's own rule: ${v}`);
      }
    });
  }
}

// ---------- entry point ----------

export function checkWorld(root) {
  const world = readWorld(root);
  const findings = [];
  const add = (file, severity, code, line, message) => findings.push({ file, severity, code, line, message });
  const missing = [];
  for (const name of FILES) {
    const f = world.files[name];
    if (!f.exists) {
      missing.push(name);
      add(name, 'error', 'MISSING-FILE', 0, `${name} not found at the project root (run "design-world-kit init")`);
      continue;
    }
    if (name === 'PRODUCT.md') checkProduct(f, add);
    if (name === 'DESIGN.md') checkDesign(f, add);
    if (name === 'VOICE.md') checkVoice(f, add);
    findings.push(...placeholderFindings(name, f.text));
  }
  const count = (s) => findings.filter((x) => x.severity === s).length;
  const counts = { error: count('error'), warn: count('warn'), open: count('open') };
  const structural = findings.filter((x) => x.severity === 'error' && x.code !== 'MISSING-FILE').length;
  let status;
  if (missing.length === FILES.length) status = 'EMPTY';
  else if (structural) status = 'INVALID';
  else if (missing.length) status = 'INCOMPLETE';
  else if (counts.open) status = 'DRAFT';
  else status = 'READY';
  return { root, status, missing, counts, findings, world };
}

export function exitCode(result, strict = false) {
  if (['EMPTY', 'INVALID', 'INCOMPLETE'].includes(result.status)) return 1;
  if (strict && (result.status === 'DRAFT' || result.counts.warn > 0)) return 1;
  return 0;
}
