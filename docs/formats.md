# The three files

Each file has one job. Keeping the jobs apart is the point: an agent that finds the colour in
`DESIGN.md` and the claim in `PRODUCT.md` has fewer reasons to guess.

| File | Holds | Does not hold |
|---|---|---|
| `PRODUCT.md` | who it is for, what it is, what is true, what must not be claimed | colours, type, wording rules |
| `DESIGN.md` | the visual identity: tokens and the reasoning behind them | product facts, copy rules |
| `VOICE.md` | how the project sounds, and the rules a checker can enforce | facts, visual decisions |

Put all three at the project root. `design-world-kit` looks in the current folder and walks up
until it finds one of them or a `.git` folder.

## Open items: `[[CONFIRM: ...]]`

Anything you do not know is written as `[[CONFIRM: what is missing]]`. The checker counts them and
the hook tells the agent to show a pending state for each one instead of guessing. An unfilled
`TODO`, `TBD`, `{{...}}` or `lorem ipsum` is an error, because those are not counted.

HTML comments are ignored, so guidance text in a template never counts as content.

## Status

`check` ends with one status:

| Status | Meaning | Exit code |
|---|---|---|
| `READY` | all three files valid, no open items | 0 |
| `DRAFT` | valid, but open items remain | 0 (1 with `--strict`) |
| `INCOMPLETE` | valid so far, but a file is missing | 1 |
| `INVALID` | at least one structural error | 1 |
| `EMPTY` | none of the three files exist | 1 |

`--strict` also fails on warnings.

## PRODUCT.md

Required sections (each must have content, or an open item):

| Section | Accepted headings |
|---|---|
| Users | Users, Audience, Who it is for |
| Product Purpose | Product Purpose, Purpose, What it is |
| Evidence on Hand | Evidence on Hand, Evidence, Facts, Proof |
| Capabilities and Constraints | Capabilities and Constraints, Constraints, Limits |

Recommended (a warning when absent): **Not Claimed**, **Positioning**, **Brand Commitments**.

The headings follow the vocabulary other PRODUCT.md tools use, so a file written for one usually
passes here. **Evidence on Hand** matters most: `design-world-kit copy` treats it as the list of
figures that copy may state.

## DESIGN.md

The layout follows Google's DESIGN.md format: YAML front matter with tokens, then `##` sections in a
fixed order. The example in this repo passes `@google/design.md lint` with no errors or warnings
(run 2026-09-30, see [landscape.md](landscape.md)).

What `check` verifies:

- the front matter parses, and has a string `name`
- every `colors` value is a colour (hex, `rgb()`, `hsl()`, `oklch()` and similar, a bare name, or a reference)
- every `{token.reference}` resolves, and none is circular
- `rounded` and `spacing` values are dimensions or numbers
- `typography` entries use the spec's fields; `components` use the spec's properties
- sections appear in the spec order and none is duplicated
- a hex value written in the **Colors** prose is held by some colour token (drift check)
- a recommended section that is absent is a warning, unless `omitted:` lists it

Section order: Overview, Colors, Typography, Layout, Elevation and Depth, Shapes, Components,
Do's and Don'ts.

Contrast, orphaned tokens and the spec's other rules are left to Google's own linter. Run both.

## VOICE.md

Front matter carries the rules a machine can enforce. Prose carries the rest.

```yaml
---
name: Example voice
banned_words: [leverage, seamless]        # whole words, case-insensitive
banned_phrases: ["in today's fast-paced world"]   # substrings, case-insensitive
punctuation:
  em_dash: banned          # banned | allowed
  curly_quotes: banned     # banned | allowed
  exclamation_max: 0       # per file
limits:
  max_sentence_words: 28
---
```

Required sections: **Voice** and **Rules**. Recommended: **Never** and **Examples**.

In **Examples**, a line that starts with `After:` must obey the file's own rules. A voice file that
breaks its own rules in its own examples is flagged.

## `copy`: checking what was written

`design-world-kit copy <files or folders>` checks text against `VOICE.md`:

- banned words and phrases, em dashes, curly quotes (errors)
- more exclamation marks than allowed (error)
- sentences longer than the limit (warning)

And against `PRODUCT.md`, it flags **figures that the file does not contain**: percentages, money
(`$2`, `EUR 40`), multipliers (`3x`), counts such as `300+`, and counts of years, clients,
customers, projects, users, reviews, hours, days, weeks or months. A figure passes only if the same
text is in `PRODUCT.md`, ignoring spaces and case. This is a heuristic for the figures agents tend
to invent. It does not judge whether a figure is true.

Markdown is scanned outside code fences. HTML is scanned as text with tags, scripts and styles
removed. Other file types (`tsx`, `jsx`, `vue`, `svelte`, `astro`) are scanned as raw text, so
expect noise from code in them.
