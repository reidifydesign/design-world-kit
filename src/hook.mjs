// The session-start hook for Claude Code. Print the settings snippet, or merge it in.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_COMMAND = 'npx --yes github:reidifydesign/design-world-kit load --format claude --if-missing notice';
const MATCHER = 'startup|resume|clear|compact|fork';

export function hookSnippet(command = DEFAULT_COMMAND) {
  return {
    hooks: {
      SessionStart: [{ matcher: MATCHER, hooks: [{ type: 'command', command }] }],
    },
  };
}

const ours = (h) => h && h.type === 'command' && typeof h.command === 'string' && /design-world-kit|session-start\.mjs/.test(h.command);

// Merge into <root>/.claude/settings.json. Idempotent. Refuses a file that is not valid JSON.
export function installHook(root, command = DEFAULT_COMMAND) {
  const file = path.join(root, '.claude', 'settings.json');
  let settings = {};
  if (fs.existsSync(file)) {
    try {
      settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      return { file, action: 'refused', reason: `existing file is not valid JSON (${e.message})` };
    }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return { file, action: 'refused', reason: 'existing file is not a JSON object' };
  }
  settings.hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};
  const list = Array.isArray(settings.hooks.SessionStart) ? settings.hooks.SessionStart : [];
  if (list.some((entry) => Array.isArray(entry.hooks) && entry.hooks.some(ours))) return { file, action: 'already-installed' };
  list.push(hookSnippet(command).hooks.SessionStart[0]);
  settings.hooks.SessionStart = list;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return { file, action: 'installed' };
}
