# P3-08 — Block 5: A Coding Agent in the Terminal

**Tag:** `COURSE-C2-P3-08` · **Size:** XL · **Status:** not started
**Depends on:** P3-07 · the `en` branch of `agente-minimo` (D1) · the pinned chain installable
**Course:** `llm-agents` → `content/courses/llm-agents/en/` · **Runs on:** a local model over the
Messages API, in the student's terminal: Ollama 0.40.13, `qwen3:4b-instruct`, the 8K `Modelfile`

## TL;DR

Nine lessons, no `<PyCell>`, and the most expensive block to translate by a wide margin. Not
because the prose is hard, but because **everything the lessons quote is a measurement**: the
model's replies, its failures, token counts, timings, a compaction that fires on the second task,
and lesson 39's success rates with Wilson intervals over a five-task benchmark. All of it was
measured with Spanish code, a Spanish `AGENTE.md`, Spanish requests and Spanish data. The English
lessons re-run every one of those against English code on an `en` branch of the same
repository, cut lesson by lesson into `en-` tags exactly as the Spanish ones were. Two lessons are rewrites, because their finding *is* the
language.

## Classification

**Planning pass, 2026-11-13. P3-00 replaces this table.** `es/32` … `es/40` are 5·1 … 5·9. Every
lesson links two `<RepoLink>` tags (where it starts, where it ends).

| # | Slug | Class | Re-run | What binds it to Spanish |
|---|---|---|---|---|
| 5·1 | `preparar-la-maquina` | adapt | T | Install, `Modelfile`, the first Messages request over `urllib` and its quoted reply; `protocolo.py` (tag `b5-l1`). Timings and token counts quoted |
| 5·2 | `el-bucle-con-un-modelo-real` | **rewrite** | T | The Block 4 loop behind the real model. Part of its argument is that `bucle.py` **translates roles into English** (`user`, `assistant`) for the protocol, and a quiz option turns on it; in English there is nothing to translate. And its run shows the model replying **in English**, without a single call, to a Spanish request (line ~443): a failure an English run cannot produce. Replacement: the failure the English run of the same request actually shows |
| 5·3 | `herramientas-de-ficheros` | adapt | T | Read / search / edit / run with their schemas, the course's longest lesson (4 905 words, 23 fences). Tool descriptions are prompt text the model reads; every transcript re-run |
| 5·4 | `prompt-de-sistema-y-fichero-de-proyecto` | **rewrite** | T | The worked system prompt is «Escribe en español, aunque el código esté en inglés», and a quiz asks where «Escribe en español.» belongs (system prompt vs project file). In English that instruction says nothing. Replacement: a deployer-level instruction with the same property (it binds every repository, so it is not the project file's) that changes the English run visibly. `AGENTE.md`'s English name is P3-03's |
| 5·5 | `compactacion` | adapt | T | The 8K window fills on the second task; the `context-window` preset `compactacion` carries **measured** sizes (system 189, tools 705, project 123, request 27 tokens, nine turns) from the Spanish trace. The English preset is measured from the English trace, and the prose's "it fires on the second task" must still be true |
| 5·6 | `permisos-y-sandbox` | adapt | T | The sandbox and the command list; denial messages and transcripts. 31 `<W>` |
| 5·7 | `subagentes` | adapt | T | The subagent's own system prompt and `encargo`; its summary is model output |
| 5·8 | `mini-benchmark` | adapt | T (+ Kaggle) | `banco/`: five tasks (`1-tiempos`, `2-despensa`, `3-renombrar`, `4-anadir`, `5-proyecto`), each a repo, a `pedido.txt` («Los tests fallan. Arregla tiempos.py para que pasen.»), a grader and a solution; `medir.py`. Three rows, every rate and interval re-measured on the English benchmark (D3): your harness on `qwen3:4b-instruct` locally (3 of 15), and two Kaggle rows, your harness on `qwen3:8b` (5 of 15) and Claude Code 2.1.318 on the course's model at 32K (1 of 3, up to 1.5 h per attempt). The paired-difference argument and the failure counts (tests run, false «done», rejected `edit` quotes) are re-counted from the English logs |
| 5·9 | `mcp-y-lo-que-viene` | adapt | T | `servidor_incidencias.py` over `incidencias.json`, whose issues are Spanish data («falta() no ignora los espacios…»). One `curso="dl-nlp"` ref. The "what comes next" half transposes |

**Block totals (planning pass):** 0 transpose · 7 adapt · 2 rewrite · re-runs T ×9.

## D1 — the English companion repository: an `en` branch (decided 2026-11-13)

The Spanish lessons say «la lección es la fuente de verdad; el repositorio es la copia». An English
lesson's code is English (`AUTHORING.en.md` §7, P3-03's identifier map), so the Spanish tags are no
longer its copy.

**Gustavo's decision: no new repository.** The English code lives in `agente-minimo` itself, on a
branch `en`, with one tag per English lesson: `en-b5-l1` … `en-b5-l9`. `LLM_AGENTS_REPO_BASE` stays
one URL; the English lessons write `<RepoLink tag="en-b5-l3">` where the Spanish ones write
`tag="b5-l3"`, and P3-01's lint fails a tag in the wrong locale's tree.

How the branch is built:

- **`en` starts from an empty tree, not from `main`**, and is never merged into `main` (nor `main`
  into it). The two histories share only the repository: a Spanish file left over on `en` would be
  exactly the half-translated tell §7 exists to prevent. Create it with `git switch --orphan en`.
- **Its first commit holds what the Spanish `main` held before `b5-l1`**: the `README.md` (in
  English, saying the Spanish code is on `main` with tags `b5-l*`), `LICENSE`, `.gitignore`, the
  `Modelfile` (byte-identical: the chain is pinned) and the English descendants of Block 4's
  `entorno.en.py` and `permisos.en.py` under P3-03's file names.
- **Each `en-b5-lN` tag is cut from the reviewed English lesson's code**, as in Phase 1: the branch
  grows with the block, never ahead of it. One commit per lesson, message `en-b5-lN: <English
  title> (COURSE-C2-P3-08)`.
- **`main` gets one change**: its README's "*English: the lessons are in Spanish*" line is replaced
  by a pointer to the `en` branch and its tags, once `en-b5-l1` exists. Nothing else on `main` or
  under a `b5-l*` tag moves.
- **The student clones a tag**, so the instructions in the English lessons read `git clone --branch
  en-b5-lN …`, exactly as the Spanish ones name `b5-lN`. `--branch` takes a tag; the lesson never
  names the `en` branch itself, which moves.

Pushing the branch and its tags to GitHub is a publication to a public repository: ask before each
push, as for the Spanish tags.

## D3 — lesson 39's two Kaggle rows

The Spanish table has three rows. The first was measured on the author's laptop and is re-run with
the rest of the block. The other two were measured on a free Kaggle CPU notebook: the student's
harness on a bigger model (`qwen3:8b`, 15 attempts), and the real coding agent (Claude Code
2.1.318, its own 32K `Modelfile`) on the course's model (3 attempts, each up to an hour and a half;
its first request alone took half an hour).

**Gustavo's decision (2026-11-13): re-measure both** against the English `banco/`, with the same
notebook recipe and the same pinned versions (`qwen3:8b`; Claude Code 2.1.318 and its 32K
`Modelfile`): headless Save & Run All, never interactive (memory: Kaggle CPU runs). Budget it as the
block's longest single run. The Spanish rows are **never** quoted in the English lesson: a table of
English measurements with Spanish rows in it would make the lesson's paired comparison meaningless.
If a Kaggle run cannot be done, stop and bring it back rather than falling back to the Spanish
numbers.

## Lesson progress

- [ ] 5·1 `preparar-la-maquina`
- [ ] 5·2 `el-bucle-con-un-modelo-real`
- [ ] 5·3 `herramientas-de-ficheros`
- [ ] 5·4 `prompt-de-sistema-y-fichero-de-proyecto`
- [ ] 5·5 `compactacion`
- [ ] 5·6 `permisos-y-sandbox`
- [ ] 5·7 `subagentes`
- [ ] 5·8 `mini-benchmark`
- [ ] 5·9 `mcp-y-lo-que-viene`

## How a Block 5 lesson is translated

The Phase 1 recipe, in English, per lesson:

1. Start from the previous English tag (5·1: from Block 4's English modules).
2. Write the English lesson's code, against P3-03's identifier map.
3. Run it on the pinned chain from a fresh clone; capture every transcript, count and timing the
   Spanish lesson quotes **in the English run's own terms**. Keep the raw run log beside this md,
   as `08-lessonNN-runs-<date>.log`, like Phase 1's `05-lessonNN-runs-<date>.log`.
4. Write the prose against what the run did. Where the English run did something the Spanish one
   did not (a different failure, a different number of turns), the lesson describes the English run.
   If the difference breaks the lesson's argument (5·5's compaction not firing on the second task),
   **stop and bring it back**: it is a design question, not a translation one.
5. Cut the English tag from the reviewed lesson's code.

## Decisions fixed by a translated lesson

*Empty until the first lesson lands. Expect: the English `AGENT.md` text (5·4), the English
`banco/` requests (5·8), the English `incidencias.json` (5·9).*

## Acceptance criteria

- [ ] Every lesson under `content/courses/llm-agents/en/`, `draft: false`; ids identical
- [ ] The `en` branch of `agente-minimo` holds nine tags `en-b5-l1` … `en-b5-l9`, each cut from its
      reviewed English lesson; `main` and the `b5-l*` tags unchanged but for `main`'s README pointer
- [ ] Every English lesson's code is verified from a fresh clone of its English tag on the pinned
      chain; every transcript, count and timing it quotes is from those runs, with the logs kept
- [ ] The `compactacion` preset is the English trace's measured sizes, and compaction still fires on
      the second task
- [ ] Lesson 39's three rows are all measurements of the English benchmark, the two Kaggle rows
      re-run there (D3)
- [ ] Each lesson's opening `<Callout>` pins the same chain as its Spanish lesson
- [ ] Every `<RepoLink>` in an English lesson names an `en-b5-l*` tag that exists and opens on
      GitHub; every Spanish lesson's links unchanged
- [ ] Two-reader test against the English neighbours; `pnpm lint:content` clean; `pnpm build` green
- [ ] **Phase exit** (README): `fullyTranslated` true for `en`; no fallback `noindex`; hreflang
      reciprocal for all 40; `SPANISH_BOUND_CORPORA` holds no `llm-agents` entry

## Test plan

- Per lesson: the run above, then `lint:content` and a read at 360px (Block 5 has the course's
  longest fences, and the `longestFence` budget warns on them).
- 5·8: `medir.py` on the English `banco/`, the same number of repetitions as Spanish; the
  `tests/test_banco.py` property (each grader gives 0 to the untouched repo and 1 to the solution)
  for every English task.
- After 5·9: `/en/cursos/llm-agents` shows no untranslated notice; three lesson pages spot-checked
  for `noindex` gone and hreflang reciprocal.

## Gotchas

- **Stop Ollama before `pnpm build`** and detach long runs with `setsid nohup` (memory: Block 5
  run quirks; background jobs die with the session). An 8K-filling run takes 30–50 minutes.
- **Ollama ignores `tool_choice`.** The Spanish lessons were written knowing it; the English runs
  inherit the same behaviour.
- **`pkill -f` can kill the session's own shell** (memory). Stop the server by PID.
- **The model's sampling is not seeded across runs** the way Pyodide is. A single English run that
  happens to differ from the Spanish story is not a finding until it repeats; 5·8's repetitions are
  the model for how many runs a claim needs.
- **Ollama 0.40.13 must still be installable.** If not, stop: re-pinning changes the Spanish lessons
  too (README, out of scope).

## Out of scope

- Changing `main` or any `b5-l*` tag of `agente-minimo` beyond `main`'s README pointer.
- Re-pinning Ollama or the model.
- The real coding agent's own version, beyond pinning it in 5·8 as the Spanish lesson does.
