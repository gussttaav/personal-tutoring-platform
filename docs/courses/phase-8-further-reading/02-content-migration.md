# P8-02 — the 43-lesson reading pass

**Tag:** `COURSE-P8-02` · **Size:** L · **Status:** not started · **Depends on:** P8-01

## TL;DR

Fill `reading:` across the 43 published lessons, one block per PR. Every entry annotated in
Spanish, every URL opened and checked before it is committed. Expected coverage is **not** 100% —
`reading: []` is the right answer for a good number of lessons.

## Why this is a separate task from P8-01

Same reason P7-02 was separate from P7-01: the engineering is bounded and mechanical, the content
is neither. At 2–4 entries on the lessons that take them this is ~100–130 entries, each needing a
correct title, a correct live URL, and a one-line Spanish annotation in the course's voice.

The failure mode that makes bulk generation unacceptable: **a wrong arXiv id is a 404 shipped to a
student**, and it looks exactly like a right one. Recall is not good enough. Every link gets
opened.

## The unit of work

**One block per PR**, in course order. Within a block, work lesson by lesson and keep a checklist
in this file. A block's box ticks only when every lesson in it is decided — including the ones
decided as `reading: []`.

## Lesson progress

Tick a lesson when its `reading` is committed, whether it ended up with entries or empty.

- [ ] **Block 1 — Fundamentos de NLP** (9 lessons, incl. the fixture)
- [ ] **Block 2 — El Perceptrón Multicapa** (10)
- [ ] **Block 3 — Redes Neuronales Recurrentes** (8)
- [ ] **Block 4 — El Puente hacia la Atención** (6)
- [ ] **Block 5 — El Transformer** (11)

## How to choose entries

**The bar:** would a student who just finished this lesson, and wants more, actually be served by
this? If the honest answer is "not really", it does not go in. Five is a cap, not a target; two
good entries beat five padded ones.

Prefer, in this order:

1. **The primary source for what the lesson just derived.** This is the highest-value entry and
   the one the lesson has genuinely earned — the student has done the work and can now read it.
2. **A free, canonical textbook chapter** (Jurafsky & Martin; Goodfellow et al.; Nielsen).
3. **The canonical explainer** where one exists and is genuinely better than prose (Olah on LSTMs,
   Alammar on the Transformer).
4. **An interactive or video companion**, at most one per lesson.

Avoid: blog posts that merely restate the lesson, anything paywalled, Medium mirrors of papers,
"top 10" listicles, and a second entry that makes the same point as the first.

## Writing the `note`

One line, ≤240 characters, in the course's voice (`tú`, no «obviamente»/«simplemente»). It says
**what the student gets**, not what the source is about — and where it is honest to do so, it says
what the source does *not* do.

> `'De aquí salen el muestreo negativo y el exponente 3/4, en su §2.2. Confirma lo que dice la lección: el 3/4 se eligió porque funcionó, y no da más razón que esa.'`

Not: `'Un paper influyente sobre word embeddings.'`

## Verification (not optional)

For every entry, before committing:

1. Open the URL. It resolves, and it is the thing the `title` claims.
2. arXiv → `/abs/`, never `/pdf/`; `venue` id matches the url id.
3. Any section number cited in the `note` is checked against the actual document.
4. `pnpm lint:content` — the report line shows the per-lesson `reading` count.

A quick liveness sweep over every URL in the tree:

```bash
grep -ho "https://[^']*" content/courses/dl-nlp/es/*.mdx | sort -u | while read u; do printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 20 -A 'Mozilla/5.0' "$u")" "$u"; done
```

## Acceptance criteria

- [ ] Every published lesson has a considered `reading` — entries or a deliberate `[]`
- [ ] Every URL returns 200 at merge time and points at what its `title` claims
- [ ] Every `note` is one line, in Spanish, in voice, saying what the student gets
- [ ] No lesson over 5 entries; no duplicate url or title within a lesson
- [ ] `pnpm lint:content` · `pnpm build` green

## Out of scope

The course-level bibliography page, `en/` translations of the notes, and any change to the
component or schema — if an entry cannot be expressed, that is a P8-01 amendment, recorded in
STATUS.md.
