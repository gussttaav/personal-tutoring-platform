# P3-04 — Block 1: From the Transformer to the Language Model

**Tag:** `COURSE-C2-P3-04` · **Size:** L · **Status:** not started
**Depends on:** P3-01 · P3-02 (the English checkpoint) · P3-03 (the identifier map) · `dl-nlp`'s
P11-08 at least through 5.9 (see P3-03's sequencing constraint)
**Course:** `llm-agents` → `content/courses/llm-agents/en/` · **Runs on:** the English mini-GPT
(`minigpt.en.json`), in the browser

## TL;DR

Nine lessons, and the block where the English checkpoint is first put to work: every sample, loss,
perplexity and probability the Spanish lessons quote was printed by the Spanish model, so almost
every lesson is an **adapt with Pyodide re-runs**. Two are rewrites because their argument is about
Spanish itself: 1·2 (UTF-8 bytes, `ñ`, `que` before `qu`) and 1·8 (in-context learning demonstrated
on Spanish gender and number morphology). The block also builds four English assets the later
blocks load: the training-curve figure, the `sampling-explorer` and `kv-cache` presets, and
`modelo.en.py`.

## Why this block is first

It is first in the course, but also first in cost: it is where the identifier map meets real
cells, where the English checkpoint's numbers are first quoted, and where 1·1's pickup crosses the
course boundary into `dl-nlp`'s English closing. A mistake in a name or a convention here repeats
39 times.

## Classification

**Planning pass, 2026-11-13. P3-00 replaces this table** with its count and line refs. File number
and `order` coincide in this block: `es/01` … `es/09` are 1·1 … 1·9.

| # | Slug | Class | Re-run | What binds it to Spanish |
|---|---|---|---|---|
| 1·1 | `una-sola-columna` | adapt | — | No cells. The worked window is Spanish words (`<W>casa</W>`, `<W>es</W>`, `<W>blanca</W>`, `<W>En un lugar de la</W>`, 27 `<W>`) and a quiz computes its probability ($0.0625$, which holds if the replacement has the same shape). 9 `curso="dl-nlp"` refs, the course's densest, including 5.9 and 5.10 |
| 1·2 | `bpe-de-verdad` | **rewrite** | P | The block's most Spanish lesson: UTF-8 bytes of `ñ` and accented vowels, `-ción`, the quiz on `que` (merge 16) before `qu` (65) "although in Spanish `q` is always followed by `u`", and a numeric quiz on 2.16 bytes per token (answer **138**). Trains BPE on the corpus in a cell. The `bpe-merges` widget already has its English corpus (`corpora.ts`), and the prose must quote **its** numbers |
| 1·3 | `entrenar-un-mini-gpt` | adapt | P | Training cells and a challenge on the checkpoint; the numeric quiz's $125\,789$ training tokens (answer **32.6**) is re-measured; `<Figure src=minigpt-entrenamiento.svg>` is the Spanish training curve → `minigpt-entrenamiento.en.svg`, drawn from P3-02's run. 6 `curso="dl-nlp"` refs |
| 1·4 | `muestreo` | adapt | P | `sampling-explorer` is in `SPANISH_BOUND_CORPORA`: its two logit vectors are the checkpoint after «La Nela» and «La Nela bajó la cabe». Re-run `scripts/courses/llm-agents/sampling-presets.py` on English contexts with the same property (one context with dozens of live entries, one with nearly all mass on one). The numeric quiz quotes $0.118$ / $0.045$ (answer **6.8**). 20 corpus-name mentions, 50 `<W>` |
| 1·5 | `kv-cache` | adapt | P | `kv-cache` preset = the 64 tokens generated after «La Nela» (decoration only: the costs are the model's shape). Re-run `kv-cache-presets.py`. The GiB quiz (answer **4**) is arithmetic and holds |
| 1·6 | `perplejidad` | adapt | P | Three cells; quoted losses ($3.595 \to 3.240$ on trained pages, $3.030 \to 3.095$ held out) and bits per byte ($9/2.14 \approx 4.20$). The argument «las fusiones ya son un poco de español» survives as "a little English", with English's bytes per token |
| 1·7 | `leyes-de-escala` | transpose | — | Published figures (Kaplan, Chinchilla, GPT-3) hold in any language. The `scaling-laws` widget's mini-GPT point is $N$ and $D$ only (no loss), so it holds. One sentence names «una novela en español» |
| 1·8 | `aprendizaje-en-contexto` | **rewrite** | P | The in-context task is Spanish morphology: `hijo: hijos` (number), `hermano: hermana` (gender, an `-o`/`-a` suffix the prompt's examples demonstrate). English has the plural but no gender suffix to copy, so the gender half needs a new task with the same property: the prompt's examples flip what the model would write a priori. The quiz is language-free |
| 1·9 | `proyecto-mini-gpt` | adapt | P | Freezes `modelo.py` → writes `modelo.en.py` (identifier map). 21 corpus-name mentions in samples; the challenge; the `parar` / stop-sequence term. The quiz (**1.306**) is arithmetic |

**Block totals (planning pass):** 1 transpose · 6 adapt · 2 rewrite · re-runs P ×7.

## Assets this block builds

| Asset | Built by | Consumed by |
|---|---|---|
| `minigpt-entrenamiento.en.svg` | 1·3, from P3-02's logged run | 1·3 |
| English `sampling-explorer` contexts in `math/sampling-presets.ts`, picked per locale | 1·4 | 1·4 |
| English `kv-cache` text in `math/kv-cache-presets.ts`, picked per locale | 1·5 | 1·5 |
| `modelo.en.py` + its assets-test block + `parity-en.py` case | 1·9 | Blocks 2–3 |

A widget leaves `SPANISH_BOUND_CORPORA` in the PR that gives it English data, with its teaching
property asserted in its data test (Phase 11's rule). The presets are **regenerated by their
scripts against `minigpt.en.json`**, never hand-edited.

## Lesson progress

- [ ] 1·1 `una-sola-columna`
- [ ] 1·2 `bpe-de-verdad`
- [ ] 1·3 `entrenar-un-mini-gpt`
- [ ] 1·4 `muestreo`
- [ ] 1·5 `kv-cache`
- [ ] 1·6 `perplejidad`
- [ ] 1·7 `leyes-de-escala`
- [ ] 1·8 `aprendizaje-en-contexto`
- [ ] 1·9 `proyecto-mini-gpt`

## The worked case — 1·2

Spanish gives 1·2 its evidence for free: `ñ` and the accented vowels are two bytes each, so the
first merges visibly fuse byte pairs into letters, and `-ción` shows a suffix being assembled.
English text is nearly all one-byte ASCII, so on the English corpus the first merges will most
likely join ASCII pairs into common words (expect ` t`, `he`, ` the`; P3-02 prints the real list), and the "merges rebuild letters first" observation disappears from the corpus
side. Keep the argument by moving its evidence: the `bpe-merges` widget's English corpus was built
for exactly this (`café`, `José`, `fiancé` make merge 1 fuse `C3`+`A9`, and `naïve` keeps a letter
the corpus never had at two bytes to the end, the byte-level answer to out-of-vocabulary). The
quiz on `que`/`qu` needs an English counterpart from the English merge list (a frequent word that
is merged before its own prefix), found in P3-02's printed list, not invented.

## Decisions fixed by a translated lesson

*Empty until the first lesson lands. Record here every choice a later lesson must reuse verbatim:
the English prompts that stand in for «La Nela», the in-context task of 1·8, the stop sequence of
1·9.*

## Acceptance criteria

- [ ] Every lesson under `content/courses/llm-agents/en/`, `draft: false`
- [ ] `slug`, `block`, `order` and every widget / quiz / challenge id match the Spanish lesson
- [ ] Every cell and challenge loads the **English** assets (`*.en.json`, `*.en.py`,
      `corpus.en.txt`) and was run in the browser; every quoted number is what Pyodide printed
- [ ] `sampling-explorer` and `kv-cache` render English presets on `/en`, Spanish on `/es`, and are
      out of `SPANISH_BOUND_CORPORA`
- [ ] `modelo.en.py` matches 1·9's English cell character for character (the assets test), and
      `parity-en.py` covers it
- [ ] Every `<Leccion>` resolves; `curso="dl-nlp"` targets not yet translated render «In Spanish»
- [ ] The two-reader test passes against the English neighbours, and for 1·1 against `dl-nlp`'s
      English `fine-tuning-colab` once it exists
- [ ] `pnpm lint:content` clean (budget warnings advisory); `pnpm build` green

## Test plan

- `pnpm lint:content` after each lesson; `pnpm build` before each PR.
- Every cell run in the browser, desktop and a 360px phone; numbers quoted from Pyodide.
- Each re-generated preset: render the widget on `/en` and check the property it exists to show
  (1·4: the two contexts really differ in how many entries carry the mass).
- `pnpm test` for the corpora and assets tests the block extends.

## Gotchas

- **Quote Pyodide, not CPython.** P3-02's README numbers are a reference; the browser's BLAS
  differs (memory: course PyCell numbers). The Spanish lessons were written under the same rule.
- **Training cells are at the edge of the 10 s cap.** The English checkpoint has the same shape,
  but a corpus with different token lengths changes per-step cost; re-time 1·3's and 1·6's cells on
  a phone.
- **1·6's "continue training" cell warms Adam up** when resuming from the checkpoint (memory:
  mini-GPT continued training). The English run will need the same care, and its held-out loss
  will move the same direction.
- **A new `curso="dl-nlp"` anchor flips** when `dl-nlp` translates the target: this block has no
  anchored cross-course refs today; keep it that way.

## Out of scope

- The checkpoint itself (P3-02) and the identifier map (P3-03).
- Editing a Spanish lesson or asset.
