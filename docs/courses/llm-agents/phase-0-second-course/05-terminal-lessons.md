# P0-05 — Terminal lessons: `<RepoLink>` and the companion repository

**Tag:** `COURSE-C2-P0-05` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P0-04 (documents it)

## TL;DR

Block 5 does not run in the browser. Its lessons show code in fenced blocks and the student runs
it in a terminal against a local model. Two things make that a lesson rather than a blog post:
a **checkpoint the student can clone** at every lesson (so getting lost in lesson 5·6 has a
recovery), and a **component that links it** the way `<ColabLink>` links the first course's
notebook. This task builds the component and creates the repository — empty, with its rules
written down — so P1-05 fills it lesson by lesson.

## Context

- `src/lib/courses/mdx-components.tsx:281` — `ColabLink({ notebook })`, a styled `<a>` with the
  green outline; server-rendered, no JS. The pattern to copy.
- The first course's Colab notebook lives in this repo (`docs/courses/dl-nlp/notebooks/`) and the
  lesson links a pinned revision («Version it deliberately — link a specific gist or repo
  revision, not a mutable "latest"», P5-05 notes). A repo a student clones cannot live in a
  subfolder of the website; the *rule* carries over, the location does not.
- The Messages-format client is `urllib` + `json` (PLAN, locked). The repository has **no
  dependencies** beyond the Python standard library — that is part of what it teaches.

## Files affected

| File | Change |
|------|--------|
| `src/lib/courses/mdx-components.tsx` | + `RepoLink({ tag, path?, children })` → `<a>` to `${REPO_BASE}/tree/${tag}${path ? "/" + path : ""}`; same styling as `ColabLink`; a small kicker «checkpoint» so the reader knows it is a snapshot, not the live repo |
| `src/constants/courses.ts` (new, or the nearest existing constants file) | `LLM_AGENTS_REPO_BASE` — the one place the URL lives |
| `src/lib/courses/__tests__/mdx.test.ts` | `RepoLink` is in the component map; href built correctly for `tag` and `tag + path` |
| `messages/es.json`, `messages/en.json` | `courses.reader.repoLink.kicker` («punto de control» / «checkpoint») — key-for-key |
| `docs/courses/AUTHORING.md` §7 | The component's rule (written by P0-04, verified here) |
| *(outside this repo)* the companion repository | Created empty: `README.md` (what it is, the tag scheme, the pinned Ollama/model versions **to be filled by P1-05**, licence), `LICENSE` (MIT), `.gitignore`. No code |

## The change

**Tag scheme:** `b5-l1` … `b5-l9`, one per Block 5 lesson, cut from the lesson's code **at
review time** of that lesson's PR (the lesson is the source of truth; the tag is the copy). A
lesson links its own tag at the end of its implementation step («si te has perdido, este es el
estado al final de esta lección») and the *previous* tag at the start («parte de aquí»). `main`
is never linked.

**Layout** is decided by Block 4's project lesson (the scripted agent is the same program with a
different `Modelo`), so this task fixes only what the README must say:

- the interface `modelo(mensajes, herramientas) -> respuesta` and the two adapters that
  implement it (local Messages API; scripted, for tests);
- one file per tool, one file for the loop, one for permissions, one for compaction — the
  lesson order is the file order;
- a `tareas/` directory with the mini-benchmark's five-file repositories (P1-05, lesson 5·8);
- Python ≥ 3.11 (pinned in the README), standard library only, no venv needed but shown.

**The drift risk is accepted and named.** Code in MDX and code in a tag can disagree. The
mitigation is procedural: the tag is cut from the reviewed lesson, and the lesson's test plan
includes cloning the tag on a clean machine and running the lesson's expected-output run.

## Acceptance criteria

- [ ] `<RepoLink tag="b5-l3">…</RepoLink>` and `<RepoLink tag="b5-l3" path="herramientas/editar.py">`
      render links with the right hrefs, `target="_blank"`, `rel="noopener noreferrer"`
- [ ] The base URL is in one constant; no lesson will ever carry the repository's name
- [ ] `mdx.test.ts` covers the component map entry and both href forms
- [ ] The repository exists, public, empty of code, with README / LICENSE / `.gitignore`; its
      README states the tag scheme and has a **TODO** block for the pinned versions
- [ ] `pnpm test` + `pnpm build` green

## Test plan

- Jest as above; `00-pipeline-fixture.mdx` (the `llm-agents` one from P0-03) gets a `<RepoLink>`
  so the rendering is covered by the same fixture that covers the checkpoint cells.

## Notes / gotchas

- A `RepoLink` is a **link out of the course**, like `ColabLink`, and it should look like one —
  not like a `<Leccion>`, which stays inside.
- Do not add a "download zip" alternative. A student who cannot `git clone` cannot do Block 5,
  and the prerequisites say so.
- Repository name: decided when it is created; it must not encode a product name (see the
  PLAN's product-name rule) — «agente-minimo» or similar.

## Out of scope

- Any code in the repository. P1-05 writes it, lesson by lesson.
- CI in the companion repository. It has a benchmark lesson; it does not need a pipeline.
