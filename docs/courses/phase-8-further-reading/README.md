# Phase 8 — Further reading

Give every lesson that has one an annotated «Para profundizar» block: where the material came
from, and where a student who wants more should go next.

Today the course is deliberately self-contained — it derives rather than cites — and that is a
strength worth keeping. What it costs is that a student who finishes lesson 7 and wants the actual
Mikolov paper has nowhere to go, and the course never shows that it knows the literature. For a
free course whose job is to be a funnel into 1:1 mentoring, an opinionated, curated reading list is
on-message in a way a bare link dump is not.

## Tasks

1. [01-component-and-lint.md](01-component-and-lint.md) — `COURSE-P8-01` (M) — the schema, the collapsed `<details>` block, the lint pass, the docs
2. [02-content-migration.md](02-content-migration.md) — `COURSE-P8-02` (L) — the 43-lesson pass, block by block, links verified

**Landing order:** strictly P8-01 → P8-02, for the same reason Phase 7 did it that way — the lint
must exist before content starts using the field.

## The design, and what was rejected

Prototyped and reviewed before any code was written (three treatments × two placements × two
initial states). What was chosen:

| Decision | Choice | Why |
|---|---|---|
| Authoring surface | **Frontmatter `reading:`**, rendered by a component | A recurring `## Para profundizar` in 43 lessons is exactly the "watching a form get filled out" failure AUTHORING §1 forbids |
| Treatment | **Cards** (`fichas`) | Reviewed against a quiet list and a compact footnote; cards read best once the block is behind a fold |
| Placement | **After the bridge**, before mark-complete | The bridge stays the lesson's last *prose*; the block joins the footer chrome that mark-complete and prev/next already form |
| Initial state | **Collapsed** | Five cards open, stacked above the mark-complete box and two nav cards, buried the end of the lesson under four box-groups |
| Cap | **5** (`READING_MAX`, schema-enforced) | Curation is the feature |
| Required field | **Yes**, `reading: []` everywhere | Same discipline as `challenges`: forces every new lesson to answer the question instead of defaulting to no by omission |

**The cost of collapsing, stated out loud:** what the fold hides is the `note`, which is the
expensive part to write and the thing that makes this a reading list rather than a link dump. Two
things pay for it — the summary carries a count and a per-kind breakdown so the closed state still
advertises what is inside, and the cap of five keeps the open state worth the click.

**Rejected:** a course-level bibliography page (the data supports it; nothing in this phase builds
one), per-entry "difficulty" ratings (unmeasurable), and any link-liveness check in CI (see below).

## Why liveness is not a build gate

CI has no network guarantee, and a lint that fails because arxiv.org is briefly down is a lint
people learn to disable — which costs more than the rot it was meant to catch. The lint validates
**shape and internal consistency**; the author verifies the URL resolves before committing, and rot
is a periodic manual pass. The `/abs/`-not-`/pdf/` rule exists because the abstract page is the
address that survives new versions.

## What the numbers say

Measured across the 43 published Spanish lessons at the start of the phase:

- **43 lessons**, all `reading: []` after P8-01 — every one is a decision P8-02 has to make
- **5 blocks**: 9 / 10 / 8 / 6 / 11 lessons (block 1 includes the draft fixture)
- Expected coverage is **not** 100%: implementation and project lessons often have no natural
  primary source, and lesson 1 deliberately has none
- At 2–4 entries on the lessons that take them, the phase lands somewhere near **100–130 entries**
