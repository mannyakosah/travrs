# traVRS design system

**traVRS** (pronounced *traverse*) should look like an instrument, not a dashboard.

The product explains a computational standard. The UI should feel closer to a well-set
terminal, a specification page, or a lab notebook than to an admin console:
monospace-first, low chrome, one column.

If we need a primitive later (accessible disclosure, focus trap), add **Radix** or
native HTML.

## Foundations

| Token | CSS variable | Value | Use |
|---|---|---|---|
| Ink | `--ink` | `#0b0d10` | page background |
| Surface | `--surface` | `#12151c` | input / result wells |
| Surface 2 | `--surface-2` | `#1a1f2a` | chips, JSON well |
| Line | `--line` | `#2a3140` | borders, rules |
| Text | `--text` | `#e8edf5` | primary copy |
| Muted | `--muted` | `#8b95a8` | labels, hints |
| Accent | `--accent` | `#3ecfbf` | focus, brand mark, links |
| Accent dim | `--accent-dim` | `#143734` | chip / badge fill |
| OK | `--ok` | `#7dcea0` | passing checks |
| Bad | `--bad` | `#e07a7a` | failing checks, errors |
| Warn | `--warn` | `#d4b46a` | notes, skipped checks |

### Type

- **Sans:** [IBM Plex Sans](https://github.com/IBM/plex) — labels, prose, buttons.
- **Mono:** [IBM Plex Mono](https://github.com/IBM/plex) — inputs, IDs, JSON, badges.

Plex is the same family IBM uses for technical products. It stays readable at small
sizes and pairs sans/mono without a costume-y “hacker” look.

| Role | Size | Weight | Family |
|---|---|---|---|
| Display ID | 22–28px | 500 | mono |
| Body | 16px | 400 | sans |
| Label | 12px | 500 | sans, uppercase, tracked |
| JSON | 13px | 400 | mono |
| Footer | 12px | 400 | mono |

Line height: 1.5 body, 1.35 mono blocks.

### Space

A 4px grid. Prefer too much air over cramped cards.

| Token | Value |
|---|---|
| `--s-1` | 4px |
| `--s-2` | 8px |
| `--s-3` | 12px |
| `--s-4` | 16px |
| `--s-5` | 24px |
| `--s-6` | 32px |
| `--s-7` | 48px |
| `--s-8` | 64px |

Page max width: **800px**. Radius: **`--radius` = 6px** (just enough, no pills except
example chips).

### Motion

150–200ms, ease-out, opacity and border-color only. No bounce. The spinner may
rotate; results should not animate in.

### Focus

Visible 2px `--accent` outline, 2px offset. Never `outline: none` without a
replacement.

## Components (identity view)

- **Wordmark** — `traVRS` with `VRS` in accent. Subline: “pronounced traverse”.
- **Field** — full-width mono input, surface fill, 1px line. Format badge sits
  inside the field on the right.
- **Badge** — uppercase format (`HGVS`, `SPDI`, `GNOMAD`, `VRS`), accent-dim
  background, accent text.
- **Examples** — quiet chips; one click fills and submits.
- **Identifier** — the computed `ga4gh:VA.` string is the largest object on the
  page. Copy control is text, not an icon-only button.
- **Checks** — a list, not a table. `✓` / `✗` in ok/bad. Name on the first
  line, detail wraps underneath.
- **JSON** — collapsed `<details>` by default. Surface-2 well, no tree widget.
- **Errors** — explanation first. Never a raw traceback.

## Do / don’t

- Do treat the identifier as the hero.
- Do keep one column.
- Don’t add a sidebar, card grid, or illustration.
- Don’t use drop shadows or gradients.
- Don’t put “Step N” or interview language in the UI.
