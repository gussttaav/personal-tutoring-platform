# P0-04 — The authoring contract for a systems course

**Tag:** `COURSE-C2-P0-04` · **Effort:** M · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P0-01

## TL;DR

[`AUTHORING.md`](../../AUTHORING.md) was written for a course where every lesson has a
derivation. Blocks 4 and 5 of this one have none: they have a contract, a protocol, an algorithm.
Left as is, step 3 («Formalización — the mathematics») makes those blocks either fake a
derivation or skip the step — and skipping it is precisely how a lesson becomes a tutorial, which
is the failure that file exists to prevent.

Two files change, in two different ways. The **shared** contract gets the one rewrite that is
true of every course (step 3 is *the precise statement*) and loses the `dl-nlp`-only assumptions
it still carries. Everything this course does *differently* goes into **its own deltas** —
`llm-agents/AUTHORING.md` and `llm-agents/NOTATION.md` — the mechanism [`README.md`](../../README.md)
fixes for every course after this one. Plus the template and the `/course-lesson` header rule.

## Context

- AUTHORING §1 step 3: «**Formalización** — the mathematics. Complete, not hand-waved.» Step 4:
  «**Implementación** — NumPy from scratch, in a `<PyCell>`». Both are literally true for
  `dl-nlp` and for Blocks 1–2 here, and false for Blocks 4–5.
- AUTHORING §2 quotes `dl-nlp`'s three prerequisites as *the* prerequisites; §5's terminology
  table is `dl-nlp`'s vocabulary; §7 lists widget ids inline although `widget-ids.ts` is the
  authority. None of this is wrong for the first course; all of it is single-course.
- `docs/courses/NOTATION.md` is already split (2026-09-15): the shared rules there, the symbol
  tables in `dl-nlp/NOTATION.md`. §5 of the shared file names `llm-agents/NOTATION.md` as
  «seeded by this task».
- `content/courses/dl-nlp/_template.mdx` — the copy-paste start; `content-files.ts` skips any
  file starting with `_`, in any course.
- `.claude/commands/course-lesson.md` is already course-agnostic: it resolves the course from
  the task md's path and reads the block header (course, shape, model, publication). It expects
  a course `AUTHORING.md` / `NOTATION.md` delta *beside* the plan when one exists.
- `src/lib/courses/budget.ts` counts `<PyCell>` only. Fenced `python`/`bash` blocks (Block 5's
  medium) are dropped from the word count and not measured at all — a 140-line fenced wall
  triggers nothing.

## Files affected

| File | Change |
|------|--------|
| `docs/courses/AUTHORING.md` (shared) | §1: steps 3 and 4 rewritten as below — course-neutral; §2: «the prerequisites are the manifest of the course you are writing» (the `dl-nlp` list becomes the example, not the rule); §2/§7: the `curso=` rules (four bullets from P0-02); §5: the terminology table moves to `dl-nlp/AUTHORING.md` with a pointer «one table per course»; §7: replace the inline widget-id list with «see `widget-ids.ts`» + the rule; §7: `<RepoLink>` (P0-05); §9: the course directory is a parameter. **Nothing else** |
| `docs/courses/dl-nlp/AUTHORING.md` (new, delta) | The terminology table and the three-prerequisite list, verbatim from where they were — the first course's deltas, so the shared file stops carrying them |
| `docs/courses/llm-agents/AUTHORING.md` (new, delta) | The «two shapes» table below; the rule that every lesson names which `modelo` it runs on; Block 5's step-4/step-5 forms (fenced code + `<RepoLink>`, a reproduced run with expected output); this course's terminology table (seeded: *harness*, *herramienta*, *llamada*, *observación*, *turno*, *entorno*, *permiso*, *compactación*, *sandbox*, *subagente*, *protocolo*); the product-name rule |
| `docs/courses/llm-agents/NOTATION.md` (new) | The five block sections, seeded as below and filled lesson by lesson, in `dl-nlp/NOTATION.md`'s shape; a note on the $\mathbf{q}$ collision |
| `docs/courses/NOTATION.md` (shared) | §4: reserved symbols this course adds that must not be reused anywhere ($\pi_\theta$, $\pi_{\text{ref}}$, $r_\phi$, $\beta$ as the KL coefficient); §5: the `llm-agents` bullet becomes a link |
| `docs/courses/AUTHORING.en.md` | One paragraph: the delta mechanism now has three members (language, and one per course); nothing else changes |
| `content/courses/llm-agents/_template.mdx` (new) | Copy of the `dl-nlp` template with: a comment block on the two shapes; `hasCode` comment noting Block 5 lessons are `false`; a commented `<RepoLink>` example |
| `src/lib/courses/budget.ts`, `scripts/lint-content.ts` | **Optional, advisory:** a `longestFence` axis — lines in the longest fenced code block — same 45 / 90 thresholds as `longestCell`, warning only. Skip if it costs more than an hour; note it in Deviations |

## The change

### Steps 3 and 4, rewritten (shared)

> 3. **Formalización** — *the precise statement.* For a mathematical object, the mathematics:
>    complete, not hand-waved, `<Details>` for the longest derivations. For a system, the
>    **interface** — a signature and the contract it keeps — or the **algorithm**, in pseudocode
>    short enough to hold in one screen. What the step never is: a paraphrase of the intuition
>    with symbols sprinkled in, or a description of what the code below "basically does". After
>    this step the reader could implement it without reading step 4.
> 4. **Implementación** — the statement made to run, in the form the course's delta names.
>    The default is a `<PyCell>` the student executes in the browser.

### The two shapes of a lesson (`llm-agents/AUTHORING.md`)

| Step | Derivation lesson (Blocks 1–2, most of 3) | Systems lesson (Block 4, Block 5) |
|---|---|---|
| Motivación | the question | the question — often «why isn't this obvious?» |
| Intuición | pictures, a widget | a trace: what happens, turn by turn (`agent-loop-trace`, `context-window`) |
| Formalización | the equations, derived | the interface or the algorithm, stated; its invariants named |
| Implementación | `<PyCell>`, NumPy | `<PyCell>` on the scripted model (Block 4) · fenced code + `<RepoLink>` (Block 5) |
| Verificación | quiz + challenge | quiz + challenge (Block 4) · quiz + a **run the student reproduces** with expected output shown (Block 5) |
| Puente | the next lesson's question | the next layer's need — what breaks without it |

The `lint:content` check on step names as headings applies to both; so does «two to four `##`
headings, all describing content».

### `llm-agents/NOTATION.md` — the seed

To be completed as lessons land, like the first course's; this is the seed so lesson 1 does not
decide notation on its own.

- **Block 1:** $\theta$ the model's parameters; $p_\theta(x_{t+1} \mid x_{\le t})$; $\mathbf{z}_t
  \in \mathbb{R}^{|V|}$ logits; $\tau$ temperature; $k$, $p$ the top-k / top-p cut-offs; $\mathcal{K}_l$,
  $\mathcal{V}_l$ the cached keys/values of layer $l$; $T_{\text{ctx}}$ the context length;
  $\text{PPL}$ perplexity; $N$, $D$, $C$ parameters, tokens, compute (Kaplan's letters);
  $\alpha_N$, $\alpha_D$ the scaling exponents.
- **Block 2:** $\pi_\theta$ the policy (the model as a distribution over responses); $\pi_{\text{ref}}$
  the reference; $r_\phi$ the reward model; $y_w \succ y_l$ chosen over rejected; $\beta$ the KL
  coefficient; $\mathbb{D}_{\text{KL}}$; $\sigma$ stays the sigmoid (reserved in the shared §4).
- **Block 3:** $\mathbf{q}$, $\mathbf{d}_i$ query and document embeddings (retrieval — and note the
  collision with attention's $\mathbf{q}$, resolved by context and said once); $\mathcal{G}$ a grammar,
  $A_t \subseteq V$ the allowed set at position $t$; $\hat{s}$ a score, $\text{acc}$ accuracy.
- **Block 4:** no new mathematics. Object-language words (shared §6): *herramienta*, *llamada*,
  *observación*, *turno*, *entorno*, *permiso*; the loop's state $M$ (the messages list) in
  pseudocode only.
- **Block 5:** none. Object language: *harness*, *compactación*, *sandbox*, *subagente*,
  *protocolo*. Product names only in `reading`.

## Acceptance criteria

- [ ] Shared AUTHORING §1 carries the rewritten steps 3–4 and nothing else in §1 changed
      (diff-checked); §2, §5, §7, §9 no longer assume one course
- [ ] `dl-nlp/AUTHORING.md` holds exactly what left the shared file, and the `dl-nlp` tree reads
      the same contract as before (the three prerequisites + the terminology table are one hop
      away, not gone)
- [ ] `llm-agents/AUTHORING.md` carries the two-shapes table, the model-callout rule, the Block 5
      forms, the seeded terminology, the product-name rule — and says what it replaces
- [ ] Shared NOTATION §4 has the new reserved symbols; `llm-agents/NOTATION.md` has five block
      sections, seeded as above, with the $\mathbf{q}$ collision note
- [ ] `content/courses/llm-agents/_template.mdx` exists and `pnpm lint:content` ignores it
- [ ] `/course-lesson` read against `docs/courses/llm-agents/phase-1-content/01-block-1-modelo-de-lenguaje.md 1`
      resolves `content/courses/llm-agents/es/` and both deltas — verified by reading the
      command, not by authoring a lesson
- [ ] `README.md`'s «Which file governs» order is still true after the split
- [ ] If `longestFence` was added: `budget.test.ts` covers it and it is advisory
- [ ] `pnpm lint:content` green on the unchanged `dl-nlp` tree (this task changes no lesson)

## Test plan

- `pnpm lint:content` on the current tree before and after — identical output, or only the new
  advisory axis.
- Read the rewritten §1 plus the `llm-agents` delta against Block 5's lesson 5·5 (compaction)
  *as a sketch*: can its six steps be named without a derivation? If not, the table is wrong.

## Notes / gotchas

- **A delta replaces only what it names.** If `llm-agents/AUTHORING.md` ends up restating the
  budget or the voice rules, it has stopped being a delta; cut it back.
- The rule «a widget a lesson calls for is built in the same task» stands, in the shared file.
  Ten widgets in Phase 1 are ten lesson PRs that also carry a component, its maths and its tests.
- `minutes`: a Block 5 lesson's reading estimate excludes the time the student spends waiting for
  a local model. Say so in the lesson (`<Callout>`), not in the estimate — a delta rule.

## Out of scope

- Changing the budget targets. Same numbers, both courses.
- Any lesson prose, including lesson 1.
