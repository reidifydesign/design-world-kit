# What already exists

Read on 2026-09-30. Stars and dates move. URLs are the evidence.

| Project | What it does | Read |
|---|---|---|
| [google-labs-code/design.md](https://github.com/google-labs-code/design.md) | The DESIGN.md format: YAML tokens plus fixed prose sections. Ships `lint`, `diff` and `export`. Apache-2.0. 28,175 stars, pushed 2026-09-14. | GitHub API and README, 2026-09-30 |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | A design skill set for coding agents. Its `init` flow writes `PRODUCT.md`; its `document` flow writes `DESIGN.md`. It ships its own hooks for running a design detector after edits. Apache-2.0. 72,783 stars, pushed 2026-09-30. | GitHub API, `init.md` and `hooks.md` in its skill reference, 2026-09-30 |
| [getdesign](https://www.npmjs.com/package/getdesign) | An npm CLI for installing DESIGN.md templates into projects. Version 0.6.25, modified 2026-08-29. | npm registry, 2026-09-30 |
| [Owl-Listener/voice-protocol](https://github.com/Owl-Listener/voice-protocol) | A `voice.md` idea for turning brand personality into rules. 1 star, pushed 2026-08-09. | GitHub API, 2026-09-30 |

## What this kit adds

Google's project defines the `DESIGN.md` format and lints that one file. Impeccable writes a
`PRODUCT.md` and a `DESIGN.md` through an interview. Neither treats the voice of the project as a
third file that a tool can check, and neither checks the three files against each other.

`design-world-kit` adds:

- a `VOICE.md` with rules a machine can enforce, and a `copy` command that enforces them
- a check that figures in copy appear in `PRODUCT.md`
- one validator across all three files, with `DRAFT` and `READY` status based on counted open items
- a session-start hook and a size-budgeted `load` command that hands the trio to an agent first

It does not replace either tool. The example `DESIGN.md` in this repo was run through Google's
linter on 2026-09-30 (`npx -p @google/design.md designmd lint DESIGN.md`): 0 errors, 0 warnings.
A file written for Impeccable's PRODUCT.md vocabulary should pass the `PRODUCT.md` check, because
the headings are accepted as aliases. That has been tested with the headings, not with a real
Impeccable-generated file.

## Search notes

A GitHub repository search for `VOICE.md PRODUCT.md DESIGN.md` returned 0 results on 2026-09-30.
The npm name `design-world-kit` returned 404 (free) the same day. [[CONFIRM: re-run both searches
on launch day, because a quick search is not proof that nothing exists]]
