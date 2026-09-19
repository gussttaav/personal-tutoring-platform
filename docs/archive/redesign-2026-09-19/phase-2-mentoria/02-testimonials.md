# P2-02 — Testimonials

**Tag:** `REDESIGN-P2-02` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜
**Depends on:** P2-01

## TL;DR

A «Valoraciones» band between the bento and the sessions: three quote cards in a grid, initials
avatars, the student's name and an optional context line, and a link to the verified reviews
on Classgap under the grid. The quotes are data in `src/constants/testimonials.ts`, never
translated; the band's chrome is in the message files.

## Context

- `design/mentoria.html` — `.quotes-grid` (1 column, 3 from 768), `.quote` (`#201f22`, `28px
  28px 24px`, 16px radius, hover border green-mid), `.quote .mark` (a Newsreader «“» at
  `3.25rem`, green at 0.45), `.quote p` (Newsreader `1.0625rem`, `1.55`, `#bbcabf`), `.quote
  .who` (top hairline, 36px initials circle — the navbar's no-picture avatar: `rgba(78,222,163,
  0.12)` fill, `0.2` border, Manrope 700 12px green), `.name`, `.ctx`, `.quotes-more`.
- `src/components/Navbar.tsx:147-153` — the initials avatar the design reuses.
- `src/features/landing/HeroSection.tsx` (deleted in P2-01) carried the Classgap profile URL
  `https://www.classgap.com/es/tutor/gustavo-torres-guerrero`; `StructuredData.tsx` still has it
  in `sameAs`. Put it in `src/constants/index.ts` next to `GOOGLE_REVIEW_URL` and read it from
  both places.
- `src/app/[locale]/mentoria/page.tsx` — mount point: after `SpecializationsSection`, before the
  `Suspense` + `InteractiveShell` block.
- The quotes (from the previous site, verbatim except accents):

  | Name | Lang | Context | Quote |
  |------|------|---------|-------|
  | Sergi Pérez | es | — | De los mejores profesores que puedes encontrar (he tenido muchos). Experiencia fantástica, profesional, cercano y objetivo. Un auténtico crack. Sin duda lo volvería a contratar. |
  | Alberto González | es | Java · interfaces gráficas | Gran profesor, no dudéis en estar con él a la hora de aprender a programar, ya sea en Java, como en mi caso con ejercicios avanzados usando interfaces gráficas, o aprender desde cero. |
  | Pablo | es | — | Solo puedo decir que me parece un profesor excelente. Muy involucrado, explicaciones claras, un conocimiento claro de la materia que imparte y amabilidad que no se puede medir. |
  | Jeremy GL | en | — | He's a really cool and friendly teacher. He will take the time to explain everything well and concise. I almost finished my pack of classes with him, and it is a pleasure to be his student. |

  Ignacio Trillo's one-liner and the «Classgap» pseudo-card from the old site are deliberately
  not included (canvas decision).

## Files affected

| File | Change |
|------|--------|
| `src/constants/testimonials.ts` | **New.** `export interface Testimonial { name: string; initials: string; lang: "es" \| "en"; context?: string; quote: string }` and `export const TESTIMONIALS: readonly Testimonial[]` — the four rows above. `+ export const CLASSGAP_PROFILE_URL` in `src/constants/index.ts` |
| `src/features/mentoria/Testimonials.tsx` | **New**, server. Section head (`mentoria.testimonials.{kicker, heading, subtitle}`), the grid with the first THREE of `TESTIMONIALS` ordered by `lang === locale` first (stable otherwise), each card: mark, quote, initials, name, `context ?? t("student")`; under the grid `<a href={CLASSGAP_PROFILE_URL} target="_blank" rel="noopener noreferrer">` with `mentoria.testimonials.classgap` and the external-arrow icon from `StatCard` |
| `src/features/mentoria/mentoria.css` | `+ .mt-quotes`, `.mt-quote*` from the design |
| `src/app/[locale]/mentoria/page.tsx` | Mount `<Testimonials locale={locale} />` after the bento |
| `src/components/seo/StructuredData.tsx` | `sameAs` reads `CLASSGAP_PROFILE_URL` |
| `messages/es.json`, `messages/en.json` | `+ mentoria.testimonials.{kicker («Valoraciones» / «Reviews»), heading («Qué opinan mis estudiantes» / «What my students say»), subtitle («Lo que cuentan quienes ya han pasado por las clases.» / «What people who have taken the classes say.»), student («Estudiante» / «Student»), classgap («Ver las 150+ valoraciones verificadas en Classgap» / «See the 150+ verified reviews on Classgap»)}` — key-for-key |

## The change

**Quotes are content, not copy.** A testimonial is something a student wrote; translating it
would put words in their mouth, and storing it under `messages/` would invite exactly that.
It lives in a constants file with a `lang` tag, and the band shows the three most relevant
untranslated: on `/`, the three Spanish ones; on `/en`, Jeremy's first, then two Spanish ones.
That is honest about how many English-speaking students have written one so far.

**Initials, not photos.** The old site's photos are too soft for this interface, and showing a
student's face on a commercial page needs their explicit consent. The initials circle is the
same element the navbar draws for a user without a picture, so it needs no new visual
vocabulary. If sharp, consented photos arrive later, they replace the circle's content, not the
circle.

**Proof points at the verified source.** The band ends with the link to the 150+ Classgap
reviews — the third-party proof is the strong one; three curated quotes are the invitation to
go and read it.

## Acceptance criteria

- [ ] `/mentoria` shows the band between the bento and the sessions as `design/mentoria.html`
      at the three widths (three columns from 768, one below)
- [ ] `/mentoria` shows Sergi, Alberto, Pablo; `/en/mentoria` shows Jeremy first, then two
      Spanish quotes, none translated
- [ ] The Classgap link opens the profile in a new tab; `StructuredData`'s `sameAs` still
      contains the same URL, now from the constant
- [ ] Hover on a card matches the bento cards' hover (border only)
- [ ] Both message files carry the five new keys
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` green

## Test plan

```bash
pnpm lint
pnpm test
pnpm build
```

A unit test for the ordering helper (`pickTestimonials(locale)` → first three, locale-first)
in `src/features/mentoria/__tests__/`.

## Gotchas

- The «“» mark is a literal character in Newsreader; set `aria-hidden` on it.
- `context` is only shown when present; do not invent one for the quotes that lack it.
- No star ratings: the individual ratings are unknown; the 4.9 average already lives in the
  home's stats and comes from Classgap.

## Out of scope

- Collecting or editing testimonials, photos, an admin surface.
- Translating any quote.
