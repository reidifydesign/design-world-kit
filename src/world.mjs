// Locating and reading the three world files.
import fs from 'node:fs';
import path from 'node:path';

export const FILES = ['PRODUCT.md', 'DESIGN.md', 'VOICE.md'];
export const KEYS = { 'PRODUCT.md': 'product', 'DESIGN.md': 'design', 'VOICE.md': 'voice' };

const exists = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// Walk up from `start` until a directory holds any of the three files or a .git entry.
// Falls back to `start` itself. Never reads anything outside that chain.
export function findRoot(start) {
  let dir = path.resolve(start);
  const first = dir;
  for (;;) {
    if (FILES.some((f) => exists(path.join(dir, f)))) return dir;
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return first;
    dir = up;
  }
}

export function readWorld(root) {
  const files = {};
  for (const f of FILES) {
    const p = path.join(root, f);
    const ok = exists(p);
    files[f] = { name: f, path: p, exists: ok, text: ok ? fs.readFileSync(p, 'utf8') : '' };
  }
  return { root, files, isDir: isDir(root) };
}
