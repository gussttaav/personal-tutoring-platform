# docs/courses — the map

Plans and contracts for the courses on gustavoai.dev. Two kinds of file live here, and the
distinction is the whole organising rule:

- **Shared** files, at this level, hold only what is true of **every** lesson on the platform.
- **Course** folders, one per `content/courses/<slug>/`, hold that course's plan and its
  *deltas* — files that replace only what they name in the shared contract, never the whole of it.

```
docs/courses/
├── README.md            this file
├── AUTHORING.md         how a lesson gets made — structure, budget, voice, components, lint
├── AUTHORING.en.md      the English-language delta to AUTHORING.md
├── NOTATION.md          typography, indices, shapes, reserved symbols, object language, lint rules
├── dl-nlp/              Deep Learning para NLP: del Perceptrón al Transformer
│   ├── PLAN.md · STATUS.md
│   ├── AUTHORING.md     its delta: the three prerequisites and the terminology table
│   ├── NOTATION.md      its per-block symbol tables (the course-specific half of the contract)
│   ├── phase-1 … phase-11
│   └── notebooks/       its Colab notebooks
└── llm-agents/          Modelos de Lenguaje: del Transformer al Agente
    ├── PLAN.md · STATUS.md
    ├── AUTHORING.md     its delta: the two shapes of a lesson, the terminal form, its terms
    ├── NOTATION.md      its per-block symbol tables, seeded (COURSE-C2-P0-04)
    ├── phase-0 … phase-2
    └── (notebooks/ — created by its Phase 1)
```

## Which file governs

1. `AUTHORING.md` and `NOTATION.md` always.
2. The course's own `NOTATION.md` for its symbols; its `AUTHORING.md` **delta**, if it has one,
   for the parts of the contract that course does differently (the way `AUTHORING.en.md` does
   for English). A delta says what it replaces; everything it does not name still holds.
3. The block task md for the lesson being written: its lesson spec, its "Mathematical content"
   or "The precise statements", its gotchas, and the header lines the `/course-lesson` command
   reads (course, shape, model, publication rule).

Read in that order; a later file never widens an earlier one.

## The platform is not a course

The pipeline, registry, reader, widget system, Pyodide cells, quizzes, progress, search and
launch tooling were built inside the first course's plan (`dl-nlp/phase-1` … `phase-4`, `6`,
`7-01`, `8-01`, `9`, `10`) and stay there as history. They are course-agnostic by construction —
`[courseSlug]` routes, a per-course manifest, `course_slug` as plain text in Postgres — and a new
course does not touch them. Platform-only work that no course owns would get its own folder
(`platform/<cycle>/`) the day it exists.

## Adding a course

1. `docs/courses/<slug>/PLAN.md` + `STATUS.md` + phase folders, in this document shape (PLAN /
   STATUS / phase READMEs / per-task files; one task = one PR; tag `COURSE-<Cn>-PN-NN`).
2. `content/courses/<slug>/course.{es,en}.yml` — the manifest is the course's landing page and
   its prerequisites; the registry picks it up with no code change.
3. `docs/courses/<slug>/NOTATION.md` if the course has mathematics; an `AUTHORING.md` delta if its
   lessons take a shape the shared contract does not describe (a course without derivations, a
   course that runs in a terminal). Redefine steps in the delta; do not fork the contract.
4. A cross-course `<Leccion curso="…">` reference where the new course picks up an old one
   (`COURSE-C2-P0-02`), and a `nextCourse` hand-off on the old one's manifest when the new one
   is public (`COURSE-C2-P2-01`).

The `/course-task`, `/course-lesson` and `/course-translate` commands resolve the course from the
task md's path (`docs/courses/<slug>/…`), so they need nothing per course.
