# Course 2 — Master Plan

**Feature:** the second course on gustavoai.dev, the sequel to `dl-nlp`
**Course:** *Modelos de Lenguaje: del Transformer al Agente* (slug `llm-agents`)
**English title:** *Language Models: from the Transformer to the Agent*
**Planning date:** 2026-09-15
**Tag convention:** `COURSE-C2-PN-NN` in code comments (`C2` = second course, the way
`REFACTOR-R3-…` carries its cycle). One task = one PR; one lesson = one PR inside a content task.

This plan lives in `docs/courses/llm-agents/`, beside [`docs/courses/dl-nlp/`](../dl-nlp/PLAN.md).
The shared contract — [`AUTHORING.md`](../AUTHORING.md), [`NOTATION.md`](../NOTATION.md) — stays
at `docs/courses/` and governs both; what this course does differently goes into its own deltas
(see [`docs/courses/README.md`](../README.md)). Same document conventions as before (PLAN /
STATUS / phase READMEs / per-task files), because they worked.

The design was settled in a session on 2026-09-15 (archived; its environment is gone, its
conclusions are the "Locked decisions" below). What that session estimated as "~16 files with
`dl-nlp` literal to clean up" turned out, on inspection, to be comments: the registry, catalog,
sitemap, hreflang, progress, search and JSON-LD are already course-agnostic. Phase 0 is
correspondingly smaller and more specific than that session assumed.

---

## The premise

The first course ends exactly where this one begins. Its last lesson
(`proyecto-transformer`) writes `genera(paso, go, eos, max_pasos)` and calls `paso` **«el modelo
hecho función»**; its bridge lesson (`bert-y-gpt`) keeps one column and every mask. This course
takes that decoder-only function and follows it, historically and technically, to a program that
edits code in a terminal: GPT-2 → GPT-3 → instruction tuning → RLHF/DPO → prompting → tools → the
agentic loop → a minimal coding agent.

**The tension the design has to resolve:** Pyodide cannot run an LLM. No PyTorch, no real
weights, a 10-second cap per cell (`RUN_TIMEOUT_MS`). A course about LLMs and agents that cannot
execute an LLM in the browser resolves that once, in the design — not in every lesson.

### The spine: the model is a function

Everything a coding agent does happens *around* the model: the system prompt, the tool schemas,
the loop, context management, permissions, subagents. None of it needs PyTorch. It needs

```
modelo(mensajes, herramientas) -> respuesta
```

and that signature admits three implementations, which the course uses in turn. **Every lesson
says which one it is running on.**

| Implementation | Runs in | Blocks | What it is for |
|---|---|---|---|
| **The mini-GPT in NumPy** the student trains in Block 1 (from a pinned, offline-trained checkpoint — P0-03) | Browser (Pyodide) | 1, 2, 3 | So the object is never a black box: decoding, temperature, KV cache, constrained decoding, SFT and DPO are implemented *on the student's own model* |
| **A scripted model** — a deterministic Python class that returns pre-authored tool calls | Browser (Pyodide) | 3, 4 | The agentic loop, tools, errors, permissions and memory are taught in isolation from the model's randomness, and are testable with `<CodeChallenge>` |
| **A real local model** — Ollama serving the Anthropic Messages API on `localhost` | The student's terminal | 5 | The capstone. A CLI coding agent belongs in a terminal; in the browser it would be a simulation |

This is the repo's own injection pattern (`Service → Repository interface → implementation`), and
it is pedagogically honest: the student always knows what is real and what is simulated. The
precedent for leaving the browser exists (`fine-tuning-colab`, lesson 43 of `dl-nlp`).

---

## Locked decisions

Settled in the design session or by inspection of the codebase; every task below assumes them.

| Decision | Choice | Rationale |
|---|---|---|
| Title | **«Modelos de Lenguaje: del Transformer al Agente»** | Same pattern as the first course — *discipline: from object A to object B* — and both ends are **concepts, not products**. «Programación agéntica» is 2025 jargon that will age; «Claude Code» in a title makes the course read as third-party material and expires with the next version. The first object is literally the last object of the previous course: that is what makes this a continuation, not a sequel. |
| Tagline | «Construye, desde cero y en tu propia máquina, un modelo de lenguaje moderno y el agente de programación que lo convierte en herramienta.» | «En tu propia máquina» is the Block 5 promise, stated up front. |
| Slug | `llm-agents` | Short, like `dl-nlp`. Locale-invariant, as all slugs are. |
| Level · prerequisite | **`avanzado`** · the `dl-nlp` course or equivalent (a Transformer from scratch in NumPy, backprop, cross-entropy), **plus having used a terminal** | Block 5 lives in a shell. Saying so on the landing page is cheaper than a student discovering it in block 5. |
| Where code runs | **Blocks 1–4 in the browser** (Pyodide, NumPy); **Block 5 in the terminal.** Nothing else, nowhere else. | One escape hatch, at the end, announced from the first FAQ. The first course had the same shape (Colab in its last lesson). |
| Block 5 costs the student nothing | **Ollama** (≥ 0.14, which serves the **Anthropic Messages API** locally) with `ANTHROPIC_BASE_URL=http://localhost:11434`. Default model **`qwen3:8b`** (16 GB RAM), **`qwen3:4b`** (8 GB), `gpt-oss:20b` / `qwen3-coder:30b` as an optional upper tier no lesson requires. `llama-server` (llama.cpp) documented as the runner for whoever wants no layer above the engine. | Free, local, any OS, GPU optional. And **a weaker model is better teaching**: it fails more, so strict schemas, error-as-observation, small steps and retries become necessities the student *sees* instead of bureaucracy they read about. A cloud free tier is the emergency exit, with the warning that tiers change and the course does not depend on them. |
| Provider neutrality | The student's code speaks **a protocol, not a vendor**: the Messages format with `tool_use` / `tool_result` blocks, over `urllib` + `json`. **No SDK.** | The same code runs against the cloud by changing one URL. And the message format is the one the real coding agent uses, so the comparison in the last block is between two harnesses on the same protocol and the same model. |
| Product names | «Un agente de programación en la terminal» is the object. **Claude Code is the named example** — in `reading`, in the FAQ, in the closing comparison — never in a lesson's invariants. | Product names age in months. The comparison at the end of Block 5 (the real tool pointed at the same local model) is where it earns its mention. |
| Mathematical density | **Decreases along the course, on purpose** — high in Blocks 1–2, medium in 3, low in 4–5 — and the manifest FAQ, the block-4 opener and the block-5 opener **say so**. | The title goes from maths to systems. Honest as long as it is announced; a betrayal if the student discovers it at lesson 30. |
| AUTHORING step 3 | **Redefined** in the shared contract: «Formalización» = *the precise statement*, which may be an equation, an interface (a signature + its contract) or an algorithm in pseudocode. Everything this course does differently beyond that lives in `llm-agents/AUTHORING.md`, a **delta** — the `AUTHORING.en.md` mechanism, per course. | Blocks 4–5 have no derivation. Left as «the mathematics», those blocks either fake one or drop the step — and dropping it is exactly how a lesson turns into a tutorial, which is what that file exists to prevent. A delta, not a fork, so the next course of yet another shape does the same. P0-04. |
| Cross-course references | `<Leccion curso="dl-nlp" slug="…">` — the existing component grows a `curso` attribute, validated by the same lint. | This course leans on the first one in nearly every lesson («la función que escribiste en el proyecto del Transformer»). Prose references to another course would be the same rot P7-01 removed from within a course. P0-02. |
| The model asset | The Block-1 mini-GPT is **trained offline by a checked-in script** and shipped as a pinned checkpoint under `public/courses/llm-agents/`; cells load it with `open_url`, continue training it for a few hundred steps, and generate from it. | Ten seconds of NumPy in WASM will not train a GPT that produces Spanish. The first course already shipped precomputed Word2Vec vectors for the same reason. The student still trains — from the checkpoint, watching the loss move — and still has every line of the model in a cell. P0-03. |
| Capstone code | The Block 5 program lives in a **separate public repository** (one tag per lesson), linked from each lesson with `<RepoLink>`; **the lesson text is the source of truth** and the repo is the checkpoint a student clones to catch up. | A student `git clone`s a repo; nobody clones a subfolder of a Next.js site. Same "version it deliberately" rule as the Colab notebook: tags, never `main`. P0-05. |
| Publication | Block 1 is authored `draft: true`; **the course goes public when Block 1 is complete** (all eight flipped in one PR, the P2-01 hand-off in the same release). Blocks 2–5 then publish **lesson by lesson**, as `dl-nlp` did after its launch. | The catalog shows a course from its first published lesson. One published lesson is a teaser, not a course; eight is a block someone can finish. |
| Plan location | `docs/courses/llm-agents/`, one folder per course | Own PLAN/STATUS/phases/NOTATION/deltas; the shared contract one level up. `dl-nlp`'s docs moved into `docs/courses/dl-nlp/` on 2026-09-15 for the same reason; the platform's build history stays inside that course's plan (`README.md` explains). |
| Language | **Spanish first**, English additive later, exactly as before | Translation is **not planned in this cycle** (see out of scope). Everything that made `dl-nlp`'s translation incremental applies unchanged. |
| Repository, DB, rendering, Python, access | **Unchanged** from [`docs/courses/dl-nlp/PLAN.md`](../dl-nlp/PLAN.md) | Same repo, same Supabase (`course_slug` is text — a second course is a second value), static generation, Pyodide, free with sign-in for progress. |

### Standing constraints

- Everything in the first plan's list: Vercel Hobby (non-commercial, 25 s functions, no crons),
  Supabase free tier, Node 22 via nvm.
- **`RUN_TIMEOUT_MS = 10_000`** per Pyodide cell. Not raised. A cell that needs more is a cell
  that loads a checkpoint (P0-03) or moves to Block 5.
- **No network from a cell** beyond `open_url` against `public/`. The browser never talks to a
  model server; Block 5 is where the student's own machine does.
- **The student's machine for Block 5:** 16 GB RAM, ~6 GB disk, any OS, GPU optional. Stated in
  the FAQ. The 8 GB path (`qwen3:4b`) exists and every Block 5 lesson is verified on it too.
- The two locales' message files stay key-for-key in sync; every widget string goes through
  `courses.widgets.<id>` (AUTHORING §7) — new widgets are born bilingual even while the lessons
  are Spanish-only.

---

## Phases

| # | Phase | Tasks | Ships |
|---|-------|-------|-------|
| 0 | **[Second course](phase-0-second-course/README.md)** | 5 | Manifest + «soon» landing, cross-course `<Leccion>`, the mini-GPT checkpoint + train script, the authoring contract for a systems course, terminal-lesson affordances (`<RepoLink>`, companion repo). |
| 1 | **[Content](phase-1-content/README.md)** | 5 | The five blocks, ~40 lessons, ten new widgets built with their lessons. |
| 2 | **[Launch](phase-2-launch/README.md)** | 2 | The hand-off from `dl-nlp` (its last bridge and landing point here), the «new course» announcement over the existing opt-in. |

Roughly the cost of `dl-nlp`, which took July → September: one week of Phase 0, then content at
the `/course-lesson` cadence. **The widgets are the expensive part** (ten, versus the first
course's eighteen); the prose has a rehearsed process.

### Order & dependencies

```
P0-01 (manifest) ──┐
P0-02 (curso=)   ──┤
P0-03 (checkpoint)─┼──► P1-01 ──► P1-02 ──► P1-03 ──► P1-04 ──► P1-05
P0-04 (authoring)──┤        │                                      ▲
P0-05 (RepoLink) ──┘        └──► P2-01 (hand-off, at Block 1 launch)│
                                                                   │
                                        P2-02 (announcement) ──────┘ (at course completion)
```

- **P0-01, P0-03 and P0-04 block Block 1.** No lesson is written without the manifest (the
  prerequisites the lessons may assume), the checkpoint (the object the lessons run) and the
  contract (what a lesson without a derivation looks like).
- **P0-02 blocks the first lesson too** — its opening picks up `dl-nlp`'s last bridge by
  reference.
- **P0-05 can land any time before Block 5**, but the `<RepoLink>` component is trivial and the
  companion repo's layout is decided by Block 4's project lesson, so do it in Phase 0 and keep
  the repo empty until P1-05.
- Blocks are written **in order**: the bridges interlock, and each block's project is the next
  block's starting object.
- **P2-01 ships with Block 1's publication**, not after Block 5 — the day this course is public,
  `dl-nlp`'s closing bridge points at it.

---

## Architecture at a glance

Nothing new. The first course's diagram holds with `llm-agents` in place of `dl-nlp`:

```
content/courses/llm-agents/      ← prose (MDX), per locale, git-versioned
public/courses/llm-agents/       ← the mini-GPT checkpoint, BPE merges, corpus (P0-03)
        │
        ├─ registry (build time) ─────► sidebar · syllabus · sitemap · search index
        └─ MDX body (build time) ─────► static HTML + KaTeX + Shiki
                                              │
                                        client islands: widgets · PyCell · Quiz
                                              │
                                     POST /api/courses/progress   (course_slug = "llm-agents")
```

What Phase 0 adds, and where:

| Piece | Lives in | Why it is new |
|---|---|---|
| `<Leccion curso="…">` | `src/lib/courses/Leccion.tsx`, `validate-crosslinks.ts` | References across courses did not exist; the lint scopes by `<course>/<locale>` directory |
| Checkpoint + train script | `public/courses/llm-agents/`, `scripts/courses/llm-agents/` | A model a cell can load in 10 s but could not train in 10 s |
| `<RepoLink tag="…">` | `src/lib/courses/mdx-components.tsx` | The terminal-lesson analogue of `<ColabLink>` |
| Second `heroMotif` | `src/features/courses/HeroMotif.tsx`, `CourseHeroMotif` | Optional; the manifest may omit it |

---

## Course structure (`llm-agents`)

Five blocks, a bridge block in fourth position, a project per block, and the historical thread
carried by each lesson's `reading` — exactly the first course's shape.

| Block | Title (es) | Years | Maths | Runs on | Lessons |
|---|---|---|---|---|---|
| 1 | Del Transformer al modelo de lenguaje | 2018–2022 · GPT-1/2/3, Kaplan, Chinchilla | high | mini-GPT | 9 |
| 2 | De predecir texto a seguir instrucciones | 2017–2023 · Christiano, InstructGPT, Constitutional AI, DPO | high | mini-GPT · Colab | 8 |
| 3 | Hablar con el modelo es programar | 2020–2023 · CoT, RAG, evals | medium | mini-GPT · scripted | 7 |
| 4 | El puente: de texto a acciones | 2022–2024 · ReAct, Toolformer, function calling | low (and says so) | scripted | 7 |
| 5 | Un agente de programación en la terminal | 2024–2025 · SWE-bench, coding agents, MCP | engineering | Ollama, terminal | 9 |

**Block 4 exists for the same reason the first course's Block 4 exists.** Courses jump from
"chat" to "agent" as if the step were obvious, the way they jump from the context bottleneck to
attention. It is not obvious: the environment is the other half of the agent, errors are
observations, and a permission gate is a design decision. Seven lessons, in pure Python, on a
scripted model, with code challenges — and no new maths.

**Block 5 is nine lessons that each add one layer** to the same program: the real model behind
the `Modelo` interface; the file tools with their schemas; the system prompt and the project file;
compaction when the (deliberately 8K) window fills; permissions and a sandbox; subagents; a
mini-benchmark; then the protocol for tools (MCP) and the signpost to reasoning models and RL on
agents. The last lesson points the real coding agent at the same local model and runs the same
benchmark — «construir un Claude Code» stops being a metaphor and becomes a measured comparison.

### New widgets (ten, built with their lessons — AUTHORING §7)

| Id | Block · lesson | Shows |
|---|---|---|
| `bpe-merges` | 1·2 | The merge table growing step by step over a Spanish corpus; the vocabulary as compression |
| `sampling-explorer` | 1·4 | One logit vector → the distribution after temperature, top-k, top-p; what each cut discards |
| `kv-cache` | 1·5 | Generation token by token with the cache growing; per-step cost with and without it |
| `scaling-laws` | 1·7 | Loss vs. parameters / data / compute on log axes; the Chinchilla-optimal split for a compute budget |
| `chat-template` | 2·2 | A messages list ↔ the token string the model actually sees; which positions carry loss |
| `bradley-terry` | 2·4 | Two responses, two rewards, $\sigma(r_A - r_B)$; the preference probability as the gap moves |
| `dpo-loss` | 2·6 | The DPO objective as a function of the two log-ratios and $\beta$; the gradient weight that "goes quiet" |
| `logit-mask` | 3·3 | Constrained decoding: the grammar's allowed set masking the distribution position by position |
| `context-window` | 3·5, 4·6, 5·5 | The window as a bar: system prompt, history, tool outputs filling it; what compaction removes |
| `agent-loop-trace` | 4·3, 4·7 | The loop as a stepped trace: model call → `tool_use` → execution → `tool_result` → … → text |

`sampling-explorer` and `logit-mask` share their maths (`math/sampling.ts`); `context-window` is
the one widget that appears in three blocks, because the resource it shows is the one that
constrains all three.

### Assets

| Asset | Where | Made by |
|---|---|---|
| `minigpt.json` (weights, config) · `bpe-merges.json` · `corpus.txt` | `public/courses/llm-agents/` | `scripts/courses/llm-agents/train-minigpt.py`, offline, seeded, NumPy only (P0-03) |
| `minigpt.py` — the reference implementation cells `exec` after `open_url` | `public/courses/llm-agents/` | Written in Block 1, frozen at the block's project lesson |
| Companion repository (Block 5), one tag per lesson | separate public repo | P0-05 creates it empty; P1-05 fills it lesson by lesson |
| SFT notebook (Block 2 project) | `docs/courses/llm-agents/notebooks/` | P1-02, same rules as `fine-tuning-beto.ipynb` |

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **The checkpoint is too weak to teach with** — a 2-layer NumPy GPT on a small Spanish corpus produces text that makes temperature, top-p and SFT look like noise on noise | 🔴 | P0-03 fixes the teaching properties *before* Block 1 is written and asserts them in the train script: perplexity on held-out text under a stated bound, greedy output that repeats (so sampling visibly fixes something), a prompt-completion pair that SFT visibly changes. If the properties cannot be met inside the Pyodide load budget, the fallback is a **character-level** model (the `dl-nlp` char-LM precedent) and BPE stays a Block 1 lesson on its own. Decided in P0-03, not in lesson 3. |
| **Block 5 rots** — Ollama's API surface, model tags and quantisations change in months | 🔴 | Every Block 5 lesson pins the Ollama version and model tag it was verified on, in a `<Callout>` the student reads first; the companion repo pins the same; P1-05's acceptance criteria include re-verifying the whole chain on the day the block ships. The student's code speaks the Messages format over `urllib`, so a runner change is a URL, not a rewrite. |
| **Content volume** — ~40 lessons and ten widgets, again the dominant cost | 🔴 | The authoring loop is rehearsed; the budget, lint and `/course-lesson` exist. Widgets are built with their lessons, never deferred (the `lstm-gates` lesson). |
| **Block 5 cannot be verified in the browser pane** — no Pyodide, no `pnpm build` proves a terminal lesson | 🟠 | Each Block 5 lesson's test plan is a clean-machine run (the Colab-notebook rule): fresh venv, the pinned Ollama, the 8 GB and 16 GB model, on the tag the lesson links. Recorded in the lesson's task checklist. |
| **Two authoring shapes in one course** — a derivation lesson and a terminal lesson look nothing alike, and the second reads as a tutorial | 🟠 | P0-04 redefines step 3 and adds the "what a Block 5 lesson's six steps are" table to AUTHORING; the block-5 lint check for the six-step names still applies; every terminal lesson still has a *precise statement* (the interface or the algorithm) before its code. |
| **The scripted model reads as a toy** and Block 4 loses the student | 🟠 | Block 4's opener says why it is scripted (determinism, testability, isolation from the model's randomness), and Block 5's first lesson replaces it with the real one in the *same* loop — the payoff is that nothing else changes. |
| **Slow local models make Block 5 tedious** — a 7–8B model on CPU is "acceptable", not fast | 🟠 | Tasks are small on purpose and the author says so («he dejado el repo así de pequeño adrede»): fix a failing test in a five-file repo, add a function with its test. Never SWE-bench. The window fixed at 8K makes compaction *happen* on the second task. |
| **Cross-course references invalidate on `dl-nlp` edits** — an `ancla` into a first-course heading breaks when that lesson is retitled | 🟡 | Same failure mode the lint already turns fatal within a course; P0-02 extends it across courses so it fails the build, not the reader. Prefer `curso=` references without `ancla`. |
| **Prompt-injection through tool results** taught wrong or skipped | 🟡 | It is a lesson (4·5), not a callout: tool output is untrusted content, permissions are per tool class, and the sandbox is a principle before it is a `chroot`. |

---

## Explicitly out of scope

- **Training or serving an LLM at any real scale.** The largest thing the student trains is a
  NumPy mini-GPT from a checkpoint (browser) and a ~0.5B SFT in Colab (Block 2 project).
- **PPO in full.** RLHF (2·5) derives the KL-regularised objective and the policy-gradient
  intuition; PPO's clipping is a signpost in `reading`. DPO is the derivation the block owns.
- **A vendor SDK.** Not even as an appendix. `urllib` + `json` is the point.
- **A web UI for the agent.** It is a terminal program. A chat UI would be a third project.
- **Multi-agent orchestration frameworks, "agentic RAG", agent marketplaces.** Subagents (5·7) is
  as far as it goes: one loop inside another, with a fresh context.
- **English content.** The manifest ships bilingual (`course.en.yml`, P0-01) so `/en/cursos`
  lists the course honestly, as it did for `dl-nlp` before Phase 11. Translating the lessons is a
  later cycle with the same shape as `dl-nlp`'s Phase 11 — the mini-GPT would need an English
  corpus and checkpoint (`SPANISH_BOUND_CORPORA` precedent), which is the one thing that is not
  purely additive and is noted in P0-03.
- **Paid access, certificates, video, comments** — unchanged from the first plan.
- **Splitting the platform's build history out of `dl-nlp`'s plan.** Phases 1–4, 6, 9 and 10
  built the machinery every course uses, inside the first course's tracker. They stay there;
  `docs/courses/README.md` says where platform-only work would go if it ever needs a home.

## Open decisions (recorded, not blocking)

- **The 8K window in Block 5 (lesson 5·5):** fixed in the lesson, or chosen when the full chain
  is first run end-to-end before writing? Recommendation: run the chain first (P1-05's
  "chain test" gate), then fix the number in the lesson and in the companion repo's config, so
  the lesson can say «en la segunda tarea se dispara» and be right.
- **Second hero motif.** The manifest may omit `heroMotif`; a second motif (the loop, or a
  merge table) is a design task nobody depends on. P0-01 leaves it optional.
- **Companion repository host and name.** Public GitHub under the author's account is the default;
  the name is decided in P0-05 and never appears in a lesson invariant (it is a `<RepoLink>`
  base URL in one constant).
