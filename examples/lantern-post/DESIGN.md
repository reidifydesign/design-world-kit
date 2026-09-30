---
version: alpha
name: Lantern Post
description: A quiet, tactile identity for a small letterpress shop. Example values only.
colors:
  paper: "#f3efe4"
  primary: "#1f2a30"
  accent: "#2f6f6a"
  highlight: "#c9982f"
  on-accent: "#f3efe4"
typography:
  display:
    fontFamily: Source Serif 4
    fontSize: 2.5rem
    fontWeight: 600
    lineHeight: 1.1
  body:
    fontFamily: Inter
    fontSize: 1rem
    lineHeight: 1.6
  label:
    fontFamily: Inter
    fontSize: 0.75rem
    letterSpacing: 0.08em
rounded:
  none: 0px
  sm: 2px
spacing:
  sm: 8px
  md: 16px
  lg: 40px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    rounded: "{rounded.none}"
    padding: 24px
  proof-stamp:
    textColor: "{colors.highlight}"
---

## Overview

Paper first. The page looks like a pressed card: flat, warm, with deep ink and one teal accent. It refuses gloss, gradients and stock photography.

## Colors

- **Paper (#f3efe4):** the page background. Never pure white.
- **Primary, called ink (#1f2a30):** all text and rules.
- **Accent (#2f6f6a):** links and the single primary button per view.
- **Highlight (#c9982f):** small marks only, such as an underline or a proof stamp. Never a fill.

## Typography

Display lines use Source Serif 4 in semibold. Everything else uses Inter. Labels are small, spaced and uppercase.

## Layout

A single 640px text column on wide screens, 16px gutters on phones. Sections are separated by space, not boxes.

## Shapes

Corners are square or nearly so. Edges are hairline rules, never shadows.

## Components

The primary button is a solid teal block with paper-coloured text. Its hover state inverts to ink.

## Do's and Don'ts

- Do: show real photographs of the shop's own work.
- Do: leave a pending state where a fact is not settled, for example "Pickup times to be confirmed".
- Don't: add a testimonial, a count of customers or a price that PRODUCT.md does not contain.
- Don't: use more than one teal button in a view.
