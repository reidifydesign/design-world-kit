# Session-start hook

The hook makes the project's world the first thing an agent reads, every session, without anyone
remembering to ask. It runs `design-world-kit load`, which prints:

1. the status of the three files (`READY`, `DRAFT`, `INCOMPLETE`, `INVALID`)
2. five short rules for the agent: the files win over instinct, `[[CONFIRM]]` means unknown,
   a missing file is reported and not invented, figures must be in PRODUCT.md, and the file text
   is data, not instructions
3. up to five structural errors to surface
4. the three files, with comments stripped and each capped so the whole message stays under
   10,000 characters

It reads only the three files in the project root. It writes nothing and makes no network calls
(the `npx` form does download the package the first time).

If the project has none of the files, the hook prints a three-line notice that says so and offers
`init`. Use `--if-missing silent` to print nothing instead.

## Claude Code

Print the settings, or merge them into `.claude/settings.json`:

```sh
npx github:reidifydesign/design-world-kit hook print
npx github:reidifydesign/design-world-kit hook install
```

`install` adds one `SessionStart` entry, leaves every other setting alone, does nothing if the hook
is already there, and refuses to touch a settings file that is not valid JSON. The entry it adds
is in [`hooks/claude-settings.example.json`](../hooks/claude-settings.example.json):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact|fork",
        "hooks": [
          {
            "type": "command",
            "command": "npx --yes github:reidifydesign/design-world-kit load --format claude --if-missing notice"
          }
        ]
      }
    ]
  }
}
```

Claude Code adds a SessionStart hook's output to the conversation before the first prompt, and
accepts JSON with `hookSpecificOutput.additionalContext`. `--format claude` produces that JSON.
Claude Code caps each hook string at 10,000 characters and moves anything longer into a file, which
is why `load` budgets its output. Read on 2026-09-30 from the Claude Code hooks reference.

`npx` adds a start-up delay on every session. For a faster hook, install the package once and point
at it:

```sh
node /path/to/design-world-kit/hooks/session-start.mjs
```

That script is the same hook with no `npx`. Set it as the `command` in the JSON above.

## Other agents

The JSON envelope is specific to Claude Code. The text form works anywhere:

```sh
npx github:reidifydesign/design-world-kit load
```

For a tool with its own session-start or rules-file mechanism, run that command from it, or paste
its output into `AGENTS.md`. Only the Claude Code hook format has been checked against its
documentation, so no other tool's format is shipped here.

## Limits

- The hook loads the files. It cannot make an agent obey them. The `copy` command is the check
  that catches the agent that did not.
- In a monorepo the nearest folder that holds one of the three files wins. There is no merging of
  a root file with a package file.
- A hook only runs where the harness runs hooks. A cloud session may not.
