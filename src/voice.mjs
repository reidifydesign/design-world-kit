// Machine-readable rules from the VOICE.md front matter.
import { splitFrontMatter } from './markdown.mjs';

export function parseVoiceRules(text) {
  const fm = splitFrontMatter(text);
  const d = fm.data && typeof fm.data === 'object' ? fm.data : {};
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []);
  const p = d.punctuation && typeof d.punctuation === 'object' ? d.punctuation : {};
  const l = d.limits && typeof d.limits === 'object' ? d.limits : {};
  return {
    name: typeof d.name === 'string' ? d.name : null,
    bannedWords: list(d.banned_words),
    bannedPhrases: list(d.banned_phrases),
    emDash: p.em_dash === 'banned',
    curlyQuotes: p.curly_quotes === 'banned',
    exclamationMax: typeof p.exclamation_max === 'number' ? p.exclamation_max : null,
    maxSentenceWords: typeof l.max_sentence_words === 'number' ? l.max_sentence_words : null,
  };
}

export function hasAnyRule(r) {
  return Boolean(r.bannedWords.length || r.bannedPhrases.length || r.emDash || r.curlyQuotes || r.exclamationMax !== null || r.maxSentenceWords !== null);
}
