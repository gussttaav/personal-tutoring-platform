# P11-01 — Cross-locale references, and an English voice lint

**Tag:** `COURSE-P11-01` · **Size:** M · **Status:** not started

## TL;DR

Make a **partially translated** locale tree a supported state. Two bugs, one fatal and one
silent, both from the same assumption — that a reference and its target live in the same content
tree. Plus the English half of the voice lint, which otherwise passes anything.

## Context

P7-01 settled locales in one line, and it was right at the time:

> *Section anchors are locale-safe. A reference and its target always live in the same locale
> tree, so heading ids derived from heading text never have to cross languages.*

That holds when a locale is all-or-nothing. It stops holding the moment `en/` has one file and
the other 42 lessons resolve, per COURSE-P6-03b, to the Spanish spine.

### Bug 1 — the lint is fatal on a partial tree

[`validate-crosslinks.ts`](../../../src/lib/courses/validate-crosslinks.ts) groups files
`byDirectory` and calls `buildCrosslinkIndex(filePaths)` on that directory alone. For `en/` with
one lesson in it, the index has one entry. `crosslinkProblems` then reports every other slug as
unresolved and `validateCrosslinks` **throws on the first one**. `pnpm lint:content` exits 1;
`pnpm build` fails.

At ~403 references across 43 lessons this fires immediately. Nothing can be translated until it
is fixed.

### Bug 2 — every reference degrades to plain text, silently

[`Leccion.tsx`](../../../src/lib/courses/Leccion.tsx) resolves through `getLesson(slug, contentLocale)`,
where `contentLocale` is the locale of the *current* lesson's prose. Its own comment explains why
that field exists:

> *An untranslated lesson falls back to the canonical locale (page.tsx), so looking a slug up
> under the request locale would return `null` on `/en` and silently degrade EVERY reference to
> plain text.*

Once the current lesson **is** translated, `contentLocale` is `en`, and the same `null` comes
back for every target that is not yet translated. The reference renders as plain text: no link,
no hover card, no error. The fix that prevented this for untranslated lessons reintroduces it for
translated ones.

## Files affected

| File | Change |
|---|---|
| `src/lib/courses/validate-crosslinks.ts` | index resolves against the locale tree **then** the canonical tree |
| `src/lib/courses/Leccion.tsx` | per-reference resolution with canonical fallback; the card names the locale it resolved in |
| `src/lib/courses/__tests__/leccion.test.ts` | mixed-tree cases |
| `src/lib/courses/__tests__/validate-crosslinks.test.ts` | partial-`en/` fixtures |
| `src/lib/courses/validate-voice.ts` | English families, selected by locale tree |
| `src/lib/courses/__tests__/validate-voice.test.ts` | English cases; Spanish cases unchanged |
| `messages/{es,en}.json` | any new `Leccion` card copy, key-for-key |

## The change

### 1. The crosslink index gets a canonical fallback

`byDirectory` stays; what changes is that a lesson tree is validated against **its own index
plus the canonical index**. A slug resolves if the target exists in the requested locale *or* in
the canonical locale — mirroring `listLessonViews`, which is already the authority on what a
reader will actually get.

The canonical locale comes from `routing.defaultLocale`, but `validate-crosslinks.ts` is
deliberately Node-clean (no `next/*`, no registry import — see its file-top comment). Keep it
that way: take the canonical directory name as a parameter with an `"es"` default, or derive it
from the content root, rather than importing `@/i18n/routing`.

### 2. Anchors resolve in the tree the target actually came from

This is the subtle half. An `ancla` is a `github-slugger` id derived from **heading text**, so
the English and Spanish versions of one lesson have different anchor ids.

The rule follows from what the reader gets: an anchored reference must carry the anchor of the
page that will actually render. So the anchor is validated against the target's **resolved**
tree — the English lesson's headings when the target is translated, the Spanish lesson's when it
falls back.

The consequence is a maintenance hazard worth naming: **translating lesson X invalidates every
anchored reference to X from already-translated lessons.** They pointed at Spanish heading ids;
X now renders English ones. The lint catches this — it becomes a fatal unresolved anchor the next
time it runs — which is the desired behaviour, but it means a translation PR can fail the lint
for a file it did not touch. Say so in `AUTHORING.en.md` (P11-03) and in the block task mds.

### 3. `<Leccion>` resolves per reference

Replace the single `contentLocale` lookup with the same two-step: try the reference's own locale,
fall back to canonical. The hover card then describes a lesson that may be in the other language
— the card carries `BLOQUE n · LECCIÓN m`, title and summary, and for a fallback target those come
from the Spanish manifest.

Follow the precedent the rest of the codebase already set for this: the reader route marks a
fallback page `noindex` and the catalog shows an explicit "these lessons are in Spanish" notice
rather than pretending. A card that silently shows Spanish text inside an English page is the
same mistake in miniature. Mark it — the same way the ahead-of-the-reader case is already marked
*Más adelante* — with a locale note in the card copy, added to both message files.

### 4. English voice families

[`validate-voice.ts`](../../../src/lib/courses/validate-voice.ts) bans two families —
condescension (*obviamente*, *simplemente*, *basta con*) and padding (*cabe destacar*, *como
podemos ver*). Both lists are Spanish, and `collectMdxFiles` recurses the whole content root, so
English lessons pass the gate having been checked against nothing.

Add English families with the same contract — **warn, never fail** — selected by the lesson's
locale directory:

- **Condescension:** `obviously`, `simply`, `just`, `merely`, `of course`, `clearly`, `all you
  have to do`, `it should be clear`, `trivially`.
- **Padding:** `it is worth noting`, `as we can see`, `in this section we will`, `note that`,
  `it is important to`, `let us now`.

Keep the family-not-word-list discipline from the original: the Spanish rule exists because
`sencillamente` survived a full review after `simplemente` was banned. English has the same
trap — `just` and `merely` are the same word wearing different clothes.

The `OPEN`/`CLOSE` boundaries built on `\p{L}\p{N}` work unchanged for English; do not swap them
for `\b`.

## Acceptance criteria

- [ ] A tree with one English lesson referencing 40 Spanish-only targets passes `lint:content`
- [ ] An unresolved slug — absent from **both** trees — still fails, naming the file
- [ ] An `ancla` is validated against the target's resolved tree; a stale anchor still fails
- [ ] Translating a target flips its inbound anchors to the English ids, and the lint says so
- [ ] `<Leccion>` on an English page links a Spanish-fallback target and renders its hover card
- [ ] The card marks a fallback target's language; the copy exists in `messages/{es,en}.json`
- [ ] English condescension and padding families warn on English prose
- [ ] Spanish families still warn on Spanish prose; no cross-firing in either direction
- [ ] `validate-crosslinks.ts` still imports no `next/*` and no registry
- [ ] `pnpm lint` + `pnpm lint:content` + `pnpm test` + `pnpm build` + `pnpm check:bundle` green

## Test plan

- Unit, against temp fixture trees (the pattern `validate-crosslinks.test.ts` already uses):
  an `en/` of one lesson against an `es/` of three; a slug in neither; an anchor valid in Spanish
  but not in the English version of the same lesson, and the reverse.
- Unit, `leccion.test.ts`: resolution when the target is translated, when it falls back, when it
  exists in neither; the position rule (behind / ahead / in-bridge / draft) unchanged in all three.
- Unit, `validate-voice.test.ts`: an English lesson with `simply` warns; the same file in `es/`
  does not warn for it; a Spanish lesson with `simplemente` still warns.
- Manual: build with a hand-written `en/` lesson carrying one backward, one forward and one
  anchored reference; read the page and hover all three.

## Gotchas

- **Do not "fix" bug 2 by reverting to the request locale.** That is what `contentLocale` was
  introduced to prevent, and it breaks untranslated pages — the case that is currently correct.
  Two-step resolution is the only version that serves both.
- **`buildCrosslinkIndex` is exported and unit-tested directly.** Changing its signature touches
  the tests; changing its *meaning* silently is worse. Prefer a new resolution function over
  overloading the index.
- **The draft rule interacts.** A reference to a `draft: true` target renders as plain text and
  warns rather than failing. A target that is a draft in `en/` but published in `es/` is a new
  combination — decide it explicitly: resolve to the published Spanish lesson.
- **English `just` is high-frequency and legitimate** (*just as*, *just in case*, and inside
  quoted output). `prose()` already strips code fences, `<PyCell>` template literals, LaTeX and
  JSX before any pattern runs, which removes most of it; accept the rest as warnings. Warn-never-
  fail is what makes an imperfect rule affordable.

## Out of scope

- Any English lesson content. This task ships with `en/` still empty.
- Widget strings — P11-02.
- A drift lint between the locales — see the phase README's Out of scope.
- Changing how the reader route computes `noindex`. It is already correct: it keys off
  `view.contentLocale !== locale`, which stays true for exactly the untranslated lessons.
