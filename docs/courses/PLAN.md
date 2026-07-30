# Courses — Master Plan

**Feature:** interactive, mathematically rigorous online courses on gustavoai.dev
**First course:** *Deep Learning para NLP: del Perceptrón al Transformer* (slug `dl-nlp`)
**Planning date:** 2026-07-24
**Tag convention:** `COURSE-PN-NN` in code comments. One task = one PR.

This is a **feature plan**, not a refactor cycle — it lives in `docs/courses/`, not
`docs/refactor/`. It follows the same document conventions (PLAN / STATUS / phase READMEs /
per-task files) because they work.

---

## Locked decisions

These were settled before planning; every task below assumes them.

| Decision | Choice | Rationale |
|---|---|---|
| Repository | **Same repo** (`personal-web-booking-app`) | Needs the existing session, `users` table, design tokens, Navbar/Footer, next-intl, Sentry, `/area-personal`. App Router segment splitting keeps the landing bundle clean; a second repo would duplicate all of it for no gain (Vercel bandwidth is pooled per account anyway). |
| Database | **Same Supabase** | The data is relational (`users → enrollments → lesson_progress → quiz_attempts`). ~8 MB at 1,000 students × 40 lessons — capacity is a non-issue. MongoDB would add a second ops surface, a second free tier, and a second type system for zero benefit. |
| Content storage | **MDX files in git**, not the DB | Versioned, diffable, reviewable in PRs — which matters for a course where derivations *will* be corrected. The DB holds user state only. |
| Rendering | **Static generation** (`generateStaticParams`) | Math (KaTeX) and highlighting (Shiki) resolve at build time. A lesson costs **zero function invocations** to serve — this is what keeps the whole thing inside Vercel Hobby regardless of traffic. |
| Python | **Pyodide in a Web Worker** (client-side) | Zero server cost. PyTorch does not run in Pyodide; NumPy does — which aligns exactly with a from-scratch course. Block 5's fine-tuning goes to Colab links. |
| Language | **Spanish first**, English additive later | Slugs are identical across locales, so English is a pure content addition — no new routes, no redirects, no slug migration. |
| Mobile app | **Out of scope, hedged** | The MDX body is web-only. Lesson *metadata* stays in a queryable registry so a future `GET /api/courses` + webview deep-link is additive, not a rewrite. |
| Access | **Free, sign-in required for progress** | The course is a funnel into the existing 1:1 booking business. Paid is a later config change (new `ProductKey` + existing PaymentIntent flow), not a rewrite. |

### Standing constraints

- **Vercel Hobby** — no native crons, 25s function cap, 100 GB bandwidth pooled per account.
  Nothing in this plan adds a cron or a long-running function.
- **Vercel Hobby is a non-commercial plan.** The course is free, so this plan stays inside that.
  If courses are ever monetised, revisit — it is a terms question, not a technical one.
- **Supabase free tier** — 500 MB. See capacity note above.
- **Node 22 via nvm** for `build` / `test` / `e2e` (system default is Node 18).

---

## Phases

| # | Phase | Tasks | Ships |
|---|-------|-------|-------|
| 2 | **[Foundations](phase-1-foundations/README.md)** | 4 | Content pipeline, registry, catalog + course landing, responsive reader. Prose lessons render. |
| 3 | **[Interactivity](phase-2-interactivity/README.md)** | 3 | Widget registry, first explorables, Pyodide code cells. |
| 4 | **[Assessment](phase-3-assessment/README.md)** | 2 | Quizzes + code challenges. **Exit = one lesson complete end-to-end.** |
| 5 | **[Persistence](phase-4-persistence/README.md)** | 3 | Migration `0016`, progress API, "Mis cursos" in `/area-personal`. |
| 5 | **[Content](phase-5-content/README.md)** | 6 | Authoring guide + the five syllabus blocks. |
| 6 | **[Launch](phase-6-launch/README.md)** | 3 | SEO/JSON-LD/sitemap/hreflang, waitlist email, gate flip. |

### The walking skeleton

There is deliberately **no separate "skeleton" phase**. Instead, the **exit criterion of Phase 3**
is that lesson 1 of Block 1 is authored end-to-end — prose + display math + one explorable +
one runnable NumPy cell + one quiz — and read on a phone.

The reason: the authoring loop is what decides whether a 40-lesson course finishes. Everything
in Phases 1–3 exists to make that loop fast, and none of it should be declared done until one
real lesson has been through it.

### Order & dependencies

```
P1 ──► P2 ──► P3 ──► P5 (content production)
 │                     ▲
 └────► P4 ────────────┘        P6 last
```

- **P1 blocks everything.** Nothing renders without the pipeline and registry.
- **P4 (persistence) is independent of P2/P3** and can land in parallel — progress tracking
  neither needs nor is needed by widgets.
- **P5 starts as soon as P1 lands** for prose-only lessons; interactive lessons wait for P2/P3.
  In practice P5 overlaps P2–P4 for months. This is what the `draft: true` flag and the
  publication gate are for: main stays continuously mergeable.
- **P6 last** — it makes the feature publicly visible and emails the waitlist.

---

## Architecture at a glance

```
content/courses/dl-nlp/          ← prose (MDX), per locale, git-versioned
        │
        ├─ registry (build time) ─────► sidebar · syllabus · sitemap · future mobile API
        └─ MDX body (build time) ─────► static HTML + KaTeX + Shiki
                                              │
                                        client islands: widgets · PyCell · Quiz
                                              │
                                     POST /api/courses/progress
                                              │
                        route → CourseService → ICourseRepository → Supabase
                                                                 └→ in-memory (tests)
```

Layering is the existing one: thin route handler → service → repository interface →
Supabase impl, with an in-memory fake for tests. Domain errors in `src/domain/errors.ts`,
mapped to HTTP by `src/lib/http-errors.ts`. Zod schemas in `src/lib/schemas.ts`.

### Content vs. state — the load-bearing split

| Lives in git | Lives in Postgres |
|---|---|
| Lesson prose, math, code, widget invocations | `enrollments` |
| Quiz definitions (in frontmatter) | `lesson_progress` |
| Course/block/lesson structure + ordering | `quiz_attempts` |

`course_slug` / `lesson_slug` are **plain text columns, not foreign keys** — there is no
`courses` table to reference, because content lives in git. That is the whole point.

---

## Course structure (`dl-nlp`)

| Block | Title (es) | Interactivity profile |
|---|---|---|
| 1 | Fundamentos de NLP | Tokenizer playground, embedding projection. Prose-heavy — good first content. |
| 2 | El Perceptrón Multicapa | Activation explorer, live gradient descent, backprop trace. NumPy MLP from scratch. |
| 3 | Redes Neuronales Recurrentes | Unrolled-RNN diagram, vanishing-gradient visualiser, LSTM gate explorer. |
| 4 | El Puente hacia la Atención | Context-bottleneck demo, Bahdanau alignment heat map. |
| 5 | El Transformer | Self-attention heat map, multi-head view, positional-encoding explorer. Fine-tuning → **Colab**. |

Block 5's final project cannot run in Pyodide (no PyTorch). That is by design, not a gap.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Content volume** — ~40 lessons is the dominant cost, dwarfing all engineering | 🔴 | Phases 1–3 are entirely about the authoring loop. Per-lesson budget fixed in P5-00. `draft` flag so writing never blocks merges. |
| **English translation doubles the work** | 🟠 | Locale-partitioned content from day one; identical slugs; hreflang emits no `en` alternate until the file exists (P6-01). Decision to translate stays reversible. |
| Pyodide payload (~10 MB + ~7 MB NumPy) | 🟠 | Lazy-mount on first Run click, CDN-hosted (browser-cached across lessons), only on lessons with `hasCode`. Never in the shared layout chunk. |
| Bundle creep into the landing page | 🟠 | P1-04 adds a bundle guard; KaTeX/Shiki/Pyodide/widgets must never enter the shared layout chunk. |
| Mobile reading of long display math | 🟠 | P1-04 designs mobile-first; every display equation, code block and table gets its own `overflow-x` container. |
| MDX/Next 16 RSC compatibility unknown | 🟡 | P1-01 opens with a spike and a named fallback before any content is written. |
| Scope creep on lesson 1 | 🟡 | P5-00 fixes an explicit per-lesson budget (words / widgets / cells / questions). |

---

## Explicitly out of scope

- **Paid courses / certificates.** Schema is shaped so it's a later addition; nothing here implements it.
- **Video.** If ever added: YouTube unlisted or Cloudflare Stream, never self-hosted on Vercel.
- **Per-lesson comments / Q&A.** Moderation cost is real and competes with the actual monetisation (booking a session).
- **Cross-lesson search.** Later, via Pagefind (build-time index, zero server cost) — not Postgres FTS.
- **Mobile app course delivery.** Hedged via the registry; not built.
- **`/admin/cursos` analytics.** Worth doing eventually (per-lesson drop-off tells you which lesson is too hard); `lesson_progress` is shaped to answer it. Spanish-only per the admin convention. Not this cycle.
- **English content.** The pipeline supports it; no English lesson is written here.
