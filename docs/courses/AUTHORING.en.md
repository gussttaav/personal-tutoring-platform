# AUTHORING.en.md — the English delta

**Tag:** `COURSE-P11-03` · Delta on [AUTHORING.md](AUTHORING.md) · Notation:
[NOTATION.md](NOTATION.md), unchanged

**[AUTHORING.md](AUTHORING.md) governs an English lesson exactly as it governs a Spanish one,
except where this file replaces it, section by section.** Read that file first; this one is useless
on its own and is deliberately too short to be read instead.

A delta and not a fork, because two files of 1,300 lines saying almost the same thing drift the
first time a rule changes, and the drift is invisible until a lesson has been written against the
stale half. Most of `AUTHORING.md` is about *this course* — the structure, what a lesson may
assume, the budget, the frontmatter, the components, the checklist — not about Spanish. Four things
in it are, and one of them is not in §5 where you would look for it:

| Where | What is replaced |
|---|---|
| §5, the five marks | `*italic*` job (a), and `«…»` → `"…"`. Plus the Spanish typography block. |
| §5, person and mood | `tú` / `nosotros` collapse into an unmarked *you*; the second constant. |
| §2, referring to blocks and lessons | Lowercase *el bloque 2* → capitalised **Block 2**. |
| §5, terminology | The glossary below, which is the Spanish table's distinctions in English. |

Everything else applies verbatim; §8 below says so explicitly for the parts most likely to be
re-litigated.

**Since `COURSE-C2-P0-04` the delta mechanism has three members**: this language delta, and one
*course* delta per course — [`dl-nlp/AUTHORING.md`](dl-nlp/AUTHORING.md),
[`llm-agents/AUTHORING.md`](llm-agents/AUTHORING.md). They compose in the order
[README.md](README.md#which-file-governs) gives: the shared file, then the course's delta, then
this one, each replacing only what it names. The Spanish terminology table that §6 below carries
into English now lives in `dl-nlp`'s delta rather than in the shared file, so §6 is that course's
English glossary; a second course's glossary is written beside its own delta when its lessons are
translated, and until then nothing here is about it.

---

## 1. §5 — the five marks

Two of the five change. The rule they serve does not: **one mark, one job**, and the damage from
breaking it is cumulative rather than local.

| Mark | Its one job in English | From the English lessons |
|---|---|---|
| `**bold**` | the term **being defined**, at its definition, once | unchanged |
| `*italic*` | (a) a **term of art on first use per lesson** — the name the literature uses, which this lesson borrows rather than defines; (b) the one word that flips the sentence | *teacher forcing*, *beam search*, *a priori*; *before* the network, that it asserts *nothing* |
| `<W>…</W>` | a string the lesson talks *about* | unchanged — [NOTATION.md §6](NOTATION.md#6-object-language--words-the-lesson-talks-about) is locale-invariant |
| `"…"` | a word used in its loose, non-technical sense | "distance", "direction", "unit", "new" |
| `` `code` `` | Python, and only Python | unchanged |

**Italics job (a) is a replacement, not a translation.** "An anglicism on first use" is meaningless
in a language where the anglicism is the language. What that rule bought in Spanish was a signal
that a word is being borrowed and is not the course's own — so English keeps the signal and moves
it to what is actually borrowed: a term the student will meet in a paper and that this lesson does
not stop to define. *Embedding*, *token*, *batch*, *softmax*, *encoder* and *forward pass* are
therefore **plain** in English: they are the course's own vocabulary, bold at their definition and
unmarked everywhere after. Genuinely foreign loanwords keep the italics (*a priori*, *ad hoc*).

**`"…"` carries a warning `«…»` did not need.** In Spanish the angular quotes could only mean the
loose sense, because nothing else used them. English double quotes already mean *quotation*, so the
mark arrives with two jobs (the failure this section exists to prevent) and the rule is stricter:

> **The loose sense is the only use of quotation marks in a lesson.** Quoted speech and quoted
> output belong in `<W>` or in a code fence.

A cited line or aphorism is a third thing, and it takes neither mark: not quotation marks (loose sense
only) and not italics (which already has its two jobs above, and in Spanish only marked the line as
foreign, a reason that disappears in English). Set it plain, introduced by a colon and closed by a
full stop, with the attribution in the lead-in: `it is almost always cited in Firth's line: you shall
know a word by the company it keeps.` *Settled by `en/06-embeddings-densos.mdx` (COURSE-P11-04).*

The `<W>` boundary is [NOTATION.md §6](NOTATION.md#6-object-language--words-the-lesson-talks-about)'s,
unchanged. Its plain-text prop exception carries over: `caption`, `alt` and `summary` are strings, so
a string the lesson talks about is written `"tokenisation"` there.

### Typography

The Spanish typography bullets in §5 are replaced wholesale; the display-equation rule below them
is not (see §8).

- **No em dash (`—`) in prose.** A parenthetical aside goes in parentheses: `the translator
  (numbering the words alphabetically, say) produces valid numbers`. A lighter, two- or three-word
  aside takes a pair of commas. A clause that explains or introduces what precedes it takes a colon.
  Two full sentences are written as two sentences. Never `—`, never ` — ` spaced on both sides, never
  `-` or `–` standing in for it. The en dash `–` stays only for numeric ranges (`30,000–50,000`) and
  compound terms (`term frequency–inverse document frequency`), where it is not punctuation. Same
  rule as `AUTHORING.md`'s for Spanish.
- **No opening `¿` or `¡`.** Their presence is the tell that a paragraph was transposed by hand and
  not reread.
- **Thousands take the comma in prose**: `30,000`, `1,200 words`. A number the prose *reports*
  stays inside `$…$` under [NOTATION.md](NOTATION.md) and keeps its `\,` there (`$29\,312$`), and
  the two differing is not an inconsistency: one is English prose, the other is typeset maths.
- **The decimal point is unchanged**, in prose and in maths alike.
- **Punctuation sits outside the quotation marks** unless it belongs to the quoted matter, which,
  under the rule above, it never does.

## 2. §5 — person and mood

Spanish gives `tú` and `nosotros` two different jobs. English collapses the first into an unmarked
*you*, which loses the register signal but keeps the distinction, and the distinction is the part
that mattered:

- **"you"** — what the student does, sees, or has to decide. *Take the sentence <W>the cat drinks
  milk</W>.* · *Run it as it stands, then swap the corpus for a text of your own.* Imperatives stay
  imperative.
- **"we"** — only where the Spanish `nosotros` earned it: mathematical work being done jointly on
  the page. *Fix the vocabulary and call it $V$.* · *Write $\bar{\ell}$ for the mean length of a
  token.* Not as a softener, and never for something only the author did.
- **First person singular** keeps its one rare job unchanged: what the author did to the material.
  *I set those coordinates by hand for the course.* · *I have left $d_{\text{model}} = 3$
  deliberately.* The impersonal alternative defeats the purpose, which is that a person chose.
- **Contractions are allowed and preferred in prose** — *doesn't*, *isn't*, *there's*. The Spanish
  voice is direct, and uncontracted English reads stiffer than the original rather than equally
  formal. Not inside a definition, a theorem statement or a formal claim.

**Never the agentless passive** for either of the first two. Not *NFC normalisation should be
applied*, not *the student must run the cell*, not *the reader will observe that*. English reaches
for it as easily as Spanish reaches for the impersonal, and it is the same pane of glass.

The two banned families — **condescension** and **padding** — are unchanged as rules and already
have their English word lists in code (`src/lib/courses/validate-voice.ts`, COURSE-P11-01), fired
by `pnpm lint:content` against the lesson's own locale directory. Two things to know while writing:
the ban is on the **family**, so *merely* is *simply* wearing a hat exactly as *sencillamente* was;
and **`just` is deliberately wide**. It warns often and it warns on innocent uses, which is
affordable because the pass warns and never fails — read each hit rather than working around it.

## 3. §5 — the second constant: English examples

§5's two constants are *derivations shown, not asserted* — unchanged, and the course's whole
differentiator — and *Spanish examples throughout*, which inverts. **English examples throughout.**
An English course tokenising Spanish sentences is the same constant signal of translated material,
read from the other side.

English carries its own set, and they are not the Spanish ones translated: contractions (*don't*),
the possessive `'s`, irregular plurals, `naïve` and `café` for the NFC case, *unhappiness* for what
a subword tokeniser does to a long word. The widgets' default corpora already commit to some of
these (`src/features/courses/widgets/corpora.ts`, COURSE-P11-02) — a lesson's prose must describe
the corpus the English widget actually shows.

**An example resting on alphabetical order is re-derived, never translated.** Collation belongs to
the language: a sorted vocabulary re-sorts, and the claim the sort existed to make can come out
*true* in English — destroying the argument rather than merely reordering it. Re-derive until the
claim is absurd again, and check any asset with the old order set into it.

## 4. §2 — capitalisation of blocks and lessons

The rule that is not in §5. `AUTHORING.md` §2 keeps *el bloque 2* and *la lección 3* lowercase
mid-sentence because Spanish treats both as common nouns. **English treats a numbered division as a
name: Block 2, Lesson 3, capitalised mid-sentence.**

Everything else in §2 survives unchanged, including the two rules that matter more than the case:
a lesson is **never** referred to by its number — write a `<Leccion>` and let the build resolve it
— and *the previous block* is preferred to *Block 1* when it **is** the preceding one, because it
survives a renumbering.

## 5. §3 — the budget will read low, and that is expected

§3 warns **under** budget as well as over, on words and on quiz questions, because "a 400-word
lesson is usually half a lesson". Spanish runs meaningfully wordier than English for the same
content, so a faithful transposition of an 1,800-word Spanish lesson can land near 1,500 and warn.

**That warning is advisory and stays advisory.** The check it should trigger is *did an argument
step go missing* — a derivation compressed, a concession dropped, a bridge cut to one paragraph —
not *did the number go down*. If every step is present, the lower count is the language, and the
lesson ships; never pad an English lesson to clear a Spanish word count. Every other row of the
budget table is locale-invariant and unchanged.

## 6. Terminology — the English glossary

The rule is `AUTHORING.md`'s, unchanged and for its reason: **one concept, one word, course-wide**,
because a reader cannot tell a synonym from a distinction. And the process is unchanged: **a term a
lesson needs is added here first**, before the lesson is written, not after. A term settled
mid-paragraph is settled by whichever word came out first. The widget strings (COURSE-P11-02)
resolve against this table, which is why it is a glossary and not a paragraph.

What this table is **not** is a translation of the Spanish one. Its job is to carry that table's
*distinctions* into English, and several of them change shape on the way across — the ones that do
are argued below the table.

### model, neural network, system

Not synonyms, and the three-way split is unchanged:

| Term | Use it when |
|---|---|
| `neural network` (or `the network`) | the claim is about a network: its layers, its weights, what it computes |
| `model` | the claim is about learning, generalising, being trained, being deployed |
| `system` | the claim holds regardless of what is downstream |

**In Block 1, prefer `model` or `system`** — most of what consumes those representations is not a
network, so `neural network` is both over-specific and a forward reference to Block 2.

### The glossary

| Concept | Use | Never |
|---|---|---|
| the vector representation of an entry | embedding | *embedding vector* as a second name; italics — it is course vocabulary, not a borrowing |
| what $\tau$ emits · a fixed-size group of examples | token · batch | |
| the mechanism, and its self- form | attention, self-attention | |
| the paper's own names | one-hot encoding, multi-head, layer norm, fine-tuning, softmax, encoder, decoder, forward pass | |
| the backward pass algorithm | backpropagation | backprop, back-propagation |
| the network's parts | layer, weight, bias | |
| what training minimises, and how | loss, gradient, gradient descent | cost, error surface |
| $\eta$ | learning rate | step size |
| the two objectives | cross-entropy, likelihood | log loss |
| the regression loss | mean squared error, then MSE | bare MSE on first use; average squared error |
| what the network is put through | training, to train | fitting |
| the two splits this course has | training set, test set | validation set (there is no third split); data, samples |
| the fraction it gets right | accuracy | **precision** — a different metric, and a reader who has met both would read the wrong quantity |
| giving the weights their first values | initialisation, to initialise | seeding — a `seed` is the generator's, not the weights' |
| Block 1's objects | vocabulary, tokenisation, subword, bag of words, positional encoding | |
| filling the leftover positions of a fixed-length input | padding | |
| cutting a text at $T_{\max}$ | truncation, to truncate | clipping — that is what happens to the probabilities before the logarithm; the vocabulary is *cut* at the $k$ most frequent types. Three cuts, three verbs. |
| what high $d$ costs · the shape of a vector | curse of dimensionality · dense, sparse | |
| a distinct string · one appearance of one | type · token, and `occurrence` when the two are contrasted | `token` for both senses |
| an element of $V$ | vocabulary entry, then entry | word — an entry is a *piece* of a word under a subword tokeniser. `word` keeps one job: the everyday word, inside examples that are literally words |
| one case shown to the network, and the answer wanted for it | example, label | sample, data point, instance; target |
| a place in an ordered sequence | position | slot, rank, place |
| a coordinate-wise multiplier in $(0,1)$ | gate — forget / input / output, update / reset | valve, door |
| the LSTM's second state | cell state; its proposal is the candidate | memory cell |
| the summing route memory takes across steps | additive path | additive route |
| $\boldsymbol{\delta}^{(l)}$, what the loss owes a pre-activation | error (of the layer, of the neuron) | delta, error signal, error term |
| a network trained to predict what comes next | language model | |
| the random draw from the model's own distribution | to sample, sampling | |
| giving a symbol or variable its value | assign to | put into |
| a short run in a cell whose result the next paragraph reads | experiment | probe |
| always taking the highest-probability output | greedy decoding | |
| source to target sequence · the task Block 4 demonstrates on | sequence-to-sequence model, nickname *seq2seq* · machine translation | |
| the fixed vector the encoder hands the decoder | context vector | thought vector, summary vector |
| feeding the decoder the true previous token in training | *teacher forcing* | any paraphrase |
| working an argument to a result · the calculus operation | derive, derivation · differentiate, the partial derivative | see below — the two swap jobs relative to Spanish |
| the token that ends a generated sequence | `<EOS>`, glossed once per lesson as "the end-of-sequence token" | end token, stop symbol |
| the token the decoder is fed at its first position | `<GO>`, glossed once per lesson as "the symbol the decoder starts from" | `<BOS>`, start token |
| the decoding search this course does **not** cover, named once so the concession is honest | *beam search* | |
| the small network that computes the score $a$ | alignment model | attention network |
| Bahdanau's score · Luong's score | additive attention · multiplicative attention | dot-product attention for Luong's |
| the three roles of one attention call | query, key, value | request, lookup, content |
| the two-layer network applied to each position on its own | position-wise perceptron | feed-forward network (true of every layer in Blocks 2–3, so it says the one thing that is not the point); dense layer |
| the decoder sublayer taking its keys and values from the encoder | encoder-decoder attention | cross-attention |
| the whole formula, divisor included · the operation inside it | *scaled dot-product* · dot product | scalar product |
| one of the $h$ attentions run in parallel | head — inside the compound *multi-head attention* | |
| $\mathbb{E}[\cdot]$ · how far a centred quantity lands from zero | mean · standard deviation | expectation, expected value, average; and never the letter $\sigma$, which NOTATION.md §4 reserves |
| how many positions a coordinate takes to come back round | wavelength | period; frequency, which is $\omega_i$ — a different number |
| the line carrying a sublayer's input around it | residual connection, and *the residuals* for several | skip connection, shortcut |
| training against raw text before any task | pre-training, to pre-train | prior training |
| the vector the stack gives one position | contextual representation | contextual embedding — *embedding* names the static object |
| BERT's objective | masked language modelling (MLM), expanded once per lesson | masked language model — the course spends `language model` on the next-token network, which BERT is not |
| the token that replaces a hidden position | `[MASK]`, glossed once per lesson | any translation; unifying its brackets with `<EOS>`'s |
| the two mask regimes, as adjectives | causal, bidirectional | unidirectional, left-to-right, non-causal |

### Where the distinctions change shape

Everything above is a straight carry-over except these, and each is a case where English hands the
course something Spanish had to argue for, or takes something away.

**`derivation` and `differentiate` swap jobs.** Spanish reserves `derivar` for the calculus
operation and uses `desarrollar` for working an argument to a result. English has a dedicated
calculus verb, so the collision resolves the other way: **differentiate** and *the partial
derivative* for the operation; **derive** and **derivation** for the step-by-step argument. That
second use is load-bearing — "derivations shown, not asserted" is §5's first constant.

**`sample` is the noun to watch.** The glossary bans it for a training case (`example`) while the
verb *to sample* names the random draw when generating. English ML usage pulls hard the other way,
so the ban costs more attention here than it does in Spanish, where `muestra` and `muestreo` are
further apart. *Negative sampling* stays a fixed compound and is never shortened to bare
"sampling".

**Two Spanish arguments dissolve, and their rows get shorter.** `producto interno escalado` exists
because gluing an adjective onto `producto escalar` put the same root twice in three words for two
unrelated reasons; in English *scaled dot-product* is the paper's own name and there is nothing to
argue. Likewise `consulta` / `clave` / `valor` needed an English gloss once per lesson so that
$\mathbf{Q}$, $\mathbf{K}$ and $\mathbf{V}$ could be read as initials — **in English no gloss is
owed at all**, because the words and the letters are already the same alphabet.

**One Spanish argument gets sharper, not softer.** `accuracy` / *precision* is the pair the Spanish
table bans most emphatically, and the trap is worse in English: *precision* is a real metric with a
real definition, sitting one word away from the one this course measures. Never write it for
accuracy, not even loosely.

**Acronyms** are unchanged: expand every one on **first use, in every lesson**, then use it bare —
*out-of-vocabulary (OOV)*, *masked language modelling (MLM)*. Per lesson, not per course: lessons
are entered from search results and from the sidebar, and it costs four words.

## 7. en-GB, stated once

**`-ise`, not `-ize`.** The codebase already commits to it — `course.en.yml` says "mathematical
rigour", the widget maths modules are `tokenisation.ts` and `optimisation.ts`, comments say
`visualiser` — and it is recorded here so it survives the first author who did not notice. The
words this course actually writes: *tokenisation*, *optimisation*, *normalise*, *initialisation*,
*visualiser*, *behaviour*, *rigour*, *modelling* and *labelled* with their double `l`, *occurrence*.

**The exception, and it is the usual one: names the course does not own keep their source spelling.**
`normalize.ts` is a filename, `initialize` is a Python method, `np.random.normal` is what NumPy calls
it, and `tokenizer-playground` is a widget id — none of them takes an `-ise` or an English gloss.
These are quoted, not translated: every library or API name, every filename, every widget `id`, and
every slug.

**A `<PyCell>`'s own code is not one of those names — it is the lesson talking, so it is written in
English like the prose.** Its local identifiers, comments and `print` strings are translated
(`por_palabras` → `by_words`, `normaliza` → `normalise`, `# la puntuación…` → `# punctuation…`,
`"caracteres"` → `"characters"`), and being the course's own vocabulary they take en-GB spelling like
everything else. The forcing argument is the output: a student reads what the cell prints, so the
print strings *must* be English, and a cell whose functions are Spanish while its output is English
reads as half-translated — the exact "translated course" tell §3 exists to kill. *Settled by
`en/02-tokenizacion.mdx` (COURSE-P11-04).*

**The same line runs through the `reading` block.** Only `note` is prose, but the bibliographic
fields render *verbatim*, so any editorial Spanish left in them is translated the way the prose is:
`Sennrich, Haddow y Birch` → `…and Birch`, `cap. 2` → `ch. 2`, `3.ª ed., borrador libre` → `3rd ed.,
free draft`. What stays fixed is the source's *identity* — surnames, the work's own title, `venue`,
`url` and `lang` (an English source is `en` in both locales) — and `kind`, an enum the reader
localises on its own. "Translate only the note" means keep the source, not keep the Spanish.

**A `<Figure>` whose asset has source text set into it gets an English sibling, `<name>.en.svg`.**
The SVG's `alt`, `caption` and any label baked into the drawing are the lesson talking, translated
like the prose — but the file itself is a static asset that `src` names by path, with no locale
resolution behind it (`src/lib/courses/mdx-components.tsx` passes `src` straight to an `<img>`). So
the English lesson cannot point at the Spanish file without inheriting its Spanish labels. Copy it to
`<name>.en.svg` beside the original in `public/courses/dl-nlp/`, translate the text set into it and
the `aria-label`, and point `src` at the sibling; the Spanish file keeps its name and its Spanish.
Figures are not widgets, so P11-02 does not own them and the redraw is the translating lesson's.
*Settled by `en/03-vocabulario-oov.mdx` (COURSE-P11-04): `suma-armonica.svg` → `suma-armonica.en.svg`.*

**A widget whose default data is a locale-bound committed asset gets an English sibling asset, and the
widget picks it per locale.** A few widgets read a *data file*, not just strings — `embedding-projection`
plots a committed 2D projection of ~200 words. P11-02 can move a widget's strings but not this data, so
it lists such widgets in `SPANISH_BOUND_CORPORA` (`src/features/courses/widgets/corpora.ts`) and leaves
the English asset to the lesson that embeds it. Build an English sibling beside the original in
`public/courses/dl-nlp/` (e.g. `embeddings-sample.en.json`), make the widget locale-aware — a per-locale
source file, default selection and any analogy words — and guard its teaching property in the widget's
data test. The Spanish asset keeps its name and its data, and the widget is removed from
`SPANISH_BOUND_CORPORA` once its English data exists. This is the same rule as the figure sibling above,
one layer up: the asset, not just the label, is the lesson talking. Where the Spanish asset is a
word list on a projection, the cheapest faithful English version is a **1:1 translation onto the same
coordinates** — same layout, same density, same analogy geometry — not a fresh, sparser layout.
*Settled by `en/06-embeddings-densos.mdx` (COURSE-P11-04): `embeddings-sample.en.json`, the Spanish
218-word list translated 1:1 onto its coordinates, with the `king − man + woman → queen` analogy;
reused by 1.8.*

## 8. What this delta does not replace

Named explicitly, because these are the parts most likely to be re-decided by an author who has the
delta open and not the main file. All of them apply to an English lesson unchanged:

- **The six-step structure** (§1), the bridge rules, and the rule that the six are never headings.
  Do not restate any of it here; that is how a delta becomes a fork.
- **The two-reader test** (§1) — and it runs against the **English** neighbours. Read the previous
  English lesson's closing and this opening back to back: nothing may read twice. Then read the
  opening alone and cold: it must say where the course had got to. A pickup transposed from the
  Spanish opening will usually fail the first test, because the Spanish bridge it was written
  against is not the English one the reader just finished.
- **What a lesson may assume** (§2), including that forward references are signposted out loud.
- **All of [NOTATION.md](NOTATION.md).** Notation is locale-invariant by design, and its one
  prose-facing part — §6, `<W>` — applies word for word. A symbol that needs adding is added there,
  in the one file, for both locales.
- **The display-equation punctuation rule** (§5): the equation is part of its sentence and carries
  that sentence's mark as the last character inside the fence.
- **Bold for the term being defined, never for emphasis** — that is italics' job.
- **§6 frontmatter, §7 components, §8 MDX/LaTeX gotchas, §9 the end-to-end recipe and §10 the
  pre-merge checklist.** Slugs, `block`, `order`, widget ids, quiz ids and challenge ids are
  identical to the Spanish lesson's — that invariant is what the per-lesson resolution in
  `catalog-view.ts` is built on.
