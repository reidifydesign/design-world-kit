// Write the three templates into a project root. Never overwrites without --force.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILES } from './world.mjs';

const TEMPLATES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');

export function initWorld(root, { force = false, only = null } = {}) {
  const wanted = only ? FILES.filter((f) => only.includes(f.replace('.md', '').toLowerCase())) : FILES;
  const results = [];
  fs.mkdirSync(root, { recursive: true });
  for (const name of wanted) {
    const dest = path.join(root, name);
    if (fs.existsSync(dest) && !force) {
      results.push({ name, action: 'kept' });
      continue;
    }
    const existed = fs.existsSync(dest);
    fs.copyFileSync(path.join(TEMPLATES, name), dest);
    results.push({ name, action: existed ? 'replaced' : 'created' });
  }
  return results;
}
