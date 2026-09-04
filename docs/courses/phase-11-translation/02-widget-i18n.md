# P11-02 — Widget strings and per-locale corpora

**Tag:** `COURSE-P11-02` · **Size:** M · **Status:** not started

## TL;DR

The explorables are hardcoded Spanish. Move their strings to `messages/{es,en}.json` like the
rest of the reader chrome, and — separately, and more carefully — give the two widgets whose
**default corpus is pedagogical** an English corpus chosen for the same teaching property, not
translated.

## Context

The reader chrome was internationalised as it was built: `QuizCard`, `CodeChallengeCard`,
`CourseCard`, `CourseHero`, `SyllabusAccordion`, `LessonComplete` and `LessonReading` all read
through `useTranslations` / `getTranslations`. The widgets under
`src/features/courses/widgets/` were not — they were written alongside Spanish lessons, for
Spanish lessons, and nothing ever asked them to be otherwise.

A heuristic scan puts **15 of the 25** components in that tree on the hook. Three kinds of
string, and they are not equally hard:

**Interface labels and hints** — mechanical.

```
label="Peso (w)"                       label="Ancho del estado, d_h"
label="Longitud de la secuencia (T)"   label="Radio espectral ρ de Wₕₕ"
label="desplazamiento k"               label="Niveles distinguibles por coordenada, q"
hint="qué conserva"  hint="qué escribe"  hint="qué deja ver"
"Divide por espacios y puntuación."    "## marca continuación de palabra."
```

**Accessibility strings** — eleven `aria-label`s, mechanical but easy to miss because nothing
renders them.

```
aria-label="Frase para tokenizar"
aria-label="RNN desplegada; usa las flechas para avanzar y retroceder por los pasos"
aria-label="Mapa de auto-atención: elige una posición para ver de qué otras tira"
```

**Default corpora** — *not* mechanical, and the reason this task is M and not S.

```ts
// nlp/TokenizerPlayground.tsx
const DEFAULT_TEXT = "El niño enseña programación en español.";

// the self-attention / alignment sample
"el portero paró el balón de penalti y el equipo ganó el partido"
```

These are teaching instruments. The tokenizer default is chosen so the three tokenisers visibly
disagree — `niño` exercises the NFC point, `programación` splits into subwords. The attention
sentence is chosen so the heat map has something to *show*: `el equipo` attends back to
`el portero`, and the reader sees alignment rather than a diagonal. Translate either one
literally and the widget still runs, still looks right, and stops demonstrating the thing the
prose says it demonstrates.

## Files affected

| File | Change |
|---|---|
| `src/features/courses/widgets/**/*.tsx` | 15 components: literals → `useTranslations("courses.widgets.*")` |
| `src/features/courses/widgets/corpora.ts` | **new** — per-locale default corpora, keyed by widget id |
| `messages/es.json`, `messages/en.json` | `courses.widgets.*`, key-for-key |
| `src/features/courses/widgets/__tests__/*` | corpus-selection unit test |
| `docs/courses/AUTHORING.md` §7 | the rule: a widget never hardcodes a user-visible string |

## The change

### 1. Strings follow the chrome's existing path

`NextIntlClientProvider` is already mounted in `src/app/[locale]/layout.tsx` with the full
`messages` object, and `QuizCard` is the precedent: a `"use client"` component calling
`useTranslations("courses.quiz")`. Widgets do the same under `courses.widgets.<widgetId>.*`.
No new provider, no prop-drilling from the server MDX layer.

Namespace per widget id, not per component file, so the key structure matches the id an author
writes in `<Explorable id="…" />` and a missing key is traceable from the lesson.

### 2. Corpora are data, chosen per locale

A new `corpora.ts` maps widget id → locale → corpus, so the choice is reviewable in one file
instead of buried in 15 components. The English corpora are **selected against the teaching
property**, and the property is written down next to each one:

| Widget | Property the corpus must have | Spanish | English direction |
|---|---|---|---|
| `tokenizer-playground` | The three tokenisers visibly disagree; at least one word splits into subwords; one character exercises NFC | `El niño enseña programación en español.` | Needs a long morphological word (`unhappiness`, `tokenisation`) and a diacritic (`naïve`, `café`) |
| self-attention / alignment | A later noun phrase must attend to an earlier one, so the map is not a diagonal | `el portero paró el balón de penalti y el equipo ganó el partido` | Needs the same coreference structure — a subject reintroduced later in the sentence |

Choosing these is a **pedagogical** decision, not a translation one. It belongs to whoever writes
the lesson that embeds the widget, and it must be verified by looking at the rendered widget —
see the test plan.

### 3. Terminology, not translation, for the maths

Several strings are terms with established English forms: `escalón` → *step*, `sigmoide` →
*sigmoid*, `Radio espectral` → *spectral radius*, `Ancho del estado` → *state width*. Take these
from `NOTATION.md` where it names them, and add any new ones to `AUTHORING.en.md` §Terminology
(P11-03) so the lessons and the widgets cannot drift apart.

Symbols inside labels (`d_h`, `ρ`, `Wₕₕ`, `x₀`, `T`, `k`, `q`, `d_model`) are notation and do
**not** change across locales. Only the words around them do.

## Acceptance criteria

- [ ] No user-visible string literal remains in `src/features/courses/widgets/**` — labels, hints,
      `aria-label`s and legend text all resolve through `messages`
- [ ] `messages/es.json` and `messages/en.json` are key-for-key identical under `courses.widgets`
- [ ] Every Spanish widget renders exactly as before — this task changes no Spanish output
- [ ] The two pedagogical corpora have an English entry, each with its teaching property recorded
- [ ] Every remaining widget falls back to the same corpus in both locales when it has no
      locale-sensitive data (most of them — numeric demos have no corpus at all)
- [ ] `pnpm check:bundle` green — the reading column still ships no unexpected JS
- [ ] `pnpm lint` + `pnpm lint:content` + `pnpm test` + `pnpm build` green

## Test plan

- Unit: corpus selection returns the English corpus for `en`, the Spanish one for `es`, and a
  defined value for a locale with no entry.
- Unit: the existing widget maths tests under `widgets/math/__tests__/` must pass untouched —
  they operate on data, and this task changes no maths.
- **Manual, and not optional:** render `tokenizer-playground` with the English corpus and confirm
  the three tokenisers disagree by the amounts the prose will claim; render the self-attention map
  with the English sentence and confirm the off-diagonal cell the lesson points at is actually the
  bright one. A corpus that fails this is the wrong corpus, however good the sentence reads.
- Manual: one Spanish lesson before/after, side by side, to confirm zero Spanish-side change.

## Gotchas

- **`aria-label`s render nowhere.** Eleven of them, invisible to a visual diff and invisible to
  every existing test. Grep for the attribute, do not rely on reading the page.
- **The corpus is quoted in the prose.** Lessons name the words the widget shows (`niño`, `##`,
  `criptomoneda`). Changing a corpus in this task without the corresponding lesson is fine only
  because `en/` is empty — the *Spanish* corpora must not move. Treat any change to a Spanish
  corpus as out of scope for this task.
- **`messages` is shipped whole to the client** from the root layout. These keys are small, but
  the bundle guard is the check that says so; run it rather than assuming.
- **Do not internationalise the widget ids.** `<Explorable id="tokenizer-playground" />` is a
  registry key and locale-invariant, like lesson slugs.

## Out of scope

- Any English lesson content.
- Restructuring the widget registry, or the `Explorable` boundary. Only strings and corpora move.
- The `docs/courses/notebooks/` Colab notebooks — see the phase README.
- Spanish corpora changes of any kind.
