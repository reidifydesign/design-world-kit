#!/usr/bin/env node
// Example session-start hook for agents that can run a command at session start.
// It prints the project's design world (PRODUCT.md, DESIGN.md, VOICE.md) as context.
//
// Claude Code, in .claude/settings.json:
//   { "hooks": { "SessionStart": [ { "matcher": "startup|resume|clear|compact|fork",
//       "hooks": [ { "type": "command", "command": "node /path/to/design-world-kit/hooks/session-start.mjs" } ] } ] } }
//
// It only reads the three files in the project root. It writes nothing and makes no network calls.
import path from 'node:path';
import { buildContext, claudeHookJson } from '../src/load.mjs';
import { findRoot } from '../src/world.mjs';

const root = process.env.CLAUDE_PROJECT_DIR ? path.resolve(process.env.CLAUDE_PROJECT_DIR) : findRoot(process.cwd());
const json = claudeHookJson(buildContext(root, { ifMissing: 'notice' }));
if (json) process.stdout.write(json + '\n');
