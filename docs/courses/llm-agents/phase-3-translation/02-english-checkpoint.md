# P3-02 — The English mini-GPT

**Tag:** `COURSE-C2-P3-02` · **Size:** L · **Status:** not started
**Depends on:** P3-03's identifier table (the names `bpe.en.py` and `minigpt.en.py` use)

## TL;DR

Pick an English public-domain corpus against the teaching properties
`scripts/courses/llm-agents/train-minigpt.py` asserts, make the script train in either language,
and ship the English siblings beside the Spanish assets: `corpus.en.txt`, `bpe-merges.en.json`,
`minigpt.en.json`, plus `bpe.en.py` and `minigpt.en.py`, the two modules the trainer imports. Every
Spanish file stays byte-identical. This is [COURSE-C2-P0-03](../phase-0-second-course/03-course-model-assets.md)
run a second time in another language, and it is the phase's one hard prerequisite: Block 1
lesson 2 trains BPE on the corpus in a cell.

## Context

`train-minigpt.py` already takes `--corpus` and `--salida`, and its README anticipated this
("la versión inglesa necesitará el suyo"). What it does **not** parameterise is everything that
makes the properties Spanish:

| Constant | Spanish value | Why it binds |
|---|---|---|
| `PROMPTS` | `["La Nela", "—¿Qué", "El sol se"]` | Property 2 (greedy repeats) and 3 (top-p does not) are asserted on these; 1·4 and 1·5 quote the first |
| `SFT_PARES`, `SFT_RESERVADO` | ten «¿De qué color es …?» pairs; «la tierra» held out | Property 4; lesson 2·3 is built on these pairs |
| `PLANTILLA` | `"Pregunta: {}\nRespuesta:"` | The SFT format, quoted in Block 2 |
| `PLANTILLA_RESPUESTA` | `^ (El\|La) [^\W\d_]+ es [^\W\d_]+\.` | Property 4b; and 4a counts the **agreeing article** as the first token learned |

and the two modules it imports by path (`bpe.py`, `minigpt.py`), whose identifiers are Spanish.
The checkpoint's own JSON keys are Spanish too: `config.n_capas`, `pesos`.

## Files affected

| File | Change |
|---|---|
| `scripts/courses/llm-agents/train-minigpt.py` | `--idioma {es,en}`: picks the language constants, the module siblings and the output suffix. Default `es`, and the Spanish run stays byte-identical |
| `scripts/courses/llm-agents/README.md` | an English section: the corpus, the numbers, the hashes |
| `scripts/courses/llm-agents/parity-en.py` | **new** — runs each Spanish module and its English sibling on the same inputs and asserts equal outputs |
| `public/courses/llm-agents/corpus.en.txt` | **new** |
| `public/courses/llm-agents/bpe-merges.en.json`, `minigpt.en.json` | **new**, written by the script |
| `public/courses/llm-agents/bpe.en.py`, `minigpt.en.py` | **new**, 1:1 translations against the identifier map |
| `src/lib/courses/__tests__/llm-agents-assets.test.ts` | the same shape checks over the English siblings; "English prose in the size window" |
| `src/features/courses/widgets/corpora.ts` | the `courses/llm-agents/corpus.txt` entry says the English sibling exists and what still depends on the Spanish one |

## The change

### 1. The corpus — chosen against the properties, then measured

The criteria, in order:

1. **Public domain, from Project Gutenberg**, header and licence stripped exactly as `corpus.txt`
   was, with a first line naming the source (the loader strips it).
2. **Size close to *Marianela*'s 292 075 characters.** Not for symmetry: the training budget
   (2 000 steps of 32 × 64 tokens, ~11 minutes) and the validation tail were sized against it. A
   corpus twice the length sees each token half as often, and the 1·3 quiz (32.6 passes per token)
   changes meaning, not just value.
3. **Narrative prose with dialogue**, so there is a prompt in the register of `—¿Qué` (an opening
   quotation mark and a question word).
4. **A protagonist whose name the corpus repeats** — *Nela* appears 341 times. 1·4's
   `sampling-explorer` contexts, 3·3's `logit-mask` grammar ("names the corpus repeats") and 3·4's
   retrieval questions all need one.
5. **British English**, so the sample text matches the course's en-GB (`colour`, not `color`).

Candidates to measure, not a decision: George Eliot's *Silas Marner* (rural, an orphan girl, close
to *Marianela*'s world), Elizabeth Gaskell's *Cousin Phillis*, Thomas Hardy's *Under the Greenwood
Tree*. Check each one's length after stripping, and pick the one whose run passes every property.

### 2. The properties, re-stated for English where they were Spanish

Properties 1–3 transfer as written: perplexity on held-out text under `PPL_MAX`; greedy decoding
repeats a 4-gram in 32 tokens on at least one prompt; nucleus sampling at 0.9 does not. Pick three
English prompts in the corpus's register (one the protagonist's name, one an opening quotation
mark and a question word, one an unfinished clause).

**Property 4 does not transfer as written.** Its first half counts how many leading tokens of the
held-out answer the model gets right, and in Spanish the first one that matters is the **agreeing
article** (`La tierra`, not `El`). English has no agreement to learn: ` The` is right for every
pair, and a base model may already write it. Assert what the SFT actually teaches in English
instead: the answer **template** (`^ The [a-z]+ is [a-z]+\.`) appears after the SFT and not
before, and the held-out answer's leading-token match strictly increases. If the base checkpoint
already starts with ` The`, say so in the README rather than weakening the assert to pass.

The SFT data: `"What colour is the sky?" → "The sky is blue."` and its nine siblings, matching the
`chat-template` widget's English conversation (`corpora.ts`), with `PLANTILLA` = `"Question:
{}\nAnswer:"`. The held-out pair is chosen so its answer's noun is **not** in the ten.

### 3. The modules, and the parity script

`bpe.en.py` and `minigpt.en.py` are the Spanish files with **only** the names, comments and
docstrings translated, against P3-03's identifier table (`codificar` → `encode`, `generar` →
`generate`, `Adam.paso` → `Adam.step`, `n_capas` → `n_layers`, `pesos` → `weights` …). Same
arithmetic, same order of operations, same seeds.

`parity-en.py` proves it. It loads both pairs and, on the same inputs, asserts identical outputs:
`entrenar`/`train` on a paragraph, `codificar`/`encode` and back on the whole corpus, the forward
pass, the loss and its gradient on one batch, `generar`/`generate` greedy and seeded. It also loads
the **Spanish** checkpoint through `minigpt.en.py` (after renaming the keys) and asserts the same
logits. That last check is the one that matters: it shows the English module is the same model,
so a difference between the two courses' numbers is the corpus, never the code. Run by the author,
not in CI, like the trainer.

### 4. The run, and the numbers it prints

`train-minigpt.py --idioma en --corpus public/courses/llm-agents/corpus.en.txt`. Same seed, same
hyper-parameters, same single BLAS thread, same NumPy pinned to Pyodide's. Record in the README,
beside the Spanish ones, every number the Block 1–3 lessons quote: bytes per token, training and
validation token counts, the best validation step and loss, perplexity, the three prompts' greedy
and nucleus samples, the SFT before/after, the checkpoint's size and sha256, and a CPython forward
time. **These are reference numbers; the lessons quote what Pyodide prints**, exactly as for the
Spanish checkpoint.

Then property 5, the Pyodide load: one cell that `open_url`s `minigpt.en.json` and generates,
measured in the browser on desktop and a phone, under the same 10 s cap.

## Acceptance criteria

- [ ] `corpus.en.txt` meets the five criteria; its source and licence are on its first line
- [ ] `train-minigpt.py --idioma en` asserts properties 1–4 (4 as re-stated) and writes the three
      English assets; `--idioma es` reproduces the published Spanish hashes
- [ ] `parity-en.py` passes, including the Spanish checkpoint through the English module
- [ ] `minigpt.en.json` ≤ 1.5 MB; loads and generates in one Pyodide cell under the cap, desktop
      and phone
- [ ] `llm-agents-assets.test.ts` covers the English siblings; every Spanish assertion unchanged
- [ ] The README records the English numbers and the corpus choice with its reason
- [ ] No Spanish file under `public/courses/llm-agents/` changed (`git diff --stat` shows only additions)
- [ ] `pnpm test` + `pnpm build` green

## Test plan

- The script's own asserts (they refuse to write a checkpoint that fails a property).
- `parity-en.py`.
- Jest: `llm-agents-assets.test.ts`.
- Browser: one throwaway cell loading the English checkpoint and printing a greedy sample, timed.
  Do not commit it.

## Gotchas

- **Do not tune the corpus to the numbers.** If no candidate passes property 2 at these
  hyper-parameters, that is a finding to bring back, not a reason to change `PASOS` or the seed for
  English only: the two checkpoints must be the same recipe, or 1·7's comparison and 1·3's training
  story stop being one story.
- **English is nearly all one-byte UTF-8.** Bytes per token and the first merges will be very
  different from Spanish (` d`, ` e`, ` l`, `os`, ` de`), and 1·2's argument about multi-byte
  letters loses its corpus-side evidence. That is 1·2's problem (it is classed rewrite), but expect
  it: the `bpe-merges` widget's English corpus already had to import `café` and `José` to show it.
- **The JSON keys rename.** `minigpt.en.json` written by `minigpt.en.py` carries English keys; a cell
  that reads `cfg["n_capas"]` against it fails. The asset test checks the English keys explicitly.
- **Measure the time on the same machine** as the Spanish README's 11 minutes, or say which.
- **The README is author-facing and stays in Spanish**, with an English-run section in it.

## Out of scope

- Any lesson, figure or widget preset. `minigpt-entrenamiento.en.svg` (the training curve 1·3
  draws) and the `sampling-explorer` / `kv-cache` / `logit-mask` presets are made by the English
  lessons that embed them, from this checkpoint (Phase 11's "the asset belongs to the lesson" rule).
- `modelo.en.py` (1·9 freezes it) and every later module.
- Retraining or touching the Spanish checkpoint.
