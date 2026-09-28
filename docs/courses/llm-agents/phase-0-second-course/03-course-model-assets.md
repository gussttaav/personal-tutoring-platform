# P0-03 — The course's model: the mini-GPT checkpoint and its train script

**Tag:** `COURSE-C2-P0-03` · **Effort:** L · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P0-01 (block titles only)

## TL;DR

Blocks 1–3 run on **the student's own model**: a decoder-only Transformer in NumPy, byte-level
BPE, trained on a small Spanish corpus. Ten seconds of NumPy under WASM cannot train it to say
anything, so it is **trained offline by a checked-in script and shipped as a pinned checkpoint**
under `public/courses/llm-agents/`. Cells load it with `open_url` (the `corpus-mar.txt`
precedent), continue training it for a few hundred steps, and generate from it. The student still
writes every line of the model — in Block 1 — and the file the cells load *is* that code.

This task decides, before any lesson is written, whether the model can carry the block. That is
the 🔴 risk in PLAN.md, and it is resolved here or the plan changes.

## Context

- `RUN_TIMEOUT_MS = 10_000` (`src/lib/courses/pyodide/protocol.ts`). Interpreter state is
  expendable; each cell is self-contained (lesson 41 of `dl-nlp` re-declares in four cells).
- `open_url("/courses/dl-nlp/corpus-mar.txt").read()` — lesson 25 loads a public asset; the
  worker's CSP allows `'self'`.
- `public/courses/dl-nlp/` holds SVG figures and one corpus. Nothing here is fetched at build time.
- The first course shipped **precomputed Word2Vec vectors** (Block 1 note: «Don't train Word2Vec
  in a code cell. Too slow in Pyodide.») — same rule, bigger object.
- `src/features/courses/widgets/corpora.ts` — `SPANISH_BOUND_CORPORA` lists widget corpora tied to
  a Spanish data asset that cannot be translated until an English asset exists. This checkpoint
  is that kind of asset.
- No Python toolchain in the repo today (`docs/courses/dl-nlp/notebooks/*.ipynb` is the only Python).
  The train script is run by the author, not by CI; its output is committed.

## Files affected

| File | Change |
|------|--------|
| `public/courses/llm-agents/minigpt.py` (new) | **The model.** `MiniGPT` config + forward + loss + backward (NumPy, from scratch, the first course's conventions), `generar` with greedy/temperature/top-k/top-p, `guardar`/`cargar` to the JSON below. Loaded in cells with `exec(open_url(...).read())` and imported by the train script. ≤ 250 lines |
| `public/courses/llm-agents/bpe.py` (new) | Byte-level BPE: `entrenar(corpus, k)`, `codificar`, `decodificar`. Lesson 1·2 writes it; this is the frozen copy |
| `public/courses/llm-agents/corpus.txt` (new) | Spanish, public domain, 200–500 KB, source + licence in a header line the loader strips |
| `public/courses/llm-agents/bpe-merges.json` (new) | The merge list, in order — the vocabulary |
| `public/courses/llm-agents/minigpt.json` (new) | Config + weights, float32 rounded to 4 decimals (or base64 float16 if the size budget forces it) |
| `scripts/courses/llm-agents/train-minigpt.py` (new) | Seeded end-to-end: BPE → windows → train → **assert the teaching properties** → write both JSON files → print the numbers the lessons quote |
| `scripts/courses/llm-agents/README.md` (new) | How to run it (`python -m venv`, `pip install numpy==<pinned>`), how long it takes, what the numbers mean |
| `src/lib/courses/__tests__/llm-agents-assets.test.ts` (new) | Parses both JSON files; asserts config shape, weight shapes match the config, merge count, and the size budget |
| `src/features/courses/widgets/corpora.ts` | Register the corpus in `SPANISH_BOUND_CORPORA` with the reason |

## The change

**Model size** is a budget, not a taste: load + one forward over a 64-token prompt + 32 generated
tokens must fit in one cell on a mid-range phone with margin. Starting point:

| | |
|---|---|
| Vocabulary | 256 bytes + 256 merges = **512** |
| Context $T_{\text{ctx}}$ | 64 |
| $d_{\text{model}}$ · heads · $d_{\text{ff}}$ · layers | 64 · 4 · 256 · 2 |
| Parameters | ≈ 135 K (tied input/output embeddings) |
| Checkpoint | ≈ 1 MB as rounded JSON — **ceiling 1.5 MB** |

**Teaching properties**, asserted by the train script and quoted by the lessons — a checkpoint
that fails one is not shipped:

1. **Held-out perplexity** under a stated bound (and the bound is what lesson 1·6 quotes).
2. **Greedy decoding repeats** within 32 tokens from at least one of three fixed prompts — so
   temperature and top-p in lesson 1·4 visibly *fix* something.
3. **Top-p at 0.9 does not repeat** on the same prompts, with the fixed seed.
4. **A 200-step SFT** on the ten-pair instruction set of lesson 2·3 changes the greedy completion
   of a held-out prompt from "continuation" to "answer" — measurable as a token-level match.
5. **The forward pass in Pyodide** on a 64-token window runs in < 1 s (measured once, on a phone,
   recorded in the README).

If 1–3 cannot be met at this size inside the checkpoint ceiling, the fallback is decided **here**:
a **character-level** model (vocabulary ≈ 100, the `dl-nlp` char-LM precedent) with BPE kept as
Block 1 lesson 2 on its own corpus. Record which path was taken in the script's header; lessons
1·3–1·6 are written against it.

**One file, two consumers.** `minigpt.py` is imported by the train script *and* `exec`'d by the
cells. That is what guarantees the forward pass the student reads is the one that produced the
weights. Keep it free of anything Pyodide lacks (no `torch`, no `numba`, no f-string `=` tricks
older Pyodide Pythons reject — pin the Pyodide version in `protocol.ts` and test against it).

## Acceptance criteria

- [ ] `python scripts/courses/llm-agents/train-minigpt.py` reproduces `minigpt.json` and
      `bpe-merges.json` byte-for-byte from the seed on two machines
- [ ] All five teaching properties assert green and their numbers are printed
- [ ] A Pyodide cell that `open_url`s `minigpt.py`, `bpe-merges.json` and `minigpt.json`, loads
      the model and generates 32 tokens with top-p completes under `RUN_TIMEOUT_MS` on a
      mid-range phone — **verified in the browser**, timing recorded in the README
- [ ] The same cell continues training for 200 steps on `corpus.txt` windows and prints a
      decreasing loss, under the cap
- [ ] `llm-agents-assets.test.ts` green; the checkpoint is ≤ 1.5 MB
- [ ] `corpus.txt` header states source and licence; the corpus is Spanish prose, not code, not
      a wordlist
- [ ] `corpora.ts` lists the corpus under `SPANISH_BOUND_CORPORA` with the English-checkpoint note
- [ ] File-top comments carry `COURSE-C2-P0-03`

## Test plan

- The script is its own test (assertions). Run it twice; `sha256sum` the outputs.
- Jest: the assets test above.
- Browser pane: the two cells from the acceptance list, in a scratch lesson under
  `content/courses/llm-agents/es/00-pipeline-fixture.mdx` (`draft: true`, permanent — the
  first course has one too; `order: 0` sorts it first).

## Notes / gotchas

- **Rounding to 4 decimals changes the model.** Assert the properties on the *rounded* weights
  the cells will actually load, not on the in-memory float64 ones.
- Pyodide's NumPy is single-threaded and slower than CPython's by a real factor; the memory note
  on PyCell numbers (BLAS differences) applies: **quote Pyodide's output** in lessons, not the
  script's, where they differ past the 4th decimal.
- `open_url` is synchronous and per-file; three fetches per cell is fine (browser-cached across
  lessons), thirty is not. Do not split the checkpoint.
- The English translation will need an English corpus and its own checkpoint. Do not design for
  it now; do write the script so a corpus path and an output directory are parameters.
- **Do not train in CI.** The assets are committed; the test checks them.

## Out of scope

- The widgets that visualise sampling or the cache (`sampling-explorer`, `kv-cache`) — built with
  their lessons; they read fixed logit vectors, not this checkpoint.
- Any lesson prose.
- A GPU, a larger model, or anything that would make "train in the browser" untrue.
