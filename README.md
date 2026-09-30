# design-world-kit

Templates and a validator for PRODUCT.md, DESIGN.md and VOICE.md, with a session-start hook so a design agent loads the project's world first.

![design-world-kit checking an example project and a draft homepage](docs/check-output.png)

```sh
npx github:reidifydesign/design-world-kit check
```

While the repository is private, run it from a clone: `node bin/design-world-kit.mjs check`.

## Why this exists

On 2026-09-30 the pieces of a project's "world" were spread across tools. Google's [DESIGN.md](https://github.com/google-labs-code/design.md) format defines the visual half and lints that one file. Impeccable writes a PRODUCT.md and a DESIGN.md through an interview. Nothing I found treats the voice of a project as a third file a tool can check, or checks the three files together. [What already exists](docs/landscape.md) lists what I read and when.

At [Reidify](https://reidify.design) the rule is that these three files at the project root beat an agent's instincts, and that a missing file means bootstrap first, not improvise. This kit is that rule written down as templates, a validator and a hook.

## Use it

Create the three files in a project. Every unknown is a `[[CONFIRM: ...]]` marker, so nothing is invented.

```sh
npx github:reidifydesign/design-world-kit init
```

Fill them in, then check them. The status is `READY`, `DRAFT` (valid, open items remain), `INCOMPLETE` or `INVALID`.

```sh
npx github:reidifydesign/design-world-kit check
npx github:reidifydesign/design-world-kit check --strict   # also fail on DRAFT and warnings
```

Check what was written against the voice rules and the facts on file. Figures such as `98%`, `$2` or `24 hours` must appear in PRODUCT.md, or they are flagged.

```sh
npx github:reidifydesign/design-world-kit copy site/ drafts/homepage.md
```

Load the world at the start of every agent session. For Claude Code:

```sh
npx github:reidifydesign/design-world-kit hook install
```

That adds one `SessionStart` entry to `.claude/settings.json`. The hook prints the status, five short rules for the agent, and the three files, kept under Claude Code's 10,000 character limit for hook output. Details, the faster no-`npx` form, and other agents are in [docs/hooks.md](docs/hooks.md).

### What each file holds

| File | Holds |
|---|---|
| `PRODUCT.md` | who it is for, what it is, the facts on hand, what must not be claimed |
| `DESIGN.md` | tokens and the reasoning behind them, in Google's DESIGN.md layout |
| `VOICE.md` | how the project sounds, plus machine-readable banned words, phrases and punctuation rules |

The full section lists and every check are in [docs/formats.md](docs/formats.md). A complete, fictional example is in [`examples/lantern-post`](examples/lantern-post). Its DESIGN.md passes `@google/design.md lint` with 0 errors and 0 warnings (run 2026-09-30).

## What it does not do

- It does not judge whether a fact is true. `copy` only checks that a figure is written in PRODUCT.md.
- The figure check is a heuristic for percentages, money, multipliers, `N+` counts and counts of years, clients and similar. It will miss figures written as words ("three hundred") and may flag harmless ones.
- It does not check colour contrast or other accessibility rules. Run Google's linter for the DESIGN.md spec's own rules.
- The front matter parser is a small YAML subset (maps, lists, quoted strings). A feature outside that, such as a multi-line string, is reported as an error.
- The hook loads the files. It cannot make an agent obey them, and it only runs where the harness runs hooks. Only the Claude Code hook format has been checked, against its documentation on 2026-09-30, and it has not been run inside a live session.
- It has been tested against the files in this repo, not yet against a real Impeccable-generated PRODUCT.md.
- It does not write your content. The templates are empty on purpose.

## Licence

MIT. Built by [@rishsadh](https://github.com/rishsadh) at [Reidify](https://reidify.design).
