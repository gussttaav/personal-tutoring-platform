# P5-01 — Block 1: Fundamentos de NLP

**Tag:** `COURSE-P5-01` · **Effort:** XL · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P1 (renders), P2-02 (`tokenizer-playground`, `embedding-projection`)

## TL;DR

Text as numbers: tokenisation, vocabulary, one-hot encoding, and embeddings as the bridge to
neural networks. Prose-heavy and light on new machinery, which makes it the **right block to
write first** — it exercises the pipeline without also depending on every widget.

Tempting to skip. Skipping it means students never understand *what* feeds the networks.

## Lessons

| # | Slug | Title | Widgets | Code | Quiz |
|---|---|---|---|---|---|
| 1 | `texto-como-numeros` | Por qué las redes no leen texto | — | — | 3 |
| 2 | `tokenizacion` | Tokenización: palabras, caracteres, subpalabras | `tokenizer-playground` | 1 | 4 |
| 3 | `vocabulario-oov` | Vocabulario, frecuencia y el problema OOV | — | 1 | 4 |
| 4 | `one-hot` | One-hot encoding y la maldición de la dimensionalidad | — | 1 | 4 |
| 5 | `bolsa-de-palabras` | Bolsa de palabras y TF-IDF | `bag-of-words` | 1 | 4 |
| 6 | `embeddings-densos` | Representaciones densas: la idea central | `embedding-projection` | 1 | 4 |
| 7 | `word2vec` | Word2Vec: skip-gram y CBOW | — | 1 | 5 |
| 8 | `glove-y-limites` | GloVe y los límites de los embeddings estáticos | `embedding-projection` | 1 | 4 |

**Bridge out:** lesson 8 ends on the limitation that motivates everything after it — a static
embedding gives *banco* one vector whether it's a bench or a bank. Context-dependence is the
thread that runs to the Transformer.

## Lesson progress

Authored one at a time via `/course-lesson`, on the shared branch, reviewed before commit. This
task's STATUS.md row flips to ✅ **only when every box below is ticked.** Granular progress lives
here; STATUS stays phase-level.

- [x] 1. `texto-como-numeros`
- [x] 2. `tokenizacion`
- [x] 3. `vocabulario-oov`
- [x] 4. `one-hot`
- [x] 5. `bolsa-de-palabras`
- [x] 6. `embeddings-densos`
- [x] 7. `word2vec`
- [x] 8. `glove-y-limites`

## Mathematical content

- Vocabulary as a set; the mapping $V \to \{0,1\}^{|V|}$
- TF-IDF: $\text{tfidf}(t,d) = \text{tf}(t,d) \cdot \log\frac{N}{\text{df}(t)}$
- Cosine similarity, and why it beats Euclidean distance for embeddings
- Skip-gram objective and the softmax over the vocabulary
- Negative sampling — **derive why** it's needed (the $|V|$-sized denominator), don't just state it
- GloVe's co-occurrence factorisation objective

Lesson 7 is where a student first meets "the exact objective is intractable, so we approximate
it". Give that idea room — it recurs throughout the course.

## Acceptance criteria

- [ ] All 8 lessons published, within budget, following the P5-00 structure
- [ ] Notation matches `NOTATION.md`
- [ ] Every code cell runs in Pyodide (**verified in the browser**, not assumed)
- [ ] Spanish examples throughout — accents and `ñ` correct in every tokenisation demo
- [ ] `embedding-projection` vocabulary produces analogies that actually work
- [ ] Negative sampling is derived, not asserted
- [ ] Lesson 8 explicitly sets up context-dependence
- [ ] Lesson 1 is the free sample lesson linked from the course landing page
- [ ] `lint:content` green

## Test plan

- Read every lesson on a phone.
- Run every code cell in a production build.
- Have someone who is *not* a DL practitioner read lessons 1–3 and report where they got lost.
  Block 1 is the highest-drop-off point in every course of this kind.

## Notes / gotchas

- **Use Spanish text in every example.** A course in Spanish tokenising English sentences is a
  small but constant signal that it's a translation of someone else's material.
- Spanish tokenisation has genuinely interesting cases — clitics (*dámelo*), contractions
  (*del*, *al*), inflectional richness. Use them; they're better teaching examples than English's.
- Don't train Word2Vec in a code cell. Too slow in Pyodide. Ship precomputed vectors and let the
  cell explore them.
- Keep lesson 1 free of code entirely — it's the sample lesson and the first impression.
- Resist a "history of NLP" lesson. Interesting, not load-bearing, and it delays the payoff.

## Out of scope

- Contextual embeddings (ELMo, BERT) — Block 5.
- Byte-pair encoding implementation details beyond the playground demo.
- Multilingual or cross-lingual embeddings.
