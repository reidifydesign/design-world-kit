import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EXAMPLE = path.join(REPO, 'examples', 'lantern-post');

export function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dwk-'));
}

export function write(dir, rel, text) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return p;
}

// Copy the example world into a fresh temp dir so a test can break it safely.
export function exampleCopy() {
  const d = tmp();
  for (const f of ['PRODUCT.md', 'DESIGN.md', 'VOICE.md']) fs.copyFileSync(path.join(EXAMPLE, f), path.join(d, f));
  return d;
}

export function codes(result, file) {
  return result.findings.filter((f) => !file || f.file === file).map((f) => f.code);
}

export function capture() {
  const lines = [];
  const errs = [];
  return { out: (s) => lines.push(s), err: (s) => errs.push(s), lines, errs, text: () => lines.join('\n'), errText: () => errs.join('\n') };
}
